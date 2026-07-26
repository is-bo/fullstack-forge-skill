export const FRONTEND_REFERENCE_IDS = [
    "product-and-ux",
    "visual-direction",
    "design-system",
    "responsive-layout",
    "accessibility-integration",
    "component-architecture",
    "react-nextjs",
    "frontend-performance",
    "motion-and-interactions",
    "forms-and-data-entry",
    "dashboards-and-data-visualization",
    "mobile-react-native",
    "design-review",
    "anti-patterns"
];
const STRONG_FRONTEND = /\b(?:front[ -]?end|react(?: native)?|next(?:\.js)?|vue|svelte|jsx|tsx|html interface|browser|css|responsive(?: layout| interface)?|mobile[- ]first|hydration|client component|client state|landing page|mobile interface|visual redesign|expo|button)\b/iu;
const STRONG_UI = /\b(?:ui|user interface|html interface|visual design|visual redesign|redesign|styling|spacing|typography|colou?r|design system|visual consistency|dark mode|iconography|landing page|visual polish|button|accessibility)\b/iu;
const STRONG_UX = /\b(?:ux|user experience|user flow|usability|navigation|onboarding|task completion|empty state|feedback|information architecture|conversion|friction)\b/iu;
const AMBIGUOUS_FRONTEND = /\b(?:page|table|form|component|layout|state|dashboard|chart|interface)\b/iu;
const AMBIGUOUS_UI = /\b(?:component|layout|state|dashboard|chart|table|interface)\b/iu;
const AMBIGUOUS_UX = /\b(?:form|booking|recovery|error|state|flow)\b/iu;
const USER_INTERFACE_SYMPTOM = /\b(?:overflows?|horizontal scrolling|scrolls sideways|cut off|does not fit|do not fit|off screen|overlapping|misaligned|hard to read|hard to use|difficult to use|unreadable|on my phone|on mobile|small screen|flickers?|janky|slow page)\b/iu;
const USER_EXPERIENCE_SYMPTOM = /\b(?:hard to use|difficult to use|unreadable|hard to read|flickers?|janky|slow page)\b/iu;
const BACKEND_ONLY = /\b(?:backend|server library|database|schema|migration|prisma|sql|orm|api pagination|api page size|form parser|request parser|service layer|repository layer|integer overflow|buffer overflow|query plan|memory|protocol|package manifest|dependency component graph)\b/iu;
const FRONTEND_PATH = /(?:^|\/)(?:app|pages?|components?|client|frontend|web)(?:\/|$)|\.(?:jsx|tsx|vue|svelte|css|scss|sass|less|html)$/iu;
const REVIEW = /\b(?:review|audit|improve|fix|inconsistent|existing|preserve|regression)\b/iu;
const BUILD = /\b(?:build|create|implement|add|make|change|update|style|new|design|redesign)\b/iu;
const RULES = [
    {
        pattern: /\b(?:implement|code|develop)\b/iu,
        modules: ["frontend"],
        reason: "Requested interface implementation needs the frontend engineering owner."
    },
    {
        pattern: /\b(?:redesign|landing page|dashboard|booking flow|onboarding|new interface)\b/iu,
        modules: ["frontend", "ui", "ux"],
        references: ["product-and-ux", "visual-direction", "design-system", "responsive-layout"],
        reason: "New or substantially redesigned interface work needs product, visual, system, and responsive decisions."
    },
    {
        pattern: /\b(?:react|next(?:\.js)?|jsx|tsx|server component|client component)\b/iu,
        modules: ["frontend"],
        references: ["component-architecture", "react-nextjs", "frontend-performance"],
        reason: "React or Next.js evidence needs framework, composition, and measured performance guidance."
    },
    {
        pattern: /\b(?:vue|svelte|component|component library|design system|html interface)\b/iu,
        modules: ["frontend"],
        references: ["component-architecture"],
        reason: "Component work needs boundary, state, and reuse decisions."
    },
    {
        pattern: /\b(?:performance|bundle|waterfall|hydration|render|slow|latency|core web vitals|large list)\b/iu,
        modules: ["performance"],
        references: ["frontend-performance"],
        reason: "A performance claim needs a budget, baseline, and repeatable measurement."
    },
    {
        pattern: /\b(?:responsive|mobile[- ]first|viewport|breakpoint|desktop|tablet|overflow)\b/iu,
        modules: ["frontend", "ui"],
        references: ["responsive-layout"],
        reason: "Viewport-sensitive work needs explicit adaptation rather than uniform shrinking."
    },
    {
        pattern: /\b(?:forms?|inputs?|validation|booking|appointment|checkout|filters?|bulk actions?|data entry)\b/iu,
        modules: ["ux"],
        references: ["product-and-ux", "forms-and-data-entry"],
        reason: "Data-entry flows need error recovery, input preservation, and state feedback."
    },
    {
        pattern: /\b(?:dashboard|analytics|chart|visualization|visualisation|table|inventory|point of sale|pos)\b/iu,
        modules: ["ui", "ux"],
        references: ["dashboards-and-data-visualization", "responsive-layout"],
        reason: "Dense data interfaces need task-led hierarchy, accessible alternatives, and narrow-screen behavior."
    },
    {
        pattern: /\b(?:sort(?:ing)?|filters?|bulk actions?|pagination|page size|large list)\b/iu,
        modules: ["queries"],
        reason: "Interactive data operations need bounded query and data-shape review."
    },
    {
        pattern: /\b(?:react native|expo|ios|android|native app)\b/iu,
        modules: ["frontend", "ui", "ux", "offline", "performance"],
        references: ["mobile-react-native", "motion-and-interactions", "frontend-performance"],
        reason: "Native mobile work needs platform, unreliable-network, motion, and measured list guidance."
    },
    {
        pattern: /\b(?:motion|animation|transition|gesture|drag|swipe)\b/iu,
        references: ["motion-and-interactions"],
        reason: "Motion needs a state or hierarchy purpose and reduced-motion behavior."
    },
    {
        pattern: /\b(?:arabic|rtl|right[- ]to[- ]left|french|locale|localization|localisation|translation|internationalization|internationalisation)\b/iu,
        modules: ["i18n"],
        references: ["responsive-layout"],
        reason: "Localized interfaces need expansion, direction, and locale-format evidence."
    },
    {
        pattern: /\b(?:public|marketing|landing page|crawl|seo|search discoverability)\b/iu,
        modules: ["seo"],
        reason: "Public indexable routes need conditional search-discoverability review."
    },
    {
        pattern: /\b(?:authentication|login|session|credential)\b/iu,
        modules: ["auth", "security"],
        reason: "Identity-sensitive interface work needs authentication and security evidence."
    },
    {
        pattern: /\b(?:admin(?:istrator)?s?|authorization|permission|protected action|role|ownership)\b/iu,
        modules: ["authorization", "security"],
        reason: "Protected interface actions need authorization at the final server-side sink."
    },
    {
        pattern: /\b(?:delete|destructive|remove patient|healthcare|medical|payment|financial|sensitive|personal data)\b/iu,
        modules: ["ux", "security", "database", "recovery"],
        reason: "High-consequence interface work needs stronger security, recovery, and verification."
    },
    {
        pattern: /\b(?:loading|empty|error|failure|failed|success|permission|partial|offline) state\b/iu,
        modules: ["ux"],
        reason: "Reachable workflow states need explicit feedback and recovery behavior."
    },
    {
        pattern: REVIEW,
        references: ["design-review", "anti-patterns"],
        reason: "Existing-interface work starts from rendered evidence and preserves proven behavior."
    }
];
/**
 * Selects interface disciplines and progressive references from request and repository evidence.
 * It does not claim that any inspection, render, or check ran.
 */
