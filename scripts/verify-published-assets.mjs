import { resolve } from "node:path";
import { verifyPublishedAssets } from "./lib/release-safety.mjs";

const [local, published] = process.argv.slice(2);
if (local === undefined || published === undefined)
  throw new Error("Usage: node scripts/verify-published-assets.mjs <local-dir> <published-dir>");
const result = await verifyPublishedAssets(resolve(local), resolve(published));
console.log(JSON.stringify(result, null, 2));
