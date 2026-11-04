---
name: t3-custom-interface
description: Use, troubleshoot, or maintain the custom fork's theme previews, thread notifications, usage panel defaults, project ordering, message continuity, native thread renames, and Claude streaming. Use for these fork-specific UI behaviors rather than generic frontend development.
---

# Custom interface and conversation behavior

These enhancements are mostly automatic. Do not invent an agent command or toggle
to activate them. Identify the affected surface and current state before changing
code; web and Electron share UI, while mobile has separate rendering.

## Appearance and thread details

- Theme library previews show the actual light/dark palette; selecting a theme or
  variant uses the existing theme settings. Start in Settings → Appearance. Keep
  theme import/export, editing, and selection intact when changing previews. See
  [ThemeSettings](../../../apps/web/src/components/settings/ThemeSettings.tsx) and
  [ThemeSelector](../../../apps/web/src/components/ui/theme-selector.tsx).
- Usage limits are included in the default thread-details layout and can collapse.
  Existing user customization can still hide them. Use the card's context menu or
  Settings → Appearance → Thread details to restore them. A meter's fill is **used**
  capacity; OpenRouter's value is money spent / key limit. Provider-specific setup
  belongs to [Pi/OpenRouter](../t3-pi-openrouter/SKILL.md) or [Devin](../t3-devin/SKILL.md).
- The new-thread project picker places **No project** after real projects. Preserve
  scratch-thread creation and keyboard selection when adjusting this ordering;
  the helper is in [CommandPalette.logic.ts](../../../apps/web/src/components/CommandPalette.logic.ts).
- Sidebar provider-icon placement follows the restored native layout. Earlier
  title-line placement experiments were reverted; do not reintroduce them as a
  requirement of this fork.

## Activity, images, and notifications

- Chat images, activity indicators, and web search results use the native upstream
  components. The Rare UI grid reveal, AI status icons, and search cards were
  removed on 2026-11-04 because they were buggy; do not reintroduce them or the
  `motion` dependency without a request from the developer.
- [ThreadNotificationCoordinator](../../../apps/web/src/components/ThreadNotificationCoordinator.tsx)
  uses minimal thread toasts. Preserve notification preferences and **Open thread**
  routing for completion, errors, questions, and approvals. Visual simplification
  must not suppress a required action or change notification delivery policy.

The theme selector and toasts still adapt Rare UI and carry third-party attribution.
Preserve [LICENSE.rare-ui](../../../apps/web/src/components/ui/LICENSE.rare-ui) and
[the license configuration](../../../third-party-licenses.config.json) while they remain.

## Conversation continuity

Expandable sections such as Jobs must scroll without changing the details card's
density. If opening output makes Jobs, Lineage, or other sections disappear while
Open in editor remains, inspect the growing-section exclusions in
[ThreadDetailsCard](../../../apps/web/src/components/chat/ThreadDetailsCard.tsx).
Keep the Jobs section's `data-thread-jobs-panel` marker paired with that measurement
rule; a log becoming taller must not remove the controls used to inspect it.

Sent messages must remain visible until their server-owned representation arrives,
without duplicate rows. Attachment previews must survive that handoff and release
blob URLs when no longer used. When diagnosing a disappearing message, inspect
acknowledgment and projection timing in
[optimisticUserMessages.ts](../../../apps/web/src/components/chat/optimisticUserMessages.ts)
and the timeline before adding a delay or a second cache. Queued messages and thread
switches need separate checks; do not re-show a row the server deliberately removed.
Queued image previews also use server message projections before a timeline row
exists. Run the compiled `useAttachmentPreviewHandoff.browser.test.tsx` regression
when changing that hook: compiler memoization across hook calls can fail even when
an isolated pure helper test passes.

Explicit native renames from Claude, Codex, and Pi update the T3 thread title, and
Claude assistant text streams before a complete block arrives. For these backend
paths and their regression checks, read [provider events](references/provider-events.md).
Devin prompt echoes and child routing are covered by the Devin skill.

## Verification

Use existing focused tests for state, parsing, and provider events. Pure appearance
changes need before/after captures rather than static-markup tests. For authorized
browser verification, follow [test-t3-app](../test-t3-app/SKILL.md) with isolated state
and the Replay provider; use [test-t3-mobile](../test-t3-mobile/SKILL.md) for affected
native surfaces. Honor current session restrictions on preview tools. Do not start
paid turns just to demonstrate a visual change.

Run the affected React Compiler coverage checks as well: a successful bundle can
still contain an unoptimized component. For example, a `try/finally` handler without
`catch` can make the compiler skip an entire Jobs row.
