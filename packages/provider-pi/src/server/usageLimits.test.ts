import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { readPiOpenRouterUsageLimits } from "./usageLimits.ts";

it.effect("reads the instance's OpenRouter key limit, including zero and unlimited budgets", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped();
    yield* fs.writeFileString(
      `${dir}/auth.json`,
      JSON.stringify({ openrouter: { type: "api_key", key: "stored-key" } }),
    );
    for (const [limit, remaining, percent] of [
      [100, 75, 25],
      [0, 0, 100],
      [null, null, null],
    ] as const) {
      const client = HttpClient.make((request) => {
        expect(request.url).toBe("https://openrouter.ai/api/v1/key");
        expect(request.headers.authorization).toBe("Bearer stored-key");
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            Response.json({ data: { limit, limit_remaining: remaining, limit_reset: "monthly" } }),
          ),
        );
      });
      const result = yield* readPiOpenRouterUsageLimits({
        enabled: true,
        environment: { PI_CODING_AGENT_DIR: dir, OPENROUTER_API_KEY: "other-key" },
      }).pipe(Effect.provideService(HttpClient.HttpClient, client));
      expect(result.windows[0]?.usedPercent ?? null).toBe(percent);
      if (limit === 100) expect(result.windows[0]?.label).toBe("OpenRouter · $25.00 / $100.00");
      expect(result.unavailable).toBeUndefined();
    }
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("does not invent a balance when the key is missing or the probe fails", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped();
    const client = HttpClient.make((request) =>
      Effect.succeed(HttpClientResponse.fromWeb(request, new Response("", { status: 401 }))),
    );
    for (const key of [undefined, "invalid-key", "!secret-command"]) {
      const result = yield* readPiOpenRouterUsageLimits({
        enabled: true,
        environment: { PI_CODING_AGENT_DIR: dir, ...(key ? { OPENROUTER_API_KEY: key } : {}) },
      }).pipe(Effect.provideService(HttpClient.HttpClient, client));
      expect(result.windows).toEqual([]);
      expect(result.unavailable?.reason).toBe(
        key === "invalid-key" ? "probeFailed" : "unsupported",
      );
    }
  }).pipe(Effect.provide(NodeServices.layer)),
);
