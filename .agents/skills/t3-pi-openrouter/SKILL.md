---
name: t3-pi-openrouter
description: Use or maintain this T3 Code fork's curated Pi/OpenRouter model picker, full model names, company logos, and OpenRouter key spend-limit display. Use for missing models, branding errors, or unavailable Pi usage data; not for choosing an unrelated provider.
---

# Pi and OpenRouter in the custom fork

## Select and diagnose models

The web/desktop Pi picker intentionally shows a curated subset. An authenticated
model may be absent because of that filter, not because Pi or OpenRouter is broken.
Read [openRouterFrontier.ts](../../../apps/web/src/components/chat/openRouterFrontier.ts)
for the current allowlist. Do not copy a dated list of models into instructions or
assume the picker changes backend capability discovery.

The filter handles `openrouter/` slugs, normalizes the leading `~` variant, and has
an explicit non-OpenRouter Morph exception. Preserve the actual provider/model ID
when selecting or delegating. Full display names and company logos are presentation;
they must not rewrite the ID sent to the provider.

When adding a requested model, confirm the exact ID from the live provider catalog,
then update the allowlist. Branding resolves through
[openRouterBrand.ts](../../../apps/web/src/components/chat/openRouterBrand.ts) and
[providerIconUtils.ts](../../../apps/web/src/components/chat/providerIconUtils.ts).
Retain logo attribution in `openRouterLogos/LICENSE`. Check picker search, selected
labels, grouping, icons, and delegation capability separately; they need not use
the same frontend filter. The mobile picker is separate and does not automatically
inherit this web curation.

## Read spend limits correctly

Pi's usage probe reads the OpenRouter API key's limit and remaining balance, not a
per-thread bill, subscription allowance, or total account credits. **OpenRouter
Spend Limit** displays dollars used / key limit. No configured key cap can produce
no meter while the link to OpenRouter's key settings remains available.

Credentials come from Pi's `auth.json` under `PI_CODING_AGENT_DIR` or `~/.pi/agent`,
with `OPENROUTER_API_KEY` as fallback. A stored API-key setting takes precedence;
an environment-variable reference is resolved against the server environment.
Command-backed credentials beginning with `!` are intentionally unsupported by
the usage probe. Do not execute them or expose credentials to diagnose a meter.

For unavailable usage, check that Pi is enabled, the correct host has a supported
credential, and the key request succeeds. Keep probe failure distinct from
unsupported authentication and from a genuine zero remaining limit. Do not change
the user's key cap or spend money merely to make the meter appear.

The probe is [usageLimits.ts](../../../packages/provider-pi/src/server/usageLimits.ts).
Extend its existing tests for credential/response changes. Display paths include
web thread details and composer usage, plus mobile's UsageLimitsSection; verify the
units and used-versus-remaining meaning on every affected surface.
