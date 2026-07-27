# Build brief: Authorization

## Decide before coding

- Default-deny: every new route or resolver starts with no access; explicitly grant per role, never rely on hiding a link or menu item.
- Identify the object owner and the exact predicate that proves the caller may act on this specific instance, not just that the caller is authenticated.
- If the app is multi-tenant, decide the tenant key now and where it is enforced (query filter, row policy, middleware); never trust a client-supplied tenant id alone.
- Decide which actions need step-up or reauthentication: destructive, financial, or credential-changing operations.
- Prefer a shared authorization policy function over a one-off check so drift is caught in one place.
- List the roles that must be explicitly denied, not only the roles that are allowed.
- Decide the object scope of every administrative role: a platform administrator may act on any object of an unpartitioned resource, while an organisation or workspace administrator proves nothing about another partition's object.

## Evidence to produce while building

- A negative test per endpoint: an authenticated-but-unauthorized caller (wrong role, wrong owner, wrong tenant) is denied, not just shown no success path.
- A negative test for object-level access: requesting another user's or tenant's resource id returns not-found or forbidden, never a silent data leak.
- A file:line citation showing the authorization predicate runs at the final server boundary, not only in UI or middleware registration.
- Evidence the tenant filter is applied to the actual query or lookup, not assumed from context.
- Confirmation that admin and internal endpoints require the same server-side check as user-facing ones.
- Evidence that each rejection path is controlled by an authorization question (subject, role, permission, scope, ownership, tenancy, policy) rather than by a status code alone; CSRF, quota, rate-limit, MIME, geographic, maintenance, and schema rejections also answer 401/403 and prove no authority.
- For an object operation cleared only by an administrator role, the declared role-to-scope mapping plus a negative test proving a partition administrator cannot reach another partition's object.
