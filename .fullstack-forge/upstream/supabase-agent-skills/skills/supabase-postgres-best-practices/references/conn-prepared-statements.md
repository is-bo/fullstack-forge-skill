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
## Use Prepared Statements Correctly with Pooling

Prepared statements are tied to individual database connections. In transaction-mode pooling, connections are shared, causing conflicts.

**Incorrect (named prepared statements with transaction pooling):**

```sql
-- Named prepared statement
prepare get_user as select * from users where id = $1;

-- In transaction mode pooling, next request may get different connection
execute get_user(123);
-- ERROR: prepared statement "get_user" does not exist
```

**Correct (use unnamed statements or session mode):**

```sql
-- Option 1: Use unnamed prepared statements (most ORMs do this automatically)
-- The query is prepared and executed in a single protocol message

-- Option 2: Deallocate after use in transaction mode
prepare get_user as select * from users where id = $1;
execute get_user(123);
deallocate get_user;

-- Option 3: Use session mode pooling (port 5432 vs 6543)
-- Connection is held for entire session, prepared statements persist
```

Check your driver settings:

```sql
-- Many drivers use prepared statements by default
-- Node.js pg: { prepare: false } to disable
-- JDBC: prepareThreshold=0 to disable
```

Reference: [Prepared Statements with Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool-modes)
