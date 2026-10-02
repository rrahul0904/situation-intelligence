# ThreadAtlas

**RE-374 · discussion-to-dataset intelligence**

ThreadAtlas turns conversational source material into a typed, reviewable collection with field-level provenance, dedupe/merge handling, revision history, grouping, and visualizations.

The first slice is deliberately credential-free and review-first:

```text
discussion -> source ledger -> extraction proposals -> review -> accepted dataset
                                                        |
                                              table / groups / charts
```

## Phase A implemented

- deterministic discussion-block extraction;
- number, currency, range, date, URL and string normalization while preserving raw values;
- immutable source hashes and field evidence;
- exact-name and canonical-URL deduplication;
- explicit accept/reject review queue;
- create-or-merge application semantics;
- prompt-injection-like source text detection without executing source instructions;
- browser-local durable workspace;
- searchable table view;
- categorical grouping;
- deterministic chart recommendation;
- manual bar/scatter chart controls;
- source ledger and revision history;
- dependency-free Node test suite;
- reproducible static build and Vercel configuration.

## Run

```bash
npm run verify
npm run build
python3 -m http.server 4173 -d dist
```

Then open `http://localhost:4173`.

## Verification

```bash
npm test
npm run build
```

The test suite covers normalization, extraction provenance, dedupe/merge behavior, schema inference, chart recommendation, stable hashing, and the untrusted-source-text boundary.

## Clean-room boundary

The product concept was researched from public Reddit and wiki.bot surfaces only. No proprietary source code, private APIs, hidden prompts, copied datasets, visual assets, or branding are used. Public behavior is treated as product research; the implementation is original.

See:

- `docs/PRODUCT_REVERSE_ENGINEERING.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- [RE-374 issue](https://github.com/rrahul0904/situation-intelligence/issues/1)

This branch is **not** labeled production-ready until hosted exact-SHA runtime verification and later persistence/authentication gates are proven.
