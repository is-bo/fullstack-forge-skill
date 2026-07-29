<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

<!-- fullstack-forge:upstream-reference provider=supabase-agent-skills -->

> **Fullstack Forge managed reference.** This is vendored upstream expertise, compiled into
> Forge's managed tree. It is not an independently installable skill and no agent host can
> discover or trigger it: Forge's composition engine decides when it applies. Forge's module
> contract, evidence rules, and status semantics take precedence over anything written here.
## Create Composite Indexes for Multi-Column Queries

When queries filter on multiple columns, a composite index is more efficient than separate single-column indexes.

**Incorrect (separate indexes require bitmap scan):**

```sql
-- Two separate indexes
create index orders_status_idx on orders (status);
create index orders_created_idx on orders (created_at);

-- Query must combine both indexes (slower)
select * from orders where status = 'pending' and created_at > '2024-01-01';
```

**Correct (composite index):**

```sql
-- Single composite index (leftmost column first for equality checks)
create index orders_status_created_idx on orders (status, created_at);

-- Query uses one efficient index scan
select * from orders where status = 'pending' and created_at > '2024-01-01';
```

**Column order matters** - place equality columns first, range columns last:

```sql
-- Good: status (=) before created_at (>)
create index idx on orders (status, created_at);

-- Works for: WHERE status = 'pending'
-- Works for: WHERE status = 'pending' AND created_at > '2024-01-01'
-- Does NOT work for: WHERE created_at > '2024-01-01' (leftmost prefix rule)
```

Reference: [Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
