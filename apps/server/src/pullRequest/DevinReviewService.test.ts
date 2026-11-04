import { assert, it } from "@effect/vitest";
import { ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as SecretResolver from "@t3tools/secret-provider-core/server/SecretResolver";
import * as ServerSettings from "../serverSettings.ts";
import * as DevinReviewService from "./DevinReviewService.ts";

const instanceId = ProviderInstanceId.make("devin-cloud");
const input = { instanceId, prUrl: "https://github.com/acme/app/pull/42" };
const review = {
  status: "pending",
  commit_sha: "abc123",
  created_at: "2026-11-03T12:00:00.000Z",
  pr_number: 42,
  repo_path: "github.com/acme/app",
};

function layer(status: number, enabled = true) {
  return DevinReviewService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        ServerSettings.layerTest({
          providerInstances: {
            [instanceId]: {
              driver: "acpRegistry",
              enabled,
              config: { agentId: "devin", devinOrganizationId: "org-123", devinApiKey: "test-key" },
            },
          },
        }),
        Layer.mock(SecretResolver.SecretResolver)({
          read: () => Effect.die("No secret reference was configured"),
        }),
        Layer.succeed(
          HttpClient.HttpClient,
          HttpClient.make((request) => {
            assert.equal(request.url, "https://api.devin.ai/v3/organizations/org-123/pr-reviews");
            assert.equal(request.headers.authorization, "Bearer test-key");
            return Effect.succeed(
              HttpClientResponse.fromWeb(
                request,
                Response.json(status === 200 ? review : { message: "private test-key response" }, {
                  status,
                }),
              ),
            );
          }),
        ),
      ),
    ),
  );
}

it.effect("starts a hosted review and reads its latest status", () =>
  Effect.gen(function* () {
    const service = yield* DevinReviewService.DevinReviewService;
    assert.deepEqual(yield* service.start(input), review);
    assert.deepEqual(yield* service.get(input), review);
  }).pipe(Effect.provide(layer(200))),
);

it.effect("treats an absent head review as empty without masking start failures", () =>
  Effect.gen(function* () {
    const service = yield* DevinReviewService.DevinReviewService;
    assert.isNull(yield* service.get(input));
    const error = yield* service.start(input).pipe(Effect.flip);
    assert.equal(error.message, "Could not contact Devin Review. Try again.");
  }).pipe(Effect.provide(layer(404))),
);

it.effect.each([401, 403, 429])(
  "reports HTTP %s without exposing credentials or response bodies",
  (status) =>
    Effect.gen(function* () {
      const service = yield* DevinReviewService.DevinReviewService;
      const error = yield* service.start(input).pipe(Effect.flip);
      assert.notInclude(error.message, "test-key");
      assert.notInclude(error.message, "private");
      assert.include(error.message, status === 429 ? "Could not contact" : "Devin denied access");
    }).pipe(Effect.provide(layer(status))),
);

it.effect("rejects disabled providers before contacting Devin", () =>
  Effect.gen(function* () {
    const service = yield* DevinReviewService.DevinReviewService;
    assert.equal(
      (yield* service.start(input).pipe(Effect.flip)).message,
      "Select an enabled Devin provider.",
    );
  }).pipe(Effect.provide(layer(200, false))),
);
