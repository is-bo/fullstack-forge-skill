export const ACTIVATION_START = "<!-- fullstack-forge:automatic-activation:start -->";
export const ACTIVATION_END = "<!-- fullstack-forge:automatic-activation:end -->";
const WORKFLOW = `Fullstack Forge is installed in this repository. For every request that creates,
changes, debugs, optimises, reviews, refactors, migrates, tests, or ships application code,
automatically follow the Fullstack Forge workflow and load only the applicable specialist modules.
The user does not need to invoke Forge explicitly.

Use Forge proportionately: inspect the affected area, choose the smallest relevant module set, and
run focused checks during implementation with one final relevant validation pass. Do not run a full
audit for every tiny edit, overengineer, introduce infrastructure without evidence, repeatedly run
the full suite, claim production readiness without evidence, or ask for unnecessary confirmation.
Use the UNDERSTAND, DISCOVER, SELECT, PLAN, IMPLEMENT, INSPECT, VERIFY, REPORT sequence. Escalate
authentication, authorization, payments, personal data, uploads, destructive migrations, secrets,
and other security-sensitive work to the high-risk workflow. Keep explicit \`forge\` commands
available as optional overrides.

For interface work, automatically load \`forge-frontend\` for components, pages, layouts, browser
state, rendering, React, Next.js, Vue, Svelte, React Native, or Expo; add \`forge-ui\` for visual
design and \`forge-ux\` for journeys and usability. Compose accessibility for every human-facing
change and add i18n, SEO, performance, offline, or security only when relevant. Load focused
frontend references progressively; do not load mobile, dashboard, chart, motion, or framework
guidance without matching evidence.`;
const SECTION = `${ACTIVATION_START}\n\n## Fullstack Forge automatic activation\n\n${WORKFLOW}\n\n${ACTIVATION_END}`;
export const PROJECT_INSTRUCTIONS = {
    agents: { path: ["AGENTS.md"], management: "section", content: SECTION },
    antigravity: { path: ["AGENTS.md"], management: "section", content: SECTION },
    claude: { path: ["CLAUDE.md"], management: "section", content: SECTION },
    gemini: { path: ["GEMINI.md"], management: "section", content: SECTION },
    cursor: {
        path: [".cursor", "rules", "fullstack-forge.mdc"],
        management: "file",
        content: `---\ndescription: Automatically apply Fullstack Forge to software-engineering work\nalwaysApply: true\n---\n\n${SECTION}\n`
    },
    windsurf: {
        path: [".windsurf", "rules", "fullstack-forge.md"],
        management: "file",
        content: `${SECTION}\n`
    },
    github: {
        path: [".github", "instructions", "fullstack-forge.instructions.md"],
        management: "file",
        content: `---\napplyTo: "**"\n---\n\n${SECTION}\n`
    }
};
export function extractManagedSection(content) {
    const start = content.indexOf(ACTIVATION_START);
    const end = content.indexOf(ACTIVATION_END);
    if (start < 0 && end < 0)
        return undefined;
    if (start < 0 ||
        end < start ||
        content.indexOf(ACTIVATION_START, start + 1) >= 0 ||
        content.indexOf(ACTIVATION_END, end + 1) >= 0)
        throw new Error("Malformed or duplicate Fullstack Forge automatic-activation section");
    return content.slice(start, end + ACTIVATION_END.length);
}
export function upsertManagedSection(current, next) {
    const existing = extractManagedSection(current);
    if (existing === undefined) {
        const prefix = current.length === 0 ? "" : `${current.replace(/\s*$/u, "")}\n\n`;
        return `${prefix}${next}\n`;
    }
    return current.replace(existing, next);
}
export function removeManagedSection(current) {
    const existing = extractManagedSection(current);
    if (existing === undefined)
        return current;
    const without = current.replace(existing, "").replace(/^\s+|\s+$/gu, "");
    return without.length === 0 ? "" : `${without}\n`;
}
//# sourceMappingURL=automatic-activation.js.map