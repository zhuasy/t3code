import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";

export function createJobsEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    start: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:jobs:start",
      tag: WS_METHODS.jobsStart,
    }),
    list: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:jobs:list",
      tag: WS_METHODS.jobsList,
      idleTtlMs: 0,
    }),
    output: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:jobs:output",
      tag: WS_METHODS.jobsOutput,
      idleTtlMs: 0,
    }),
    stop: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:jobs:stop",
      tag: WS_METHODS.jobsStop,
    }),
  };
}
