import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";
import {
  clampPercent,
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "@t3tools/provider-core/server/usageLimits";

const Auth = Schema.Struct({
  openrouter: Schema.optionalKey(
    Schema.Struct({ type: Schema.String, key: Schema.optionalKey(Schema.String) }),
  ),
});
const decodeAuth = Schema.decodeEffect(Schema.fromJsonString(Auth));
const KeyResponse = Schema.Struct({
  data: Schema.Struct({
    limit: Schema.NullOr(Schema.Finite),
    limit_remaining: Schema.NullOr(Schema.Finite),
    limit_reset: Schema.optionalKey(Schema.NullOr(Schema.String)),
  }),
});

export const readPiOpenRouterUsageLimits = Effect.fn("pi.readOpenRouterUsageLimits")(
  function* (input: { readonly enabled: boolean; readonly environment: NodeJS.ProcessEnv }) {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const unavailable = (reason: "unsupported" | "probeFailed") =>
      makeUnavailableUsageLimits({ checkedAt, reason });
    if (!input.enabled) return unavailable("unsupported");
    return yield* Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* HostProcess.HomeDirectory;
      const directory = input.environment.PI_CODING_AGENT_DIR;
      const agentDir = directory
        ? expandHomePath(directory, home)
        : path.join(home, ".pi", "agent");
      const contents = yield* fs.readFileString(path.join(agentDir, "auth.json")).pipe(
        Effect.catchTags({
          PlatformError: (error) =>
            error.reason._tag === "NotFound" ? Effect.succeed("{}") : Effect.fail(error),
        }),
      );
      const auth = yield* decodeAuth(contents);
      const stored = auth.openrouter?.type === "api_key" ? auth.openrouter.key : undefined;
      const configured = stored ?? input.environment.OPENROUTER_API_KEY;
      if (!configured) return unavailable("unsupported");
      // Command-backed Pi credentials must be resolved by Pi, not executed by a usage probe.
      if (configured.startsWith("!")) return unavailable("unsupported");
      const key = input.environment[configured] ?? configured;
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.execute(
        HttpClientRequest.get("https://openrouter.ai/api/v1/key").pipe(
          HttpClientRequest.bearerToken(key),
        ),
      );
      const { data } = yield* HttpClientResponse.filterStatusOk(response).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(KeyResponse)),
      );
      const limit = data.limit;
      const remaining = data.limit_remaining;
      const windows =
        limit !== null && remaining !== null && limit >= 0
          ? [
              {
                id: "openrouter_spend",
                kind:
                  data.limit_reset === "monthly"
                    ? ("monthly" as const)
                    : data.limit_reset === "weekly"
                      ? ("weekly" as const)
                      : ("other" as const),
                label: `OpenRouter · $${Math.max(0, limit - remaining).toFixed(2)} / $${limit.toFixed(2)}`,
                usedPercent: limit === 0 ? 100 : clampPercent((1 - remaining / limit) * 100),
              },
            ]
          : [];
      return {
        ...makeUsageLimits({ checkedAt, windows }),
        externalUsage: { label: "OpenRouter spend", url: "https://openrouter.ai/settings/keys" },
      };
    }).pipe(
      Effect.timeout("5 seconds"),
      Effect.orElseSucceed(() => unavailable("probeFailed")),
    );
  },
);
