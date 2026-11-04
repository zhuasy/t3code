// @effect-diagnostics nodeBuiltinImport:off - Synchronous Git and filesystem calls prepare an isolated subprocess fixture.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import * as NodeURL from "node:url";
import { expect, it } from "vite-plus/test";

it("checks upstream without rebasing a local patch or changing a running build", () => {
  const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-source-update-"));
  const upstream = NodePath.join(temp, "upstream");
  const local = NodePath.join(temp, "local");
  const state = NodePath.join(temp, "state");
  const git = (cwd: string, ...args: string[]) =>
    NodeChildProcess.execFileSync(
      "git",
      [
        "-c",
        "commit.gpgsign=false",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        ...args,
      ],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  try {
    NodeFS.mkdirSync(upstream);
    git(upstream, "init", "-b", "main");
    NodeFS.writeFileSync(NodePath.join(upstream, "source"), "original");
    git(upstream, "add", ".");
    git(upstream, "commit", "-m", "initial");
    git(upstream, "tag", "v1.0.0");
    git(temp, "clone", upstream, local);
    git(local, "switch", "-c", "local/custom");
    NodeFS.writeFileSync(NodePath.join(local, "patch"), "company logos");
    git(local, "add", ".");
    git(local, "commit", "-m", "local patch");
    NodeFS.writeFileSync(NodePath.join(local, "running-build"), "keep serving this");
    const head = git(local, "rev-parse", "HEAD");
    const script = NodeURL.fileURLToPath(
      new URL("../../../../scripts/local-openrouter/check.sh", import.meta.url),
    );
    const check = () =>
      NodeChildProcess.execFileSync("/bin/bash", [script], {
        env: { ...process.env, T3CODE_SOURCE_REPO: local, T3CODE_LOCAL_HOME: state },
        encoding: "utf8",
      });
    expect(check()).toContain("includes the latest release, v1.0.0");
    NodeFS.writeFileSync(NodePath.join(upstream, "source"), "updated");
    git(upstream, "commit", "-am", "upstream update");
    git(upstream, "tag", "v1.0.1-nightly.1");
    expect(check()).toContain("includes the latest release, v1.0.0");
    git(upstream, "tag", "v1.0.1");
    expect(check()).toContain("Release v1.0.1 is available (1 upstream commits).");
    expect(git(local, "rev-parse", "HEAD")).toBe(head);
    expect(NodeFS.readFileSync(NodePath.join(local, "source"), "utf8")).toBe("original");
    expect(NodeFS.readFileSync(NodePath.join(local, "patch"), "utf8")).toBe("company logos");
    expect(NodeFS.readFileSync(NodePath.join(local, "running-build"), "utf8")).toBe(
      "keep serving this",
    );
    NodeFS.mkdirSync(NodePath.join(state, "source-update-check.lock"));
    expect(check).toThrow();
    expect(git(local, "rev-parse", "HEAD")).toBe(head);
  } finally {
    NodeFS.rmSync(temp, { recursive: true, force: true });
  }
});
