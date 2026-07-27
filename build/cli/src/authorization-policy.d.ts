/**
 * Object-authorization policy semantics for `FF-AUTHZ-OBJECT-001`.
 *
 * The object rule fires when a request-controlled identifier reaches a per-object read or mutation
 * without a demonstrated subject/object predicate. That is correct for an ordinary caller, but it
 * also reported a platform operator deleting a platform-owned record behind a proven administrator
 * gate. The naive repair — suppress the rule whenever any role check exists — is worse than the
 * false positive it removes: a tenant administrator deleting by an unscoped global identifier is a
 * textbook broken-object-level-authorization defect, and role presence would hide it.
 *
 * This module therefore separates the two questions the rule was conflating:
 *  - *who* the guard proves the caller is (`AdministrativeAuthority`), and
 *  - *what* the object belongs to (`ResourcePartition`).
 *
 * Only the combination of a platform-wide administrator and a resource with no observable owner or
 * tenant boundary is an administrative operation. Everything else keeps its defect or degrades to
 * NOT_VERIFIED; nothing is silently cleared by a role name.
 */
/** What a resolved guard proves about the caller's administrative reach. */
export type AdministrativeAuthority = "global" | "tenant" | "ambiguous" | "none";
/** Whether the object the sink addresses belongs to an owner or tenant partition. */
export type ResourcePartition = "global" | "partitioned";
export type ObjectAuthorizationOutcome = "authorized" | "administrative" | "unresolved" | "missing";
export type ObjectAuthorizationDecision = {
    outcome: ObjectAuthorizationOutcome;
    /** Deterministic sentence appended to finding evidence; never contains source text. */
    reason: string;
};
/**
 * Role evidence gathered for one sink.
 *
 * `text` is source text — middleware expressions plus the guard bodies they resolved to — and is
 * only ever read for role vocabulary. `resolved` records whether a body was actually read, because
 * a role name observed on an unresolvable guard proves nothing at all.
 */
export type AdministrativeEvidence = {
    resolved: boolean;
    text: string;
};
export type ObjectAuthorizationInput = {
    /** A subject, ownership, tenancy, or policy predicate is bound to this specific object. */
    boundPredicate: boolean;
    authority: AdministrativeAuthority;
    partition: ResourcePartition;
};
/**
 * Decides whether an object-level operation is authorized, administratively justified, unprovable,
 * or a defect.
 *
 * The rule, in full:
 *
 * 1. A predicate bound to *this* object — an ownership or tenancy column in the query, a connected
 *    `authorize(subject, object)` call, or a dominating policy check — always wins. It answers the
 *    object question directly and no role reasoning is needed.
 * 2. Otherwise the outcome is decided by the pair (authority, partition):
 *
 *    | authority   | partition     | outcome        | why                                          |
 *    | ----------- | ------------- | -------------- | -------------------------------------------- |
 *    | `global`    | `global`      | administrative | platform operator over platform-owned state  |
 *    | `global`    | `partitioned` | unresolved     | the role is platform-wide, but nothing proves it spans every partition of a partitioned resource |
 *    | `tenant`    | any           | missing        | a partition administrator addressing a global identifier is precisely the BOLA defect |
 *    | `ambiguous` | any           | unresolved     | an administrative gate exists but its object scope was never stated |
 *    | `none`      | any           | missing        | an ordinary caller selecting an object by identifier |
 *
 * Two properties matter more than the table. First, a role name never *clears* the rule: the only
 * clean outcome from role evidence is `administrative`, which still publishes a low-severity policy
 * finding, so a wrong global-admin classification degrades to noise rather than to silence. Second,
 * every uncertain case lands on `unresolved` (NOT_VERIFIED) instead of on `authorized`, so missing
 * evidence is never reported as proof.
 */
export declare function decideObjectAuthorization(input: ObjectAuthorizationInput): ObjectAuthorizationDecision;
/**
 * Classifies what a route's guard evidence proves about administrative reach.
 *
 * Role vocabulary is read only from guard bodies that were actually resolved and from the
 * middleware expression that selected them, because an unread guard is a name, not a control. An
 * unresolved gate that nevertheless mentions an administrative role is `ambiguous`, never `global`:
 * that is what keeps an installed package's `requireAdmin` out of the clean outcome.
 */
export declare function classifyAdministrativeAuthority(evidence: AdministrativeEvidence, globalRoles: ReadonlySet<string>): AdministrativeAuthority;
/** Combines authority evidence from several gates covering the same sink. */
export declare function strongerAuthority(left: AdministrativeAuthority, right: AdministrativeAuthority): AdministrativeAuthority;
/**
 * Reads the project's own global-administrator role mapping, when it publishes one.
 *
 * An explicit `GLOBAL_ADMIN_ROLES = ["admin"]` declaration is the project stating that its plain
 * `admin` role is platform-wide. That is admissible evidence and is the only mechanism by which an
 * otherwise ambiguous role name becomes `global`.
 */
export declare function collectGlobalAdministratorRoles(sources: Iterable<{
    path: string;
    content: string;
}>): Set<string>;
/**
 * Decides whether the object a sink addresses lives inside an owner or tenant partition.
 *
 * The context is the enclosing handler plus the query itself. An observable partition key means an
 * administrator role cannot stand in for the object predicate, so the surrounding code stating a
 * tenant or ownership boundary is what keeps a platform-admin gate out of the clean outcome.
 */
export declare function classifyResourcePartition(context: string, tenantKeyPattern: RegExp): ResourcePartition;
