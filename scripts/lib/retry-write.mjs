import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const WINDOWS_TRANSIENT_WRITE_CODES = new Set(["EACCES", "EBUSY", "EPERM", "UNKNOWN"]);
const DEFAULT_DELAYS_MS = Object.freeze([10, 25, 50, 100, 200, 400]);

/**
 * Windows indexers and agent hosts can briefly hold generated files without exposing a stable
 * sharing-violation code through Node. Retry only that bounded platform/error set; permanent and
 * non-Windows failures still surface immediately.
 */
export async function writeFileWithTransientRetry(
  path,
  data,
  options,
  { platform = process.platform, delays = DEFAULT_DELAYS_MS, write = writeFile, pause = delay } = {}
) {
  let attempt = 0;
  while (true) {
    try {
      await write(path, data, options);
      return;
    } catch (error) {
      const retry =
        platform === "win32" &&
        WINDOWS_TRANSIENT_WRITE_CODES.has(error?.code) &&
        attempt < delays.length;
      if (!retry) throw error;
      await pause(delays[attempt]);
      attempt += 1;
    }
  }
}
