// @effect-diagnostics nodeBuiltinImport:off -- Exercises shell scripts against isolated command fixtures.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { expect, it } from "vite-plus/test";

function fixture() {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-update-audit-"));
  const scripts = NodePath.join(root, "scripts/local-openrouter");
  const state = NodePath.join(root, "state");
  NodeFS.mkdirSync(scripts, { recursive: true });
  NodeFS.mkdirSync(state);
  for (const file of ["start.sh", "update.sh"]) {
    NodeFS.copyFileSync(NodePath.join(import.meta.dirname, file), NodePath.join(scripts, file));
  }
  const helpers = NodePath.join(root, "commands.sh");
  NodeFS.writeFileSync(
    helpers,
    `
    git() {
      if [[ -n "\${T3_TEST_FAIL:-}" && "git $*" == *"$T3_TEST_FAIL"* ]]; then return 7; fi
      case "$*" in
        'branch --show-current') echo local/custom ;;
        'rev-parse --git-path rebase-merge') echo "$T3_TEST_ROOT/rebase-merge" ;;
        'rev-parse --git-path rebase-apply') echo "$T3_TEST_ROOT/rebase-apply" ;;
        'rev-parse HEAD') echo head-sha ;;
        'remote get-url fork') return 1 ;;
        'tag --list'*) printf 'v9.9.9-nightly.1\\nv9.9.9\\nv9.9.8\\n' ;;
        'merge-base HEAD origin/main') echo base-sha ;;
        'merge-base --is-ancestor v9.9.9 HEAD') [[ -n "\${T3_TEST_INCLUDED:-}" ]] ;;
        'merge-base --is-ancestor base-sha v9.9.9') [[ -z "\${T3_TEST_OLDER:-}" ]] ;;
      esac
    }
    pgrep() { [[ -n "\${T3_TEST_RUNNING:-}" ]]; }
    exec() { "$@"; }
    vp() {
      printf 'vp %s\\n' "$*" >> "$T3_TEST_ROOT/commands.log"
      if [[ -n "\${T3_TEST_FAIL:-}" && "$*" == *"$T3_TEST_FAIL"* ]]; then return 7; fi
    }
  `,
  );
  return {
    root,
    state,
    log: () => {
      const log = NodePath.join(root, "commands.log");
      return NodeFS.existsSync(log) ? NodeFS.readFileSync(log, "utf8") : "";
    },
    run: (file: string, env: Record<string, string> = {}) =>
      NodeChildProcess.spawnSync("/bin/bash", [NodePath.join(scripts, file)], {
        encoding: "utf8",
        env: {
          ...process.env,
          BASH_ENV: helpers,
          T3CODE_LOCAL_HOME: state,
          T3_TEST_ROOT: root,
          ...env,
        },
      }),
    [Symbol.dispose]() {
      NodeFS.rmSync(root, { recursive: true, force: true });
    },
  };
}

it.each(["check:changed", "build:desktop"])(
  "blocks launch after a failed %s until a successful update",
  (step) => {
    using f = fixture();
    expect(f.run("update.sh", { T3_TEST_FAIL: step }).status).toBe(7);
    const blocked = f.run("start.sh");
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("incomplete");
    expect(f.run("update.sh").status).toBe(0);
    expect(f.run("start.sh").status).toBe(0);
  },
);

it.each(["source-update-install.lock", "rebase-merge", "rebase-apply"])(
  "refuses launch while %s exists",
  (marker) => {
    using f = fixture();
    NodeFS.mkdirSync(
      NodePath.join(marker === "source-update-install.lock" ? f.state : f.root, marker),
    );
    expect(f.run("start.sh").status).toBe(1);
    expect(NodeFS.existsSync(NodePath.join(f.root, "commands.log"))).toBe(false);
  },
);

it.each(["git fetch", "git rebase"])(
  "keeps the previous build launchable after a failed %s",
  (step) => {
    using f = fixture();
    expect(f.run("update.sh", { T3_TEST_FAIL: step }).status).toBe(7);
    expect(f.run("start.sh").status).toBe(0);
  },
);

it("rebases onto the newest stable release, not a nightly", () => {
  using f = fixture();
  expect(f.run("update.sh").status).toBe(0);
  expect(f.log()).toContain("vp run check:changed v9.9.9\n");
});

it("waits for the running app, then stops before it changes anything", () => {
  using f = fixture();
  const result = f.run("update.sh", { T3_TEST_RUNNING: "1", T3CODE_UPDATE_WAIT: "1" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("still running");
  expect(f.log()).toBe("");
  expect(f.run("start.sh").status).toBe(0);
});

it("refuses a release older than the current upstream base", () => {
  using f = fixture();
  const result = f.run("update.sh", { T3_TEST_OLDER: "1" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("older than the upstream base");
  expect(f.log()).toBe("");
});

it("skips the build only when the built commit already includes the release", () => {
  using f = fixture();
  // After a hand-resolved rebase HEAD includes the release, but nothing built it yet.
  expect(f.run("update.sh", { T3_TEST_INCLUDED: "1" }).status).toBe(0);
  expect(f.log()).toContain("vp run build:desktop");
  NodeFS.rmSync(NodePath.join(f.root, "commands.log"));
  const result = f.run("update.sh", { T3_TEST_INCLUDED: "1" });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Nothing to update");
  expect(f.log()).toBe("");
});
