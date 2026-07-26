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
const BASE_FRONTEND = /\b(?:front[ -]?end|react|next(?:\.js)?|vue|svelte|component|page|layout|browser|hydration|client state|responsive|mobile[- ]first|form|table|chart|dashboard|react native|expo)\b/iu;
const BASE_UI = /\b(?:ui|interface|component|visual design|redesign|styling|spacing|typography|colou?r|design system|visual consistency|dark mode|icon|motion|landing page|dashboard|polish)\b/iu;
const BASE_UX = /\b(?:ux|user experience|user flow|usability|navigation|form|booking|onboarding|task completion|empty state|feedback|recovery|information architecture|conversion|friction)\b/iu;
const REVIEW = /\b(?:review|audit|improve|fix|inconsistent|existing|preserve|regression)\b/iu;
const BUILD = /\b(?:build|create|implement|add|make|change|update|style|new|design|redesign)\b/iu;
const RULES = [
    {
        pattern: /\b(?:implement|code|develop)\b/iu,
        modules: ["frontend"],
        reason: "Requested interface implementation needs the frontend engineering owner."
    },
    {
        pattern: /\b(?:new|build|create|redesign|landing page|dashboard|booking flow|onboarding)\b/iu,
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
        pattern: /\b(?:vue|svelte|component|component library|design system)\b/iu,
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
        pattern: /\b(?:dashboard|analytics|chart|visualization|visualisation|admin table|data table|inventory|point of sale|pos)\b/iu,
        modules: ["ui", "ux"],
        references: ["dashboards-and-data-visualization", "responsive-layout"],
        reason: "Dense data interfaces need task-led hierarchy, accessible alternatives, and narrow-screen behavior."
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
        pattern: /\b(?:healthcare|medical|payment|authentication|authorization|permission|destructive|financial|sensitive)\b/iu,
        modules: ["security"],
        reason: "High-consequence interface work needs stronger security, recovery, and verification."
    },
    {
        pattern: REVIEW,
        references: ["design-review", "anti-patterns"],
        reason: "Existing-interface work starts from rendered evidence and preserves proven behavior."
    }
];
/**
 * Selects interface disciplines and progressive references from a natural-language request.
 * It does not claim that any inspection, render, or check ran.
 */
export function routeFrontendRequest(request, area) {
    const text = request.trim();
    if (area === undefined &&
        /\b(?:backend[- ]only|no frontend(?: impact)?|without frontend(?: impact)?)\b/iu.test(text))
        return {
            active: false,
            modules: [],
            references: [],
            workflow: "audit",
            scale: "standard",
            reasons: []
        };
    const modules = new Set();
    const references = new Set();
    const reasons = [];
    const frontend = area === "frontend" || BASE_FRONTEND.test(text);
    const ui = area === "ui" || BASE_UI.test(text);
    const ux = area === "ux" || BASE_UX.test(text);
    if (frontend)
        modules.add("frontend");
    if (ui)
        modules.add("ui");
    if (ux)
        modules.add("ux");
    if (!frontend && !ui && !ux)
        return {
            active: false,
            modules: [],
            references: [],
            workflow: "audit",
            scale: "standard",
            reasons: []
        };
    if (frontend || ui || ux) {
        modules.add("accessibility");
        references.add("accessibility-integration");
        reasons.push("Human-facing interface work always composes the accessibility owner.");
    }
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
    const small = /\b(?:small|single|one)[ -](?:component|style|styling|css|token)\b/iu.test(text);
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
//# sourceMappingURL=frontend-routing.js.map