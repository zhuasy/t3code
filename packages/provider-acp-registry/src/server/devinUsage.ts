import * as Digest from "effect/crypto/Digest";
import * as Hex from "effect/encoding/Hex";
import * as Option from "effect/Option";
import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import {
  clampPercent,
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "@t3tools/provider-core/server/usageLimits";

const decodeCredentialString = Schema.decodeSync(Schema.fromJsonString(Schema.String));
const NumberValue = Schema.Union([Schema.Finite, Schema.NumberFromString]);
const UsageResponse = Schema.Struct({
  userStatus: Schema.Struct({
    planStatus: Schema.Struct({
      planInfo: Schema.optional(
        Schema.Struct({
          hideDailyQuota: Schema.optional(Schema.Boolean),
          hideWeeklyQuota: Schema.optional(Schema.Boolean),
        }),
      ),
      dailyQuotaRemainingPercent: Schema.optional(NumberValue),
      weeklyQuotaRemainingPercent: Schema.optional(NumberValue),
      dailyQuotaResetAtUnix: Schema.optional(NumberValue),
      weeklyQuotaResetAtUnix: Schema.optional(NumberValue),
      overageBalanceMicros: Schema.optional(NumberValue),
    }),
  }),
});

export function devinUsageLimits(response: typeof UsageResponse.Type, checkedAt: string) {
  const plan = response.userStatus.planStatus;
  const windows: Array<ServerProviderUsageWindow> = [];
  for (const [id, label, remaining, reset, hidden, duration] of [
    [
      "daily",
      "Daily",
      plan.dailyQuotaRemainingPercent,
      plan.dailyQuotaResetAtUnix,
      plan.planInfo?.hideDailyQuota,
      1440,
    ],
    [
      "weekly",
      "Weekly",
      plan.weeklyQuotaRemainingPercent,
      plan.weeklyQuotaResetAtUnix,
      plan.planInfo?.hideWeeklyQuota,
      10080,
    ],
  ] as const) {
    if (hidden || (remaining === undefined && reset === undefined)) continue;
    const resetsAt =
      reset !== undefined && reset > 0
        ? Option.getOrUndefined(Option.map(DateTime.make(reset * 1000), DateTime.formatIso))
        : undefined;
    windows.push({
      id,
      label,
      kind: id === "weekly" ? "weekly" : "other",
      usedPercent: clampPercent(100 - (remaining ?? 0)),
      windowDurationMins: duration,
      ...(resetsAt ? { resetsAt } : {}),
    });
  }
  const balance = plan.overageBalanceMicros;
  return {
    ...makeUsageLimits({ checkedAt, windows }),
    externalUsage: {
      label:
        balance === undefined
          ? "Devin usage & limits"
          : `Devin · $${(Math.max(0, balance) / 1_000_000).toFixed(2)} extra balance`,
      url: "https://app.devin.ai/settings/usage",
    },
    ...(windows.length === 0 && balance === undefined
      ? {
          unavailable: {
            reason: "unsupported" as const,
            message: "Devin reports no account allowance.",
          },
        }
      : {}),
  };
}

// The CLI writes flat TOML basic/literal strings; never interpret commands in credentials.
export function devinCredentialValue(contents: string, key: "windsurf_api_key" | "api_server_url") {
  const line = contents.match(
    new RegExp(`^${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|'[^']*')\\s*(?:#.*)?$`, "m"),
  )?.[1];
  return line === undefined
    ? undefined
    : line.startsWith("'")
      ? line.slice(1, -1)
      : decodeCredentialString(line);
}

export const readDevinUsageLimits = Effect.fn("Devin.readUsageLimits")(function* (
  environment: NodeJS.ProcessEnv,
) {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  return yield* Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const platform = yield* HostProcess.Platform;
    const home =
      (platform === "win32" ? environment.USERPROFILE : environment.HOME) ||
      (yield* HostProcess.HomeDirectory);
    const dataHome =
      environment.XDG_DATA_HOME ||
      (platform === "win32"
        ? environment.LOCALAPPDATA || path.join(home, "AppData", "Local")
        : path.join(home, ".local", "share"));
    const contents = yield* fs
      .readFileString(path.join(dataHome, "devin", "credentials.toml"))
      .pipe(
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "NotFound" ? Effect.succeed("") : Effect.fail(error),
        }),
      );
    const token = devinCredentialValue(contents, "windsurf_api_key");
    if (!token)
      return makeUnavailableUsageLimits({
        checkedAt,
        reason: "unsupported",
        message: "Sign in with devin auth login to see account usage.",
      });
    const endpoint =
      devinCredentialValue(contents, "api_server_url") || "https://server.codeium.com";
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      ![
        "server.codeium.com",
        "server.self-serve.windsurf.com",
        "server.enterprise.windsurf.com",
      ].includes(url.hostname) ||
      url.username ||
      url.password
    ) {
      return makeUnavailableUsageLimits({
        checkedAt,
        reason: "unsupported",
        message: "Devin account usage is unavailable for this API server.",
      });
    }
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.post(
        `${url.origin}/exa.seat_management_pb.SeatManagementService/GetUserStatus`,
      ).pipe(
        HttpClientRequest.setHeader("Connect-Protocol-Version", "1"),
        // GetUserStatus requires IDE compatibility metadata even for CLI credentials.
        HttpClientRequest.bodyJsonUnsafe({
          metadata: {
            apiKey: token,
            ideName: "devin",
            ideVersion: "1.108.2",
            extensionName: "devin",
            extensionVersion: "1.108.2",
            locale: "en",
          },
        }),
      ),
    );
    const body = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(UsageResponse)),
    );
    const digest = yield* Digest.Digest;
    const credentialFingerprint = yield* digest
      .digest(Digest.sha256, new TextEncoder().encode(`devin\0${token}`))
      .pipe(Effect.map(Hex.encode), Effect.orDie);
    return { ...devinUsageLimits(body, checkedAt), credentialFingerprint };
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.orElseSucceed(() =>
      makeUnavailableUsageLimits({
        checkedAt,
        reason: "probeFailed",
        message: "Could not read Devin account usage.",
      }),
    ),
  );
});
