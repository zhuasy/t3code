import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { devinCredentialValue, devinUsageLimits, readDevinUsageLimits } from "./devinUsage.ts";

const checkedAt = "2026-11-03T00:00:00.000Z";
it("maps remaining allowance to used quota, including omitted proto zeroes", () => {
  const result = devinUsageLimits(
    {
      userStatus: {
        planStatus: {
          dailyQuotaResetAtUnix: 1793779200,
          weeklyQuotaRemainingPercent: 17,
          overageBalanceMicros: 410917849,
        },
      },
    },
    checkedAt,
  );
  assert.deepEqual(
    result.windows.map(({ label, usedPercent }) => ({ label, usedPercent })),
    [
      { label: "Weekly", usedPercent: 83 },
      { label: "Daily", usedPercent: 100 },
    ],
  );
  assert.equal(result.externalUsage.label, "Devin · $410.92 extra balance");
  const hidden = devinUsageLimits(
    {
      userStatus: {
        planStatus: {
          planInfo: { hideDailyQuota: true },
          dailyQuotaRemainingPercent: 20,
          weeklyQuotaRemainingPercent: 120,
        },
      },
    },
    checkedAt,
  );
  assert.deepEqual(
    hidden.windows.map(({ id, usedPercent }) => ({ id, usedPercent })),
    [{ id: "weekly", usedPercent: 0 }],
  );
});

it("reads CLI TOML strings without executing or expanding them", () => {
  assert.equal(
    devinCredentialValue(
      "windsurf_api_key = \"test-key\"\napi_server_url = 'https://server.codeium.com' # saved\n",
      "windsurf_api_key",
    ),
    "test-key",
  );
  assert.equal(
    devinCredentialValue("windsurf_api_key = '$(command)'", "windsurf_api_key"),
    "$(command)",
  );
  assert.equal(devinCredentialValue("[other]\nkey = 'unrelated'", "windsurf_api_key"), undefined);
});

it.effect("reads the instance data home and decodes Connect numeric strings", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped();
    yield* fs.makeDirectory(`${directory}/devin`);
    yield* fs.writeFileString(
      `${directory}/devin/credentials.toml`,
      'windsurf_api_key = "test-key"\n',
    );
    const client = HttpClient.make((request) => {
      assert.equal(
        request.url,
        "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus",
      );
      assert.equal(request.headers["connect-protocol-version"], "1");
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          Response.json({
            userStatus: {
              planStatus: {
                weeklyQuotaRemainingPercent: 25,
                weeklyQuotaResetAtUnix: "1794124800",
                overageBalanceMicros: "1000000",
              },
            },
          }),
        ),
      );
    });
    const result = yield* readDevinUsageLimits({ XDG_DATA_HOME: directory }).pipe(
      Effect.provideService(HttpClient.HttpClient, client),
    );
    assert.equal(result.windows[0]?.usedPercent, 75);
    assert.equal(result.externalUsage?.label, "Devin · $1.00 extra balance");
    yield* fs.writeFileString(
      `${directory}/devin/credentials.toml`,
      'windsurf_api_key = "test-key"\napi_server_url = "https://unrelated.example"\n',
    );
    const blocked = yield* readDevinUsageLimits({ XDG_DATA_HOME: directory }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("must not send credentials to another service")),
      ),
    );
    assert.equal(blocked.unavailable?.reason, "unsupported");
  }).pipe(Effect.scoped, Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))),
);
