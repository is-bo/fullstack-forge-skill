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
export const REDACTED = "[REDACTED]";
/** Bounded output keeps a hostile page from flooding evidence files with megabytes of text. */
export const DEFAULT_MAX_LENGTH = 500;
/** Key names whose values are secret regardless of the surrounding syntax. */
const SENSITIVE_KEY = String.raw `(?:authorization|auth|proxy-authorization|cookie|set-cookie|session[_-]?id|sessionid|session|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|pwd|passphrase|credential|private[_-]?key|signature|sig)`;
/**
 * Redacts a URL's secret-bearing components while keeping origin and path, which are the parts that
 * make evidence useful. Query *keys* survive; query *values* never do.
 */
export function redactUrl(input) {
    let parsed;
    try {
        parsed = typeof input === "string" ? new URL(input) : new URL(input.href);
    }
    catch {
        return "[UNPARSEABLE_URL]";
    }
    if (parsed.username !== "" || parsed.password !== "") {
        parsed.username = REDACTED;
        parsed.password = "";
    }
    for (const key of [...new Set([...parsed.searchParams.keys()])])
        parsed.searchParams.set(key, REDACTED);
    if (parsed.hash !== "")
        parsed.hash = REDACTED;
    return parsed.href;
}
/** True when the value looks like a hash or revision rather than a credential. */
function looksLikeHash(value) {
    return /^[0-9a-f]+$/u.test(value) || /^[0-9A-F]+$/u.test(value);
}
/** High-entropy runs are credential-shaped: long, mixed-class, and not a hex digest. */
function looksLikeCredential(value) {
    if (value.length < 32)
        return false;
    if (looksLikeHash(value))
        return false;
    return /[A-Za-z]/u.test(value) && /\d/u.test(value);
}
function redactUrlsInText(text) {
    return text.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/giu, (match) => {
        // Trailing punctuation belongs to the sentence, not the URL.
        const trimmed = /[).,;'"\]]+$/u.exec(match);
        const suffix = trimmed === null ? "" : trimmed[0];
        const candidate = suffix === "" ? match : match.slice(0, -suffix.length);
        const redacted = redactUrl(candidate);
        return redacted === "[UNPARSEABLE_URL]" ? `${candidate}${suffix}` : `${redacted}${suffix}`;
    });
}
function redactAssignments(text) {
    let output = text;
    // key=value, key: value, "key": "value" — the three forms that appear in headers, JSON, and logs.
    output = output.replace(new RegExp(String.raw `(["']?\b${SENSITIVE_KEY}\b["']?\s*[:=]\s*)(["']?)([^\s"',;&}]+)\2`, "giu"), (_match, prefix, quote) => `${prefix}${quote}${REDACTED}${quote}`);
    // `Authorization: Bearer <token>` and bare `Bearer <token>` in prose.
    output = output.replace(/\b(bearer|basic|digest|token)\s+([A-Za-z0-9._~+/=-]{8,})/giu, "$1 [REDACTED]");
    return output;
}
function redactTokens(text) {
    let output = text;
    // JWTs are unambiguous and must never survive, at any length.
    output = output.replace(/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+)?/gu, "[REDACTED_JWT]");
    // Common vendor key prefixes carry a secret immediately after the prefix.
    output = output.replace(/\b(sk|pk|rk|ghp|gho|ghs|ghu|xox[abprs])[_-][A-Za-z0-9_-]{8,}/gu, "[REDACTED_KEY]");
    // Residual high-entropy runs.
    output = output.replace(/\b[A-Za-z0-9+/_-]{32,}={0,2}\b/gu, (match) => looksLikeCredential(match) ? REDACTED : match);
    return output;
}
function redactPaths(text) {
    let output = text;
    // Windows user profiles: keep the shape, drop the account name and anything below it.
    output = output.replace(/([A-Za-z]:\\Users\\)[^\\\s"']+/gu, (_match, prefix) => `${prefix}[REDACTED_USER]`);
    // POSIX home directories.
    output = output.replace(/(\/(?:home|Users)\/)[^/\s"']+/gu, (_match, prefix) => `${prefix}[REDACTED_USER]`);
    return output;
}
/**
 * Applies every redaction rule and bounds the result.
 *
 * Order matters: URLs are handled first so their query values are removed structurally rather than
 * by the looser text rules, and truncation happens last so a secret can never be split across the
 * boundary and survive in half.
 */
export function redactText(input, maxLength = DEFAULT_MAX_LENGTH) {
    const original = typeof input === "string" ? input : String(input);
    let text = redactUrlsInText(original);
    text = redactAssignments(text);
    text = redactTokens(text);
    text = redactPaths(text);
    const redacted = text !== original;
    let truncated = false;
    if (text.length > maxLength) {
        text = text.slice(0, maxLength);
        truncated = true;
    }
    return { text, redacted, truncated };
}
/**
 * Redacts and annotates in one step for fields that carry a plain string. The suffix keeps the
 * evidence honest about what was removed instead of silently presenting a shortened value as whole.
 */
export function redactToString(input, maxLength = DEFAULT_MAX_LENGTH) {
    const result = redactText(input, maxLength);
    const notes = [];
    if (result.redacted)
        notes.push("redacted");
    if (result.truncated)
        notes.push("truncated");
    return notes.length === 0 ? result.text : `${result.text} [${notes.join("+")}]`;
}
/** Normalizes an unknown thrown value into redacted, bounded text. */
export function redactError(error) {
    const message = error instanceof Error
        ? error.message
        : typeof error === "string"
            ? error
            : "non-Error value thrown";
    return redactToString(message);
}
//# sourceMappingURL=redaction.js.map