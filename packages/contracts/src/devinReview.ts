import { ProviderInstanceId } from "./providerInstance.ts";
import * as Schema from "effect/Schema";
import { IsoDateTime, PositiveInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const DevinReviewInput = Schema.Struct({
  instanceId: ProviderInstanceId,
  prUrl: TrimmedNonEmptyString.check(Schema.isMaxLength(2048)),
});
export type DevinReviewInput = typeof DevinReviewInput.Type;

export const DevinReview = Schema.Struct({
  status: Schema.Literals(["pending", "running", "completed", "errored", "cancelled", "skipped"]),
  commit_sha: TrimmedNonEmptyString,
  created_at: IsoDateTime,
  pr_number: PositiveInt,
  repo_path: TrimmedNonEmptyString,
});
export type DevinReview = typeof DevinReview.Type;

export class DevinReviewError extends Schema.TaggedError<DevinReviewError>()("DevinReviewError", {
  message: Schema.String,
}) {}
