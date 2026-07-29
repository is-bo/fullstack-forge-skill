import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { deriveApplicationInspection } from "../src/application-inspection.js";
import { discoverProjectWithInventory } from "../src/discovery.js";
import { deriveShipInspection } from "../src/gates.js";
import { workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
const PARITY_FIXTURES = [
    ["vulnerable-express", `app.get('/redirect', (req, res) => res.redirect(req.query.next));`],
    ["prisma-query", `export const page = prisma.invoice.findMany({ take: 20, cursor: { id } });`],
    ["cache", `export async function load(userId, tenantId) { return redis.get('dashboard'); }`],
    ["frontend", `export const View = () => <img src="doctor.png" />;`, "view.tsx"],
    [
        "tenant-clinic",
        `export const load = (req) => pool.query('SELECT id FROM patients WHERE clinicId = $1', [req.session.user.clinicId]);`
    ],
    ["clean", `export const add = (left, right) => left + right;`],
    [
        "upload",
        `app.post('/upload', upload.any(), async (req) => save(req.files[0].originalname, req.files[0].buffer));`
    ],
    [
        "authorization",
        `router.delete('/admin/patients/:id', async (req, res) => { await prisma.patient.delete({ where: { id: req.params.id } }); res.sendStatus(204); });`
    ]
];
for (const [name, source, file = "app.ts"] of PARITY_FIXTURES)
    test(`audit and Ship share application finding identities: ${name}`, async () => {
        await withTemporaryProject(`application-parity-${name}`, async (root) => {
            await writeFile(join(root, file), source, "utf8");
            const { profile, inventory } = await discoverProjectWithInventory(root);
            const revision = await workingTreeRevision(root, inventory);
            const audit = await deriveApplicationInspection({ root, profile, inventory, revision });
            const ship = await deriveShipInspection(root, profile, revision, inventory);
            assert.deepEqual(activeApplicationIds(audit.findings), activeApplicationIds(ship.findings));
        });
    });
function activeApplicationIds(findings) {
    return findings
        .filter((finding) => finding.producer === "forge-analyzer" &&
        finding.status !== "SUPERSEDED" &&
        finding.instance_id !== undefined)
        .map((finding) => finding.instance_id)
        .sort();
}
