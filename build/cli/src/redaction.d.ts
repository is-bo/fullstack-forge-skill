/**
 * Shared redaction for every string that reaches rendered-UI evidence.
 *
 * Console text, page errors, driver errors, and request URLs are attacker- and application-
 * controlled. They routinely carry bearer tokens, session cookies, query values, and absolute paths
 * that identify the operator. Evidence files are committed, attached to reports, and shared, so all
 * of it is redacted here before anything is written, printed, or turned into a finding.
 *
 * The rules are deliberately structural (userinfo, query values, key/value assignments, JWT shape,
 * high-entropy runs, home directories) rather than a list of known secrets, and each rule keeps the
 * surrounding text intact so the evidence stays readable.
 */
export declare const REDACTED = "[REDACTED]";
/** Bounded output keeps a hostile page from flooding evidence files with megabytes of text. */
export declare const DEFAULT_MAX_LENGTH = 500;
export type Redacted = {
    text: string;
    redacted: boolean;
    truncated: boolean;
};
/**
 * Redacts a URL's secret-bearing components while keeping origin and path, which are the parts that
 * make evidence useful. Query *keys* survive; query *values* never do.
 */
export declare function redactUrl(input: URL | string): string;
/**
 * Applies every redaction rule and bounds the result.
 *
 * Order matters: URLs are handled first so their query values are removed structurally rather than
 * by the looser text rules, and truncation happens last so a secret can never be split across the
 * boundary and survive in half.
 */
export declare function redactText(input: string, maxLength?: number): Redacted;
/**
 * Redacts and annotates in one step for fields that carry a plain string. The suffix keeps the
 * evidence honest about what was removed instead of silently presenting a shortened value as whole.
 */
export declare function redactToString(input: string, maxLength?: number): string;
/** Normalizes an unknown thrown value into redacted, bounded text. */
export declare function redactError(error: unknown): string;
