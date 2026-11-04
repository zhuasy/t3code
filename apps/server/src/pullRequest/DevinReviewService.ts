import { DevinReview, DevinReviewError, type DevinReviewInput } from "@t3tools/contracts";
import { AcpRegistrySettings } from "@t3tools/provider-acp-registry/settings";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as SecretResolver from "@t3tools/secret-provider-core/server/SecretResolver";
import * as ServerSettings from "../serverSettings.ts";
import { requireSettingsSecret } from "../secrets/settingsSecretValue.ts";

export class DevinReviewService extends Context.Service<
  DevinReviewService,
  {
    readonly get: (input: DevinReviewInput) => Effect.Effect<DevinReview | null, DevinReviewError>;
    readonly start: (input: DevinReviewInput) => Effect.Effect<DevinReview, DevinReviewError>;
  }
>()("t3/pullRequest/DevinReviewService") {}

const decodeSettings = Schema.decodeUnknownEffect(AcpRegistrySettings);
const isReviewError = Schema.is(DevinReviewError);
const isReview = Schema.is(DevinReview);

const make = Effect.gen(function* () {
  const settings = yield* ServerSettings.ServerSettingsService;
  const secrets = yield* SecretResolver.SecretResolver;
  const client = yield* HttpClient.HttpClient;
  const request = Effect.fn("DevinReviewService.request")(
    function* (input: DevinReviewInput, start: boolean) {
      const all = yield* settings.getSettings;
      const instance = all.providerInstances[input.instanceId];
      const config = yield* decodeSettings(instance?.config);
      if (
        instance?.driver !== "acpRegistry" ||
        instance.enabled === false ||
        !config.enabled ||
        config.agentId !== "devin"
      ) {
        return yield* new DevinReviewError({ message: "Select an enabled Devin provider." });
      }
      if (!URL.canParse(input.prUrl) || new URL(input.prUrl).protocol !== "https:") {
        return yield* new DevinReviewError({
          message: "Devin Review requires an HTTPS pull request URL.",
        });
      }
      const token = yield* requireSettingsSecret(secrets, config.devinApiKey);
      if (!config.devinOrganizationId || !token.trim()) {
        return yield* new DevinReviewError({
          message: "Configure the Devin organization ID and API token in Settings → Providers.",
        });
      }
      const url = `https://api.devin.ai/v3/organizations/${encodeURIComponent(config.devinOrganizationId)}/pr-reviews`;
      const req = start
        ? HttpClientRequest.post(url).pipe(
            HttpClientRequest.bodyJsonUnsafe({ pr_url: input.prUrl }),
          )
        : HttpClientRequest.get(url).pipe(HttpClientRequest.setUrlParam("pr_url", input.prUrl));
      const response = yield* client.execute(req.pipe(HttpClientRequest.bearerToken(token)));
      if (!start && response.status === 404) return null;
      if (response.status === 401 || response.status === 403) {
        return yield* new DevinReviewError({
          message:
            "Devin denied access. Check the API token, organization, and Review permissions.",
        });
      }
      return yield* HttpClientResponse.filterStatusOk(response).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(DevinReview)),
      );
    },
    Effect.timeout("20 seconds"),
    Effect.catchIf(
      (error) => !isReviewError(error),
      () =>
        Effect.fail(
          new DevinReviewError({ message: "Could not contact Devin Review. Try again." }),
        ),
    ),
  );
  return DevinReviewService.of({
    get: Effect.fn("DevinReviewService.get")((input: DevinReviewInput) => request(input, false)),
    start: Effect.fn("DevinReviewService.start")((input: DevinReviewInput) =>
      request(input, true).pipe(
        Effect.filterOrFail(
          isReview,
          () => new DevinReviewError({ message: "Devin did not return a review." }),
        ),
      ),
    ),
  });
});

export const layer = Layer.effect(DevinReviewService, make);
