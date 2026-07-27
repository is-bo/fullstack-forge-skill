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
 * Roles whose name states platform-wide reach.
 *
 * A subject holding one of these is not confined to a partition by the role itself, so it is the
 * only role shape that can stand in for a per-object predicate — and then only on a resource with
 * no observable partition.
 */
const GLOBAL_ADMINISTRATOR_ROLE =
  /super[_-]?admin|superadmin|platform[_-]?admin|global[_-]?admin|system[_-]?admin|instance[_-]?admin|site[_-]?admin|root[_-]?admin|\bsuperuser\b|\bsysadmin\b/iu;

/**
 * Roles that are administrative *inside* a partition.
 *
 * An organisation administrator proves authority over its own tenant, never over an object selected
 * by a global identifier, so this shape must never clear the object rule.
 */
const TENANT_ADMINISTRATOR_ROLE =
  /tenant[_-]?admin|org(?:anisation|anization)?[_-]?admin|workspace[_-]?admin|account[_-]?admin|team[_-]?admin|group[_-]?admin|company[_-]?admin|project[_-]?admin|clinic[_-]?admin|store[_-]?admin|school[_-]?admin|\bmembership\b|member[_-]?role/iu;

/**
 * An administrative gate whose object scope the source does not state either way.
 *
 * Substring matching: `requireAdmin`, `isAdmin`, and `ADMIN_ROLES` must all register as an
 * administrative gate so that they degrade to NOT_VERIFIED instead of silently reading as a
 * non-administrative role guard.
 */
const AMBIGUOUS_ADMINISTRATOR_ROLE =
  /admin|\bstaff\b|\bmoderator\b|\boperator\b|\bsudo\b|\bsuperuser\b/iu;

/** Keys that make an object part of an owner or tenant partition rather than platform state. */
const OWNERSHIP_PARTITION_KEY =
  /\bowner\b|owner[_-]?id|owned[_-]?by|\buser[_-]?id\b|created[_-]?by|belongs[_-]?to|\bmembership\b|\bmember[_-]?id\b/iu;

/** Declarations that publish an explicit global-administrator role mapping. */
const GLOBAL_ROLE_DECLARATION =
  /\b(?:global|platform|super|system|instance)[_-]?admin(?:istrator)?[_-]?roles?\b[^=]{0,80}=([^;\n]{0,400}(?:\n[^;]{0,400})?)/giu;

/** String literals inside a declaration's initializer. */
const ROLE_LITERAL = /["'`]([A-Za-z][\w .:-]{0,60})["'`]/gu;

/** Ranking used to combine authority evidence from several gates over the same sink. */
const AUTHORITY_RANK: Record<AdministrativeAuthority, number> = {
  none: 0,
  ambiguous: 1,
  tenant: 2,
  global: 3
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
export function decideObjectAuthorization(
  input: ObjectAuthorizationInput
): ObjectAuthorizationDecision {
  if (input.boundPredicate)
    return {
      outcome: "authorized",
      reason: "the object is bound to a subject, ownership, tenancy, or policy predicate"
    };
  if (input.authority === "tenant")
    return {
      outcome: "missing",
      reason:
        "the gate proves a partition administrator, which does not establish authority over an object selected by a global identifier"
    };
  if (input.authority === "none")
    return {
      outcome: "missing",
      reason: "no administrative or per-object authorization evidence reaches this operation"
    };
  if (input.authority === "ambiguous")
    return {
      outcome: "unresolved",
      reason:
        "an administrative gate was observed, but the source never states whether that role spans every object of this resource"
    };
  if (input.partition === "partitioned")
    return {
      outcome: "unresolved",
      reason:
        "a platform administrator gate was proven, but the resource is owner- or tenant-partitioned and nothing proves the role spans every partition"
    };
  return {
    outcome: "administrative",
    reason:
      "a proven platform administrator acts on a resource with no observable owner or tenant partition"
  };
}

/**
 * Classifies what a route's guard evidence proves about administrative reach.
 *
 * Role vocabulary is read only from guard bodies that were actually resolved and from the
 * middleware expression that selected them, because an unread guard is a name, not a control. An
 * unresolved gate that nevertheless mentions an administrative role is `ambiguous`, never `global`:
 * that is what keeps an installed package's `requireAdmin` out of the clean outcome.
 */
export function classifyAdministrativeAuthority(
  evidence: AdministrativeEvidence,
  globalRoles: ReadonlySet<string>
): AdministrativeAuthority {
  const text = evidence.text;
  if (text.length === 0) return "none";
  const declaredGlobal = [...globalRoles].some((role) =>
    new RegExp(`["'\`]${escapeRegExp(role)}["'\`]`, "u").test(text)
  );
  const administrative =
    declaredGlobal ||
    GLOBAL_ADMINISTRATOR_ROLE.test(text) ||
    TENANT_ADMINISTRATOR_ROLE.test(text) ||
    AMBIGUOUS_ADMINISTRATOR_ROLE.test(text);
  if (!administrative) return "none";
  // A body that was never read cannot upgrade a name into proven platform reach.
  if (!evidence.resolved) return "ambiguous";
  // A partition administrator stays a partition administrator even next to a global role name,
  // because the narrower gate is the one that can actually be satisfied.
  if (TENANT_ADMINISTRATOR_ROLE.test(text)) return "tenant";
  if (declaredGlobal || GLOBAL_ADMINISTRATOR_ROLE.test(text)) return "global";
  return "ambiguous";
}

/** Combines authority evidence from several gates covering the same sink. */
export function strongerAuthority(
  left: AdministrativeAuthority,
  right: AdministrativeAuthority
): AdministrativeAuthority {
  return AUTHORITY_RANK[right] > AUTHORITY_RANK[left] ? right : left;
}

/**
 * Reads the project's own global-administrator role mapping, when it publishes one.
 *
 * An explicit `GLOBAL_ADMIN_ROLES = ["admin"]` declaration is the project stating that its plain
 * `admin` role is platform-wide. That is admissible evidence and is the only mechanism by which an
 * otherwise ambiguous role name becomes `global`.
 */
export function collectGlobalAdministratorRoles(
  sources: Iterable<{ path: string; content: string }>
): Set<string> {
  const roles = new Set<string>();
  for (const source of sources) {
    GLOBAL_ROLE_DECLARATION.lastIndex = 0;
    for (
      let match = GLOBAL_ROLE_DECLARATION.exec(source.content);
      match !== null;
      match = GLOBAL_ROLE_DECLARATION.exec(source.content)
    ) {
      const initializer = match[1] ?? "";
      ROLE_LITERAL.lastIndex = 0;
      for (
        let literal = ROLE_LITERAL.exec(initializer);
        literal !== null;
        literal = ROLE_LITERAL.exec(initializer)
      ) {
        const value = literal[1];
        if (value !== undefined) roles.add(value);
      }
    }
  }
  return roles;
}

/**
 * Decides whether the object a sink addresses lives inside an owner or tenant partition.
 *
 * The context is the enclosing handler plus the query itself. An observable partition key means an
 * administrator role cannot stand in for the object predicate, so the surrounding code stating a
 * tenant or ownership boundary is what keeps a platform-admin gate out of the clean outcome.
 */
export function classifyResourcePartition(
  context: string,
  tenantKeyPattern: RegExp
): ResourcePartition {
  if (OWNERSHIP_PARTITION_KEY.test(context)) return "partitioned";
  return tenantKeyPattern.test(context) ? "partitioned" : "global";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
