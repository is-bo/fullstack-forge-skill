/**
 * Host classification and offline request policy.
 *
 * Offline enforcement used to be a single check against the initial URL, which a loopback page
 * could trivially escape through redirects, subresources, or script-issued requests. Every host
 * decision now flows through this module so the browser interceptor, the pre-navigation guard, and
 * the driver policy all agree on what "loopback" means.
 */
export type HostClass = "loopback" | "private" | "link-local" | "public" | "unknown";
export type RequestDecision = {
    allowed: true;
} | {
    allowed: false;
    reason: string;
    hostClass: HostClass;
};
/**
 * Normalizes a hostname for classification.
 *
 * `URL` already lowercases hostnames and canonicalizes numeric IPv4 forms (`0x7f.0.0.1`,
 * `2130706433`) for special schemes, so classification runs on an already-normalized value in the
 * common path. This function additionally strips the DNS trailing dot and IPv6 brackets, which
 * `URL` preserves and which would otherwise defeat exact-match comparisons.
 */
export declare function normalizeHost(hostname: string): string;
/**
 * Classifies a hostname into the trust buckets offline policy cares about.
 *
 * Only `loopback` is permitted offline. Private and link-local ranges are deliberately *not*
 * loopback: reaching them still generates real traffic on the host's networks, and link-local in
 * particular covers cloud metadata endpoints.
 */
export declare function classifyHost(hostname: string): HostClass;
export declare function isLoopbackHost(hostname: string): boolean;
/**
 * Decides whether a single browser request may proceed under the active offline policy.
 *
 * Called from the request interceptor before the request leaves the browser, so a denial prevents
 * the connection *and* the DNS lookup that would precede it.
 */
export declare function decideRequest(rawUrl: string, offline: boolean): RequestDecision;
/**
 * Browser-side guard for transports that request interception does not cover.
 *
 * Playwright routes HTTP(S) requests but not WebSocket handshakes, so the same loopback rule is
 * installed inside the page as an init script. This is defence in depth for a transport the driver
 * cannot abort from the outside; the caller records an explicit limitation either way.
 */
export declare function websocketGuardScript(): string;
