import { Job } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

export const JobIntent = Schema.Struct({ job: Job, bootId: Schema.String });
export const JobResult = Schema.Struct({
  status: Schema.Literals(["running", "completed", "failed", "stopped", "lost"]),
  startedAt: Schema.NullOr(Schema.Number),
  finishedAt: Schema.NullOr(Schema.Number),
  exitCode: Schema.NullOr(Schema.Int),
});
export const isJobActive = (job: Pick<Job, "status">) =>
  job.status === "starting" || job.status === "running";

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function jobPlist(input: {
  label: string;
  program: readonly string[];
  directory: string;
  environment: Readonly<Record<string, string>>;
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(input.label)}</string>
<key>ProgramArguments</key><array>${input.program.map((arg) => `<string>${xml(arg)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${xml(input.directory)}</string>
<key>EnvironmentVariables</key><dict>${Object.entries(input.environment)
    .map(([key, value]) => `<key>${xml(key)}</key><string>${xml(value)}</string>`)
    .join("")}</dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><false/>
<key>AbandonProcessGroup</key><false/>
<key>ExitTimeOut</key><integer>5</integer>
<key>StandardOutPath</key><string>/dev/null</string>
<key>StandardErrorPath</key><string>/dev/null</string>
</dict></plist>`;
}
