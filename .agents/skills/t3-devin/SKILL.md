---
name: t3-devin
description: Configure or troubleshoot this T3 Code fork's Devin Cloud and Devin Local providers, authentication, models/options, usage limits, native sessions and subagent display, or hosted Devin pull-request reviews. Distinguishes CLI login from the organization review API token.
---

# Devin in T3 Code Custom

Start from the provider instance in the destination **environment**, not credentials
on the device displaying the client. Follow the current
[provider guide](../../../docs/user/providers-acp.md#devin) and returned tool schemas.

## Provider setup and login

- Add **Devin Cloud** or **Devin Local** in Settings → Providers. They are separate
  instances and ACP processes sharing the environment's Devin CLI login. Cloud
  runs `devin acp --cloud`; Local runs `devin acp`. Leave Executable override empty
  for the normal setup. An override is an executable path, not a shell command
  containing `--cloud`.
- Use the provider's sign-in flow, or `devin auth login` interactively on the host
  when needed. Do not run interactive login inside a managed shell job.
- Cloud's version presets are Fusion, Ultra, Normal, and Lite when reported by
  Devin. Local has its own model list. Use what the live capability probe reports;
  do not copy a Local model into Cloud. Organization, repositories, persona, and
  platform are provider options; do not invent a separate reasoning-effort setting.
- When the user requests Devin delegation, first inspect T3's orchestration
  capabilities and use the returned provider/model IDs and `target.options`.
  If unavailable, report that rather than substituting a different provider.

## Usage and native sessions

Account allowance/reset times appear in Usage → Limits, with extra-usage balance
when reported. This reads the CLI login, **not** the hosted-review API token. An
unavailable reading is not zero remaining usage. Check the login on the correct
host; do not print or copy credential files into chat. Custom API servers may not
support the account-usage probe.

Use the provider's **List sessions** and import flow when advertised. Reimporting
the same native session returns its existing T3 thread. Native title metadata on
an imported session is distinct from an explicit native rename event. ACP cannot
rewind its conversation on checkpoint rollback; the next turn starts a fresh
session after file restoration.

Devin's native child-agent metadata drives lineage and routes child output to the
child session. Its user-message echoes must display the user's request without
duplicating T3's injected instructions. When diagnosing either issue, inspect the
[Devin normalization layer](../../../packages/provider-acp-registry/src/server/devinAcp.ts)
before changing generic ACP behavior. Replacement prompts must wait for Devin to
acknowledge cancellation of the previous prompt.

## Hosted PR review

This is a separate service from asking a conversational Devin agent to review files.
It submits the PR to Devin and can post findings to that PR. Use it when the user
authorizes a hosted review; a local code-reading request alone does not authorize
publishing comments.

1. Configure the Cloud instance's **Devin organization ID** and **Devin API token**
   in Settings → Providers. The token needs `UseReviewManual` and `ViewReview`.
   Use T3's secret-input flow if a secret is needed; do not ask for it in chat.
2. Open the PR and choose **Devin Review**; on mobile it is in the PR actions menu.
   Select the intended instance and inspect any existing review first.
3. Start the review only when requested, or refresh its status. Compare the
   returned `commit_sha` with the PR's current head before calling it current.
4. Follow **Open findings in Devin** or read the PR comments for findings. A
   completed status alone is not proof of approval or absence of issues.

Do not invent a Devin-review MCP tool: the implementation exposes service methods
through client RPC. Discover tools before using them, or guide the user through
the UI if the current harness has no authorized route. A 401/403 means to check the
organization, token, and review permissions, not to retry with a CLI login token.

For changes, use [DevinReviewService](../../../apps/server/src/pullRequest/DevinReviewService.ts)
and its existing tests, plus both web and mobile review surfaces. Account usage lives
in [devinUsage.ts](../../../packages/provider-acp-registry/src/server/devinUsage.ts);
auth and runtime changes belong in the provider adapter boundary. Use fixtures and
focused tests first; real reviews can publish comments and real turns cost money.
