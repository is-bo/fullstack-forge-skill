/**
 * Classification of a *literal* outbound destination for SSRF reasoning.
 *
 * A constant map of URL strings is not by itself an SSRF defence. `http://127.0.0.1:3000/` and
 * `http://169.254.169.254/latest/meta-data/` are both fixed literals in a `const` object, and both
 * are exactly the destinations an SSRF attack wants to reach. Suppressing a finding because the
 * value is "constant" would bless the worst cases, so every literal destination is classified here
 * and only genuinely external destinations are treated as safe.
 *
 * Bounded on purpose: this module reasons about literals only. It performs no DNS resolution, so a
 * hostname is never proven to point anywhere in particular, and callers must record that
 * limitation rather than imply the destination was resolved.
 */
export type DestinationClass = "public" | "loopback" | "private" | "link-local" | "unspecified" | "multicast" | "reserved" | "cloud-metadata" | "shared-carrier" | "unsupported-protocol" | "credentialed" | "unparseable";
export type DestinationVerdict = {
    safe: boolean;
    classification: DestinationClass;
    reason: string;
    /**
     * True when the verdict depends on DNS. A hostname destination is only as trustworthy as the
     * resolver at request time; this engine cannot exclude DNS rebinding or a private A record.
     */
    dns_dependent: boolean;
};
export declare function classifyDestination(value: string): DestinationVerdict;
export declare function classifyDestinationHost(hostname: string): DestinationVerdict;
