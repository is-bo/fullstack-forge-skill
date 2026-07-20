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

export type DestinationClass =
  | "public"
  | "loopback"
  | "private"
  | "link-local"
  | "unspecified"
  | "multicast"
  | "reserved"
  | "cloud-metadata"
  | "shared-carrier"
  | "unsupported-protocol"
  | "credentialed"
  | "unparseable";

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

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Names and addresses that serve instance credentials on major clouds. These are the highest-value
 * SSRF targets and are never treated as safe, however literal the URL is.
 */
const CLOUD_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "169.254.169.253",
  "169.254.170.2",
  "100.100.100.200",
  "fd00:ec2::254",
  "metadata.google.internal",
  "metadata.goog",
  "metadata"
]);

export function classifyDestination(value: string): DestinationVerdict {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return verdict(false, "unparseable", `'${value}' is not an absolute URL.`, false);
  }
  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol))
    return verdict(
      false,
      "unsupported-protocol",
      `protocol '${parsed.protocol}' is outside the supported http(s) model.`,
      false
    );
  if (parsed.username !== "" || parsed.password !== "")
    return verdict(
      false,
      "credentialed",
      "the destination embeds credentials, which would be sent to whatever the host resolves to.",
      false
    );
  return classifyDestinationHost(parsed.hostname);
}

export function classifyDestinationHost(hostname: string): DestinationVerdict {
  const host = normalize(hostname);
  if (host === "") return verdict(false, "unparseable", "the destination has no host.", false);
  if (CLOUD_METADATA_HOSTS.has(host))
    return verdict(
      false,
      "cloud-metadata",
      `'${host}' is a cloud instance-metadata endpoint.`,
      false
    );

  const ipv4 = parseIpv4(host) ?? mappedIpv4(host);
  if (ipv4 !== undefined) return classifyIpv4(ipv4, host);

  const ipv6 = parseIpv6(host);
  if (ipv6 !== undefined) return classifyIpv6(ipv6, host);

  if (host === "localhost" || host.endsWith(".localhost"))
    return verdict(false, "loopback", `'${host}' resolves to the loopback interface.`, false);
  if (!/^[a-z0-9.-]+$/u.test(host))
    return verdict(false, "unparseable", `'${host}' is not a usable hostname.`, false);
  return verdict(
    true,
    "public",
    `'${host}' is a hostname with no literal address to classify; it is treated as external.`,
    true
  );
}

function classifyIpv4(octets: number[], host: string): DestinationVerdict {
  const [a, b, c, d] = octets as [number, number, number, number];
  if (a === 127) return verdict(false, "loopback", `${host} is in 127.0.0.0/8.`, false);
  if (a === 0) return verdict(false, "unspecified", `${host} is in 0.0.0.0/8.`, false);
  if (a === 10) return verdict(false, "private", `${host} is in 10.0.0.0/8.`, false);
  if (a === 172 && b >= 16 && b <= 31)
    return verdict(false, "private", `${host} is in 172.16.0.0/12.`, false);
  if (a === 192 && b === 168)
    return verdict(false, "private", `${host} is in 192.168.0.0/16.`, false);
  if (a === 169 && b === 254)
    return verdict(
      false,
      c === 169 && d === 254 ? "cloud-metadata" : "link-local",
      `${host} is in 169.254.0.0/16, the link-local range that carries cloud instance metadata.`,
      false
    );
  if (a === 100 && b >= 64 && b <= 127)
    return verdict(false, "shared-carrier", `${host} is in 100.64.0.0/10.`, false);
  if (a === 192 && b === 0 && (c === 0 || c === 2))
    return verdict(false, "reserved", `${host} is in a reserved IETF range.`, false);
  if (a === 198 && (b === 18 || b === 19))
    return verdict(false, "reserved", `${host} is in the 198.18.0.0/15 benchmark range.`, false);
  if (a === 198 && b === 51 && c === 100)
    return verdict(
      false,
      "reserved",
      `${host} is in the 198.51.100.0/24 documentation range.`,
      false
    );
  if (a === 203 && b === 0 && c === 113)
    return verdict(
      false,
      "reserved",
      `${host} is in the 203.0.113.0/24 documentation range.`,
      false
    );
  if (a >= 224 && a <= 239) return verdict(false, "multicast", `${host} is in 224.0.0.0/4.`, false);
  if (a >= 240) return verdict(false, "reserved", `${host} is in 240.0.0.0/4.`, false);
  return verdict(true, "public", `${host} is a public unicast address.`, false);
}

