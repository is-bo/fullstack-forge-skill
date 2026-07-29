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
## Enable pg_stat_statements for Query Analysis

pg_stat_statements tracks execution statistics for all queries, helping identify slow and frequent queries.

**Incorrect (no visibility into query patterns):**

```sql
-- Database is slow, but which queries are the problem?
-- No way to know without pg_stat_statements
```

**Correct (enable and query pg_stat_statements):**

```sql
-- Enable the extension
create extension if not exists pg_stat_statements;

-- Find slowest queries by total time
select
  calls,
  round(total_exec_time::numeric, 2) as total_time_ms,
  round(mean_exec_time::numeric, 2) as mean_time_ms,
  query
from pg_stat_statements
order by total_exec_time desc
limit 10;

-- Find most frequent queries
select calls, query
from pg_stat_statements
order by calls desc
limit 10;

-- Reset statistics after optimization
select pg_stat_statements_reset();
```

Key metrics to monitor:

```sql
-- Queries with high mean time (candidates for optimization)
select query, mean_exec_time, calls
from pg_stat_statements
where mean_exec_time > 100  -- > 100ms average
order by mean_exec_time desc;
```

Reference: [pg_stat_statements](https://supabase.com/docs/guides/database/extensions/pg_stat_statements)
