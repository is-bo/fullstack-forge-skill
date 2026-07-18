import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
export async function withTemporaryProject(prefix, callback) {
    const safePrefix = `fullstack-forge-test-${prefix.replace(/[^a-z0-9-]/giu, "-")}-`;
    const root = await mkdtemp(join(tmpdir(), safePrefix));
    validate(root, safePrefix);
    try {
        return await callback(root);
    }
    finally {
        validate(root, safePrefix);
        await rm(root, { recursive: true });
    }
}
function validate(path, prefix) {
    const resolved = resolve(path);
    const temp = resolve(tmpdir());
    const separator = process.platform === "win32" ? "\\" : "/";
    if (!resolved.startsWith(`${temp}${separator}`) || !basename(resolved).startsWith(prefix)) {
        throw new Error(`Refusing to remove unexpected test path: ${resolved}`);
    }
}
//# sourceMappingURL=helpers.js.map