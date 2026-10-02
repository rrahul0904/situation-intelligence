# RE-374 implementation plan

## Phase A — reviewable discussion-to-dataset slice
Status: implemented on the feature branch when exact-head verification passes.

Acceptance:
- deterministic discussion parsing;
- typed normalization with raw values retained;
- source/provenance hash on proposals;
- duplicate create/merge behavior;
- suspicious instruction-like text flagged;
- explicit accept/reject queue;
- local durable workspace;
- dataset search;
- categorical grouping;
- deterministic chart recommendation;
- manual bar/scatter override;
- revision/source views;
- automated unit tests + static build.

## Phase B — real private workspace
- PostgreSQL + migrations
- auth + tenant isolation
- source CRUD and ingestion jobs
- LLM extraction provider behind JSON schema validation
- explicit schema-change proposals
- review permissions
- conflict queue
- export/import

Exit: two users can independently operate isolated workspaces and reload from server state.

## Phase C — connectors
Order:
1. Reddit thread JSON adapter
2. CSV/table import
3. Wikipedia list/table adapter
4. webhook/generic discussion adapter

Every connector must emit the same immutable source envelope and provenance locators.

## Phase D — visualization intelligence
- typed chart grammar
- field/cardinality-based recommendation rules
- quality checks (label collision, missing data, extreme skew)
- chart configuration history
- small multiples/facets
- timelines/maps only after deterministic data prerequisites are met

## Phase E — collaboration + governance
- sandbox branches
- schema migrations
- reviewer roles
- revision diff/rollback
- audit/export/retention
- notifications
- rate/cost limits
- API + MCP

No phase can be called production-ready until hosted exact-SHA runtime verification, security gates, persistence tests, and recovery behavior are proven.
