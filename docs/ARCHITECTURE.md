# ThreadAtlas architecture

## Phase A runtime

```text
Pasted discussion
      |
      v
Source ledger + stable hash
      |
      v
Deterministic extraction / normalization
      |
      +--> injection-like text flag (data stays inert)
      |
      v
Proposal queue
      |
   reviewer
  /       \
reject   accept
           |
        dedupe
      /        \
  create      merge
      \        /
       dataset + provenance
          |
     +----+-----+------+
     |          |      |
   table      groups  chart
                    recommendation
```

Phase A persists only to browser localStorage. That is intentional: the prototype can prove workflow and evaluation without claiming multi-user durability.

## Domain objects

### Source
- id/hash
- createdAt
- source kind
- byte/block counts
- suspicious block count
- preview

### Proposal
- proposed item name
- normalized identity
- typed field values
- raw field values
- evidence pointer
- extraction confidence
- security flag
- review status

### Item
- canonical id/name
- typed fields
- provenance list
- created/updated timestamps

### Revision event
- type
- timestamp
- source/proposal/item references
- merge/reject/create outcome

## Security model

Source text is untrusted data. The extraction engine is pure code in Phase A; source text has no execution path and cannot alter policy. Future model-backed extraction must keep system/schema instructions structurally separate from source content, use structured output validation, and subject every mutation to authorization + review policy.

## Phase B

- Postgres workspace persistence
- authenticated tenants
- server-side source registry
- structured model-provider abstraction
- schema proposal/review endpoints
- field-level conflict records
- connector adapters (Reddit JSON, CSV, Wikipedia tables, generic webhook)
- export/import
- evaluation fixtures

## Phase C

- collaborative review
- branches/sandboxes and merge semantics
- richer chart grammar
- chart quality evaluation
- scheduled source refresh
- notifications
- API/MCP surfaces
- audit, retention, roles, usage controls
