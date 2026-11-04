# Native titles and streaming

Use this reference when a provider's native session and T3's conversation disagree.
These features run automatically; they do not require a new skill invocation inside
each conversation.

## Native rename propagation

The Claude, Codex, and Pi adapters translate explicit native rename notifications
into `app_thread.renamed`. The
[event ingestor](../../../../apps/server/src/orchestration-v2/ProviderEventIngestor.ts)
applies the title as a user rename and clears pending automatic title regeneration.
This is different from initial imported-session title metadata, which must not
overwrite a title the user already chose in T3.

If a rename is missing, inspect the native notification, adapter translation, and
persisted event in that order. Do not patch just the sidebar label or poll the native
session file. Check the three supported adapters separately; this change does not
promise native rename support for every provider or bidirectional synchronization
for every T3 rename.

Pi echoes `set_session_name` requests sent by T3. Suppress names that are already
applied or in flight so an acknowledgment cannot overwrite a newer T3 title.
Preserve independent native rename events; requiring a literal `/rename` command
would incorrectly discard other native rename paths.

Entry points are [ClaudeAdapterV2](../../../../apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts),
[CodexAdapterV2](../../../../apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts),
and the [Pi adapter](../../../../packages/provider-pi/src/server/adapter.ts).
Extend the existing adapter and ingestor tests at the lowest layer that reproduces
the regression, rather than repeating the same assertion across every UI.

## Claude text streaming

Claude text deltas produce streaming assistant rows. Completed block snapshots must
claim the corresponding streamed item ID rather than append a duplicate response.
An API message can have multiple text blocks, including empty ones. Empty blocks
must not shift the final snapshot onto a new row and duplicate already streamed text.
Child-agent messages must not be mistaken for top-level text. Completion,
cancellation, and failure must clear the appropriate running state without dropping
text already received.

When text appears only at turn completion, trace the native deltas and adapter output
before changing client timing. When it appears twice, inspect streamed-item matching
and snapshot counts in ClaudeAdapterV2. Use the adapter's existing stream fixtures
and tests before considering a paid real-Claude turn.
