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
      case "$*" in
        'branch --show-current') echo local/custom ;;
        'rev-parse --git-path rebase-merge') echo "$T3_TEST_ROOT/rebase-merge" ;;
        'rev-parse --git-path rebase-apply') echo "$T3_TEST_ROOT/rebase-apply" ;;
        'remote get-url fork') return 1 ;;
      esac
    }
    exec() { "$@"; }
    vp() {
      printf 'vp %s\\n' "$*" >> "$T3_TEST_ROOT/commands.log"
      if [[ -n "$T3_TEST_FAIL" && "$*" == *"$T3_TEST_FAIL"* ]]; then return 7; fi
    }
  `,
  );
  return {
    root,
    state,
    run: (file: string, fail = "") =>
      NodeChildProcess.spawnSync("/bin/bash", [NodePath.join(scripts, file)], {
        encoding: "utf8",
        env: {
          ...process.env,
          BASH_ENV: helpers,
          T3CODE_LOCAL_HOME: state,
          T3_TEST_ROOT: root,
          T3_TEST_FAIL: fail,
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
    expect(f.run("update.sh", step).status).toBe(7);
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
