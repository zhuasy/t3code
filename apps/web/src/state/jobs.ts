import { createJobsEnvironmentAtoms } from "@t3tools/client-runtime/state/jobs";
import { connectionAtomRuntime } from "../connection/runtime";

export const jobsEnvironment = createJobsEnvironmentAtoms(connectionAtomRuntime);