export function routeFrontendRequest(request, area, evidence = {}) {
    const text = request.trim();
    const explicit = area !== undefined;
    const affectedPaths = evidence.affectedPaths ?? [];
    const frameworkEvidence = (evidence.frameworks ?? []).some((value) => /^(?:react|next(?:\.js)?|vue|svelte|react native|expo)$/iu.test(value.trim()));
    const pathEvidence = affectedPaths.some((path) => FRONTEND_PATH.test(path.replaceAll("\\", "/")));
    const profileEvidence = evidence.applicationType === "frontend" ||
        evidence.applicationType === "fullstack" ||
        (evidence.capabilities ?? []).some((value) => /^(?:frontend|browser|ui|user-interface)$/iu.test(value.trim()));
    const repositorySupport = frameworkEvidence || pathEvidence || profileEvidence;
    const reactIndependent = /\breact[- ]independent\b/iu.test(text);
    const strongFrontend = STRONG_FRONTEND.test(text) && !reactIndependent;
    const strongUi = STRONG_UI.test(text);
    const strongUx = STRONG_UX.test(text);
    const userSymptom = USER_INTERFACE_SYMPTOM.test(text);
    const userExperienceSymptom = USER_EXPERIENCE_SYMPTOM.test(text);
    const interfaceCrossCuttingEvidence = /\b(?:arabic|rtl|right[- ]to[- ]left|locale|localization|localisation|translation|internationalization|internationalisation)\b/iu.test(text);
    const backendEvidence = BACKEND_ONLY.test(text) ||
        evidence.applicationType === "backend" ||
        (evidence.applicationType === "library" && !repositorySupport);
    const explicitBackendOnly = /\b(?:backend[- ]only|no frontend(?: impact)?|without frontend(?: impact)?)\b/iu.test(text);
    if (!explicit &&
        (explicitBackendOnly ||
            (backendEvidence && !strongFrontend && !strongUi && !strongUx && !repositorySupport)))
        return inactiveRoute();
    const modules = new Set();
    const references = new Set();
    const reasons = [];
    const supportingEvidence = strongFrontend ||
        strongUi ||
        strongUx ||
        interfaceCrossCuttingEvidence ||
        repositorySupport ||
        (userSymptom && repositorySupport);
    const frontend = area === "frontend" ||
        strongFrontend ||
        (userSymptom && repositorySupport && !backendEvidence) ||
        (AMBIGUOUS_FRONTEND.test(text) && supportingEvidence && !backendEvidence);
    const ui = area === "ui" ||
        strongUi ||
        (userSymptom && repositorySupport && !backendEvidence) ||
        (AMBIGUOUS_UI.test(text) && supportingEvidence && !backendEvidence);
    const ux = area === "ux" ||
        strongUx ||
        (userExperienceSymptom && repositorySupport && !backendEvidence) ||
        (AMBIGUOUS_UX.test(text) && supportingEvidence && !backendEvidence);
    if (frontend)
        modules.add("frontend");
    if (ui)
        modules.add("ui");
    if (ux)
        modules.add("ux");
    if (!frontend && !ui && !ux)
        return inactiveRoute();
    modules.add("accessibility");
    references.add("accessibility-integration");
    reasons.push("Human-facing interface work always composes the accessibility owner.");
    if (explicit)
        reasons.push(`Explicit ${area} selection overrides natural-language routing.`);
    if (repositorySupport)
        reasons.push("Repository profile, framework, capability, or affected-path evidence supports interface routing.");
    for (const rule of RULES) {
        if (!rule.pattern.test(text))
            continue;
        for (const module of rule.modules ?? [])
            modules.add(module);
        for (const reference of rule.references ?? [])
            references.add(reference);
        reasons.push(rule.reason);
    }
    if (ui && references.size === 1)
        references.add("design-system");
    if (ux && !references.has("product-and-ux"))
        references.add("product-and-ux");
    if (frontend && references.size === 1)
        references.add("component-architecture");
    const highRisk = modules.has("security");
    const isolatedVisual = /\b(?:button spacing|spacing|typography|colou?r|css token|style token)\b/iu.test(text) &&
        !/\b(?:data|permission|admin|delete|security|performance|form|network|state|workflow)\b/iu.test(text);
    const small = /\b(?:small|single|one)[ -](?:component|style|styling|css|token)\b/iu.test(text) ||
        isolatedVisual;
    const workflow = /\bverify\b/iu.test(text)
        ? "verify"
        : /\b(?:fix|improve)\b/iu.test(text)
            ? "fix"
            : BUILD.test(text) && !REVIEW.test(text)
                ? "build"
                : "audit";
    return {
        active: modules.size > 0,
        modules: [...modules],
        references: [...references],
        workflow,
        scale: highRisk ? "high-risk" : small ? "small" : "standard",
        reasons
    };
}
/** Applies the shared completion policy without claiming that any condition passed. */
export function assessCompletionApplicability(request, route = routeFrontendRequest(request)) {
    const text = request.trim();
    const has = (module) => route.modules.includes(module);
    const workflowStates = route.active &&
        /\b(?:loading|empty|error|failure|failed|success|permission|partial|offline|submit|save|delete|notify|network|form)\b/iu.test(text);
    const runtimeRendered = route.active &&
        /\b(?:visual|ui|interface|browser|css|responsive|layout|spacing|typography|colou?r|button|render|hydration)\b/iu.test(text);
    return {
        "authentication-authorization": decision(has("auth") || has("authorization"), "The selected workflow changes identity, permissions, or a protected action.", "No identity, permission, tenant, or protected-action boundary was selected."),
        database: decision(has("database") || has("queries"), "The selected workflow reads, writes, filters, sorts, paginates, or deletes persisted data.", "The selected interface change does not affect persisted-data behavior."),
        "workflow-states": decision(workflowStates, "The affected workflow can reach loading, failure, permission, partial, offline, or outcome states.", "No reachable asynchronous or outcome state is introduced by the selected change."),
        accessibility: decision(route.active, "Every human-facing change requires proportionate accessibility evidence.", "No human-facing interface boundary was selected."),
        security: decision(has("security"), "The selected workflow changes a trust boundary or handles sensitive input or data.", "No sensitive input, identity, permission, secret, payment, upload, or personal-data boundary was selected."),
        performance: decision(has("performance"), "The selected workflow changes performance-sensitive behavior or makes a performance claim.", "No performance-sensitive behavior or claim was selected."),
        "runtime-rendered": decision(runtimeRendered, "Correctness depends on observed runtime or rendered interface behavior.", "The selected concern can be established without rendered or runtime behavior.")
    };
}
export function normalizeFrontendWorkflow(area, mode) {
    if (mode === undefined || mode === "")
        return "audit";
    if (mode === "review")
        return "audit";
    if (mode === "improve")
        return "fix";
    if (["build", "audit", "fix", "verify"].includes(mode))
        return mode;
    throw new Error(`Unknown ${area} workflow '${mode}'. Expected build, audit, fix, verify${area === "ui" || area === "ux" ? ", or review" : ""}${area === "ux" ? ", or improve" : ""}.`);
}
function inactiveRoute() {
    return {
        active: false,
        modules: [],
        references: [],
        workflow: "audit",
        scale: "standard",
        reasons: []
    };
}
function decision(required, requiredReason, notApplicableReason) {
    return {
        status: required ? "REQUIRED" : "NOT_APPLICABLE",
        reason: required ? requiredReason : notApplicableReason
    };
}
//# sourceMappingURL=frontend-routing.js.map