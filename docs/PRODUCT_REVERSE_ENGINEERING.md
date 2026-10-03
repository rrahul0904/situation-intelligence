# RE-375 — Product reverse-engineering brief

## Clean-room boundary

ThreadAtlas is an original implementation informed only by public behavior and public writing. We do **not** copy wiki.bot source code, prompts, private APIs, data, branding, visual assets, or hidden implementation details.

## Canonical tracker reconciliation

ThreadAtlas was initially staged under provisional RE-374 before the newest canonical tracker branch was available. That branch already assigned RE-374 to AgenticOS Agent Studio, so ThreadAtlas was reconciled to **RE-375**. The earlier RE-374 branch/PR are historical only.

## Public behavior observed (2026-10-02)

The source Reddit launch post describes a tool that reads a conversation thread, automatically adds new items to a list, and visualizes the resulting data. The public sandbox allows comment-driven additions plus grouping and visualization changes.

The public wiki.bot product/blog surfaces establish the following behavioral ideas:

- topic-agnostic extraction from conversation into structured rows;
- schema derivation from source material;
- type normalization for numbers, dates, ranges, ratios, and units;
- duplicate detection;
- filters/search/grouping over structured data;
- visualization selected from field types and subject category;
- per-value source provenance on public object pages;
- source-post ledgers showing which discussion content contributed to an item;
- a sandbox workflow for trying edits before treating them as canonical.

## Public weakness / improvement signals

At the research snapshot the launch post had no substantive accessible independent feedback body to incorporate, so we do not manufacture community sentiment. Instead Phase A turns visible product limitations and creator-stated uncertainty into engineering requirements:

1. The chart gallery explicitly labels several visualizations as needing more work. ThreadAtlas starts with fewer chart types and makes selection explainable and overridable.
2. The creator describes visualization selection as the hard part. ThreadAtlas separates chart recommendation from data extraction so each can be evaluated independently.
3. Automatic extraction can create silent data corruption if ambiguous values are accepted without review. ThreadAtlas adds a proposal queue and never mutates the accepted collection automatically in Phase A.
4. Normalization can erase source nuance. ThreadAtlas stores both raw and normalized values.
5. Conversation text is untrusted. Instruction-like content is flagged and remains inert source evidence.

## Independent product direction

ThreadAtlas should evolve beyond list recreation into a trustworthy collaborative data workspace:

`discussion -> source ledger -> extraction proposals -> human review -> normalized dataset -> facets/charts -> revision trace`

Longer-term differentiators should be evidence quality, conflict resolution, reversible schema evolution, reusable connector adapters, and evaluation — not copied UI or claims of parity.
