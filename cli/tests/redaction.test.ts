import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MAX_LENGTH,
  redactError,
  redactText,
  redactToString,
  redactUrl
} from "../src/redaction.js";

/**
 * Every sentinel is credential-shaped on purpose. Redaction is structural — it recognizes secrets by
 * position and form, not by a list of known strings — so the fixtures must exercise the real shapes.
 */
const SENTINELS = {
  query: "sentinel-query-0000111122223333aaaabbbb",
  fragment: "sentinel-fragment-00001111222233334444",
  password: "sentinel-password-00001111222233334444",
  bearer: "sentinel-bearer-000011112222333344445555",
  cookie: "sentinel-cookie-0000111122223333444455",
  apiKey: "sentinel-apikey-0000111122223333444455",
  random: "sentinel-random-0000111122223333aaaabbbb",
  websocket: "sentinel-websocket-000011112222333344"
} as const;

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJTRU5USU5FTCJ9.sentinel-signature-000011112222";

function assertClean(haystack: string, sentinel: string, context: string): void {
  assert.ok(!haystack.includes(sentinel), `${context} must not contain the raw sentinel`);
}

test("URL query values, fragments, and userinfo are redacted", () => {
  const redacted = redactUrl(
    `http://admin:${SENTINELS.password}@127.0.0.1:3000/report?token=${SENTINELS.query}#${SENTINELS.fragment}`
  );
  assertClean(redacted, SENTINELS.password, "userinfo");
  assertClean(redacted, SENTINELS.query, "query value");
  assertClean(redacted, SENTINELS.fragment, "fragment");
  // The useful parts survive: origin, path, and the query key.
  assert.match(redacted, /127\.0\.0\.1:3000\/report/u);
  assert.match(redacted, /token=/u);
});

test("an unparseable URL becomes an explicit marker rather than raw text", () => {
  assert.equal(redactUrl(`not a url ${SENTINELS.random}`), "[UNPARSEABLE_URL]");
});

test("URLs embedded in console text are redacted in place", () => {
  const result = redactText(
    `Failed to load http://127.0.0.1:3000/api?apiKey=${SENTINELS.apiKey} (net::ERR_FAILED)`
  );
  assertClean(result.text, SENTINELS.apiKey, "embedded URL");
  assert.equal(result.redacted, true);
  // Surrounding diagnostic text is preserved so the evidence stays actionable.
  assert.match(result.text, /Failed to load/u);
  assert.match(result.text, /ERR_FAILED/u);
});

test("authorization, cookie, and key assignments are redacted across syntaxes", () => {
  const cases = [
    `Authorization: Bearer ${SENTINELS.bearer}`,
    `Cookie: session=${SENTINELS.cookie}`,
    `api_key=${SENTINELS.apiKey}`,
    `"password": "${SENTINELS.password}"`,
    `client_secret: ${SENTINELS.apiKey}`,
    `X-Session-Id=${SENTINELS.cookie}`
  ];
  for (const input of cases) {
    const result = redactText(input);
    for (const sentinel of Object.values(SENTINELS)) {
      assertClean(result.text, sentinel, input);
    }
    assert.equal(result.redacted, true, `${input} must be marked redacted`);
  }
});

test("JWT-shaped values never survive redaction", () => {
  const result = redactText(`token refresh failed for ${JWT}`);
  assert.ok(!result.text.includes(JWT));
  assert.ok(!result.text.includes("sentinel-signature"));
  assert.match(result.text, /REDACTED/u);
});

test("bare high-entropy credential runs are redacted but hashes are preserved", () => {
  const credential = redactText(`unexpected value ${SENTINELS.random}`);
  assertClean(credential.text, SENTINELS.random, "bare credential");

  // A sha256 digest is legitimate evidence and must remain readable.
  const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const hash = redactText(`artifact sha256 ${digest}`);
  assert.ok(hash.text.includes(digest), "hash digests are evidence, not secrets");
});

test("home directory paths are reduced to their shape on both platforms", () => {
  const windows = redactText(String.raw`ENOENT: C:\Users\sentineluser\AppData\Local\Temp\shot.png`);
  assert.ok(!windows.text.includes("sentineluser"));
  assert.match(windows.text, /\[REDACTED_USER\]/u);

  const posix = redactText("ENOENT: /home/sentineluser/project/.forge/shot.png");
  assert.ok(!posix.text.includes("sentineluser"));
  assert.match(posix.text, /\[REDACTED_USER\]/u);
});

test("websocket URLs are redacted like any other URL", () => {
  const result = redactText(
    `WebSocket connection to wss://example.com/live?access_token=${SENTINELS.websocket} failed`
  );
  assertClean(result.text, SENTINELS.websocket, "websocket URL");
});

test("redaction reports whether it redacted, truncated, or both", () => {
  const clean = redactText("Uncaught TypeError: cannot read property 'id' of undefined");
  assert.equal(clean.redacted, false);
  assert.equal(clean.truncated, false);

  const long = redactText("a".repeat(DEFAULT_MAX_LENGTH + 50));
  assert.equal(long.truncated, true);
  assert.equal(long.text.length, DEFAULT_MAX_LENGTH);

  const both = redactText(`${"b".repeat(DEFAULT_MAX_LENGTH)} token=${SENTINELS.query}`);
  assert.equal(both.redacted, true);
  assert.equal(both.truncated, true);
  assertClean(both.text, SENTINELS.query, "truncated-and-redacted text");
});

test("annotated output states what happened to the string", () => {
  assert.match(redactToString(`token=${SENTINELS.query}`), /\[redacted\]$/u);
  assert.match(redactToString("x".repeat(DEFAULT_MAX_LENGTH + 1)), /\[truncated\]$/u);
  assert.equal(redactToString("plain message"), "plain message");
});

test("safe diagnostic messages remain fully understandable", () => {
  for (const message of [
    "Failed to load resource: net::ERR_CONNECTION_REFUSED",
    "Uncaught ReferenceError: dashboard is not defined",
    "net::ERR_NAME_NOT_RESOLVED at http://127.0.0.1:3000/"
  ]) {
    const result = redactText(message);
    assert.match(result.text, /ERR_|ReferenceError/u, `${message} must stay diagnosable`);
  }
});

test("thrown non-Error values are normalized instead of stringified blindly", () => {
  assert.equal(redactError({ secret: SENTINELS.password }), "non-Error value thrown");
  assert.equal(redactError(new Error("boom")), "boom");
  const fromString = redactError(`failed with token=${SENTINELS.query}`);
  assertClean(fromString, SENTINELS.query, "thrown string");
});
