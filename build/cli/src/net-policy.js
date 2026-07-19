/**
 * Host classification and offline request policy.
 *
 * Offline enforcement used to be a single check against the initial URL, which a loopback page
 * could trivially escape through redirects, subresources, or script-issued requests. Every host
 * decision now flows through this module so the browser interceptor, the pre-navigation guard, and
 * the driver policy all agree on what "loopback" means.
 */
/** Schemes the interceptor understands. Anything else is refused offline rather than guessed at. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const WEBSOCKET_PROTOCOLS = new Set(["ws:", "wss:"]);
/**
 * Normalizes a hostname for classification.
 *
 * `URL` already lowercases hostnames and canonicalizes numeric IPv4 forms (`0x7f.0.0.1`,
 * `2130706433`) for special schemes, so classification runs on an already-normalized value in the
 * common path. This function additionally strips the DNS trailing dot and IPv6 brackets, which
 * `URL` preserves and which would otherwise defeat exact-match comparisons.
 */
export function normalizeHost(hostname) {
    let host = hostname.trim().toLowerCase();
    if (host.startsWith("[") && host.endsWith("]"))
        host = host.slice(1, -1);
    // A single trailing dot is the fully-qualified form of the same name; more than one is invalid.
    if (host.endsWith(".") && !host.endsWith(".."))
        host = host.slice(0, -1);
    return host;
}
function parseIpv4(host) {
    const parts = host.split(".");
    if (parts.length !== 4)
        return undefined;
    const octets = [];
    for (const part of parts) {
        if (!/^\d{1,3}$/u.test(part))
            return undefined;
        const value = Number(part);
        if (value > 255)
            return undefined;
        octets.push(value);
    }
    return octets;
}
/**
 * Extracts the embedded IPv4 address from an IPv4-mapped or IPv4-compatible IPv6 address.
 * `::ffff:127.0.0.1` is loopback and must not be misclassified as an opaque IPv6 host.
 */
function mappedIpv4(host) {
    const match = /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(host);
    if (match === null)
        return undefined;
    return parseIpv4(match[1]);
}
/** Expands an IPv6 address to its 8 hextets, or `undefined` when it is not a valid IPv6 literal. */
function parseIpv6(host) {
    if (!host.includes(":"))
        return undefined;
    const halves = host.split("::");
    if (halves.length > 2)
        return undefined;
    const toGroups = (segment) => {
        if (segment === "")
            return [];
        const groups = [];
        for (const part of segment.split(":")) {
            if (!/^[0-9a-f]{1,4}$/u.test(part))
                return undefined;
            groups.push(Number.parseInt(part, 16));
        }
        return groups;
    };
    const head = toGroups(halves[0]);
    const tail = halves.length === 2 ? toGroups(halves[1]) : [];
    if (head === undefined || tail === undefined)
        return undefined;
    if (halves.length === 1)
        return head.length === 8 ? head : undefined;
    const fill = 8 - head.length - tail.length;
    if (fill < 0)
        return undefined;
    return [...head, ...Array.from({ length: fill }, () => 0), ...tail];
}
/**
 * Classifies a hostname into the trust buckets offline policy cares about.
 *
 * Only `loopback` is permitted offline. Private and link-local ranges are deliberately *not*
 * loopback: reaching them still generates real traffic on the host's networks, and link-local in
 * particular covers cloud metadata endpoints.
 */
export function classifyHost(hostname) {
    const host = normalizeHost(hostname);
    if (host === "")
        return "unknown";
    if (host === "localhost" || host.endsWith(".localhost"))
        return "loopback";
    const ipv4 = parseIpv4(host) ?? mappedIpv4(host);
    if (ipv4 !== undefined) {
        const [a, b] = ipv4;
        if (a === 127)
            return "loopback"; // 127.0.0.0/8, not just 127.0.0.1
        if (a === 10)
            return "private";
        if (a === 172 && b >= 16 && b <= 31)
            return "private";
        if (a === 192 && b === 168)
            return "private";
        if (a === 169 && b === 254)
            return "link-local";
        if (a === 0)
            return "unknown";
        return "public";
    }
    const ipv6 = parseIpv6(host);
    if (ipv6 !== undefined) {
        if (ipv6.every((group, index) => (index === 7 ? group === 1 : group === 0)))
            return "loopback";
        const first = ipv6[0];
        if ((first & 0xfe00) === 0xfc00)
            return "private"; // fc00::/7 unique-local
        if ((first & 0xffc0) === 0xfe80)
            return "link-local"; // fe80::/10
        return "public";
    }
    // A name that is not an IP literal requires DNS to resolve, so it can never be proven loopback.
    return /^[a-z0-9.-]+$/u.test(host) ? "public" : "unknown";
}
export function isLoopbackHost(hostname) {
    return classifyHost(hostname) === "loopback";
}
/**
 * Decides whether a single browser request may proceed under the active offline policy.
 *
 * Called from the request interceptor before the request leaves the browser, so a denial prevents
 * the connection *and* the DNS lookup that would precede it.
 */
export function decideRequest(rawUrl, offline) {
    if (!offline)
        return { allowed: true };
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch {
        return { allowed: false, reason: "unparseable URL refused offline", hostClass: "unknown" };
    }
    // Data and blob URLs never touch the network; refusing them would break legitimate pages.
    if (parsed.protocol === "data:" || parsed.protocol === "blob:" || parsed.protocol === "about:")
        return { allowed: true };
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol) && !WEBSOCKET_PROTOCOLS.has(parsed.protocol)) {
        return {
            allowed: false,
            reason: `scheme '${parsed.protocol}' is not permitted offline`,
            hostClass: "unknown"
        };
    }
    const hostClass = classifyHost(parsed.hostname);
    if (hostClass === "loopback")
        return { allowed: true };
    return {
        allowed: false,
        reason: `offline policy permits loopback only; destination is ${hostClass}`,
        hostClass
    };
}
/**
 * Browser-side guard for transports that request interception does not cover.
 *
 * Playwright routes HTTP(S) requests but not WebSocket handshakes, so the same loopback rule is
 * installed inside the page as an init script. This is defence in depth for a transport the driver
 * cannot abort from the outside; the caller records an explicit limitation either way.
 */
export function websocketGuardScript() {
    return `(() => {
  const isLoopback = (host) => {
    let h = String(host || "").trim().toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    if (h.endsWith(".") && !h.endsWith("..")) h = h.slice(0, -1);
    if (h === "localhost" || h.endsWith(".localhost")) return true;
    const v4 = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/.exec(h);
    if (v4) return Number(v4[1]) === 127;
    const mapped = /^::(?:ffff:)?(\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$/.exec(h);
    if (mapped) return Number(mapped[1]) === 127;
    return h === "::1" || /^(0:){7}1$/.test(h);
  };
  const Original = globalThis.WebSocket;
  if (typeof Original !== "function") return;
  const Guarded = function (url, protocols) {
    let host = "";
    try {
      host = new URL(String(url), globalThis.location && globalThis.location.href).hostname;
    } catch {
      host = "";
    }
    if (!isLoopback(host)) {
      throw new DOMException(
        "Fullstack Forge offline policy blocked a non-loopback WebSocket connection.",
        "SecurityError"
      );
    }
    return new Original(url, protocols);
  };
  Guarded.prototype = Original.prototype;
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) Guarded[key] = Original[key];
  globalThis.WebSocket = Guarded;
})();`;
}
//# sourceMappingURL=net-policy.js.map