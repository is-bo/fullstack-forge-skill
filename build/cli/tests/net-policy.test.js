import assert from "node:assert/strict";
import test from "node:test";
import { classifyHost, decideRequest, isLoopbackHost, normalizeHost } from "../src/net-policy.js";
test("loopback hostnames are recognized across every documented spelling", () => {
    const loopback = [
        "localhost",
        "LOCALHOST",
        "localhost.",
        "app.localhost",
        "APP.Localhost.",
        "127.0.0.1",
        "127.0.0.1.",
        "127.1.2.3", // the whole 127.0.0.0/8 range is loopback, not just .0.1
        "127.255.255.254",
        "::1",
        "[::1]",
        "0:0:0:0:0:0:0:1",
        "::ffff:127.0.0.1", // IPv4-mapped IPv6 loopback
        "::127.0.0.1"
    ];
    for (const host of loopback) {
        assert.equal(isLoopbackHost(host), true, `${host} must classify as loopback`);
    }
});
test("private, link-local, and public destinations are never treated as loopback", () => {
    const cases = [
        ["example.com", "public"],
        ["EXAMPLE.COM.", "public"],
        ["notlocalhost", "public"],
        ["localhost.evil.com", "public"], // suffix confusion must not grant loopback
        ["10.0.0.5", "private"],
        ["172.16.0.1", "private"],
        ["172.31.255.255", "private"],
        ["192.168.1.1", "private"],
        ["169.254.169.254", "link-local"], // cloud metadata
        ["::ffff:169.254.169.254", "link-local"],
        ["fe80::1", "link-local"],
        ["fd00::1", "private"],
        ["2606:4700:4700::1111", "public"]
    ];
    for (const [host, expected] of cases) {
        assert.equal(classifyHost(host), expected, `${host} must classify as ${expected}`);
        assert.equal(isLoopbackHost(host), false, `${host} must not be loopback`);
    }
});
test("172.15 and 172.32 sit outside the private range", () => {
    assert.equal(classifyHost("172.15.0.1"), "public");
    assert.equal(classifyHost("172.32.0.1"), "public");
});
test("hostname normalization strips brackets, case, and the trailing dot", () => {
    assert.equal(normalizeHost("[::1]"), "::1");
    assert.equal(normalizeHost("LocalHost."), "localhost");
    assert.equal(normalizeHost("  Example.COM  "), "example.com");
});
test("URL parsing canonicalizes numeric IPv4 forms before classification", () => {
    // The URL parser normalizes these to 127.0.0.1, which is exactly why classification runs on the
    // parsed hostname rather than on raw user text.
    for (const raw of ["http://2130706433/", "http://0x7f.0.0.1/", "http://127.1/"]) {
        assert.equal(new URL(raw).hostname, "127.0.0.1");
        assert.equal(decideRequest(raw, true).allowed, true, `${raw} resolves to loopback`);
    }
});
test("offline policy permits loopback http and https only", () => {
    assert.equal(decideRequest("http://127.0.0.1:3000/app.js", true).allowed, true);
    assert.equal(decideRequest("https://localhost:8443/style.css", true).allowed, true);
    assert.equal(decideRequest("http://example.com/x.js", true).allowed, false);
});
test("offline policy refuses non-loopback websockets and unknown schemes", () => {
    const socket = decideRequest("wss://example.com/live", true);
    assert.ok(!socket.allowed);
    assert.equal(socket.hostClass, "public");
    assert.equal(decideRequest("ws://127.0.0.1:3000/live", true).allowed, true);
    const ftp = decideRequest("ftp://example.com/f", true);
    assert.ok(!ftp.allowed);
    assert.match(ftp.reason, /scheme/u);
});
test("inline schemes that never touch the network stay permitted offline", () => {
    for (const raw of ["data:text/css,body{}", "about:blank"]) {
        assert.equal(decideRequest(raw, true).allowed, true, `${raw} is not a network request`);
    }
});
test("unparseable request URLs fail closed offline", () => {
    const decision = decideRequest("http://[not a url", true);
    assert.ok(!decision.allowed);
    assert.equal(decision.hostClass, "unknown");
});
test("online mode permits every destination unchanged", () => {
    for (const raw of ["http://example.com/", "wss://example.com/live", "ftp://example.com/f"]) {
        assert.equal(decideRequest(raw, false).allowed, true, `${raw} is allowed when online`);
    }
});
test("the blocked reason names the destination class without echoing the URL", () => {
    const decision = decideRequest("https://secrets.example.com/path?token=abc", true);
    assert.ok(!decision.allowed);
    assert.match(decision.reason, /loopback only/u);
    assert.doesNotMatch(decision.reason, /secrets\.example\.com|token|abc/u);
});
//# sourceMappingURL=net-policy.test.js.map