function classifyIpv6(groups: number[], host: string): DestinationVerdict {
  if (groups.every((group) => group === 0))
    return verdict(false, "unspecified", `${host} is the unspecified address ::.`, false);
  if (groups.every((group, position) => (position === 7 ? group === 1 : group === 0)))
    return verdict(false, "loopback", `${host} is the IPv6 loopback address ::1.`, false);
  // `new URL()` rewrites `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`, so the embedded IPv4 address
  // must be recovered from the hextets or loopback and metadata targets would read as public.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff)
    return classifyIpv4(embeddedIpv4(groups), host);
  const first = groups[0] as number;
  if ((first & 0xff00) === 0xff00)
    return verdict(false, "multicast", `${host} is in ff00::/8.`, false);
  if ((first & 0xffc0) === 0xfe80)
    return verdict(false, "link-local", `${host} is in fe80::/10.`, false);
  if ((first & 0xfe00) === 0xfc00)
    return verdict(false, "private", `${host} is in fc00::/7.`, false);
  if (first === 0x0100 && groups.slice(1, 4).every((group) => group === 0))
    return verdict(false, "reserved", `${host} is in the 100::/64 discard range.`, false);
  if (first === 0x2001 && groups[1] === 0x0db8)
    return verdict(
      false,
      "reserved",
      `${host} is in the 2001:db8::/32 documentation range.`,
      false
    );
  return verdict(true, "public", `${host} is a public IPv6 unicast address.`, false);
}

function embeddedIpv4(groups: number[]): number[] {
  const high = groups[6] as number;
  const low = groups[7] as number;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function normalize(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.endsWith(".") && !host.endsWith("..")) host = host.slice(0, -1);
  return host;
}

function parseIpv4(host: string): number[] | undefined {
  const parts = host.split(".");
  if (parts.length !== 4) return undefined;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) return undefined;
    const value = Number(part);
    if (value > 255) return undefined;
    octets.push(value);
  }
  return octets;
}

/** `::ffff:169.254.169.254` is the metadata endpoint, not an opaque IPv6 host. */
function mappedIpv4(host: string): number[] | undefined {
  const match = /^(?:::(?:ffff:)?|0{1,4}(?::0{1,4}){4}:ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(
    host
  );
  if (match === null) return undefined;
  return parseIpv4(match[1] as string);
}

function parseIpv6(host: string): number[] | undefined {
  if (!host.includes(":")) return undefined;
  const halves = host.split("::");
  if (halves.length > 2) return undefined;
  const toGroups = (segment: string): number[] | undefined => {
    if (segment === "") return [];
    const groups: number[] = [];
    for (const part of segment.split(":")) {
      if (!/^[0-9a-f]{1,4}$/u.test(part)) return undefined;
      groups.push(Number.parseInt(part, 16));
    }
    return groups;
  };
  const head = toGroups(halves[0] as string);
  const tail = halves.length === 2 ? toGroups(halves[1] as string) : [];
  if (head === undefined || tail === undefined) return undefined;
  if (halves.length === 1) return head.length === 8 ? head : undefined;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return undefined;
  return [...head, ...Array.from({ length: fill }, () => 0), ...tail];
}

function verdict(
  safe: boolean,
  classification: DestinationClass,
  reason: string,
  dnsDependent: boolean
): DestinationVerdict {
  return { safe, classification, reason, dns_dependent: dnsDependent };
}
