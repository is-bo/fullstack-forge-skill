import assert from "node:assert/strict";
import test from "node:test";
import { assessCompletionApplicability, normalizeFrontendWorkflow, routeFrontendRequest } from "../src/frontend-routing.js";
const scenarios = [
    {
        request: "Build a healthcare SaaS dashboard",
        evidence: { applicationType: "fullstack", affectedPaths: ["apps/web/dashboard.tsx"] },
        modules: ["frontend", "ui", "ux", "accessibility", "security"],
        references: ["product-and-ux", "dashboards-and-data-visualization"],
        excluded: ["mobile-react-native"],
        workflow: "build",
        scale: "high-risk"
    },
    {
        request: "Create a responsive startup landing page",
        modules: ["frontend", "ui", "ux", "accessibility", "seo"],
        references: ["visual-direction", "responsive-layout"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Design an inventory and POS desktop interface",
        evidence: { applicationType: "frontend" },
        modules: ["frontend", "ui", "ux", "accessibility"],
        references: ["dashboards-and-data-visualization", "responsive-layout"],
        excluded: ["mobile-react-native"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Build a mobile-first appointment booking flow",
        modules: ["frontend", "ux", "accessibility"],
        references: ["forms-and-data-entry", "responsive-layout"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Review a dense admin table with filters and bulk actions",
        evidence: { affectedPaths: ["src/components/AdminTable.tsx"] },
        modules: ["frontend", "ui", "ux", "accessibility", "authorization", "security", "queries"],
        references: ["forms-and-data-entry", "dashboards-and-data-visualization", "design-review"],
        excluded: ["mobile-react-native"],
        workflow: "audit",
        scale: "high-risk"
    },
    {
        request: "Improve an existing React app with inconsistent styling",
        modules: ["frontend", "ui", "accessibility"],
        references: ["react-nextjs", "design-review", "anti-patterns"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "fix",
        scale: "standard"
    },
    {
        request: "Audit a Next.js app with performance and hydration problems",
        modules: ["frontend", "performance", "accessibility"],
        references: ["react-nextjs", "frontend-performance"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "audit",
        scale: "standard"
    },
    {
        request: "Build a React Native Expo application",
        modules: ["frontend", "ui", "ux", "offline", "performance", "accessibility"],
        references: ["mobile-react-native", "motion-and-interactions"],
        excluded: ["dashboards-and-data-visualization"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Implement an Arabic RTL and French interface",
        modules: ["frontend", "ui", "i18n", "accessibility"],
        references: ["responsive-layout", "accessibility-integration"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Accessibility review of a form",
        modules: ["frontend", "ui", "ux", "accessibility"],
        references: ["forms-and-data-entry", "design-review"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "audit",
        scale: "standard"
    },
    {
        request: "Change the primary button spacing",
        modules: ["frontend", "ui", "accessibility"],
        excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
        workflow: "build",
        scale: "small"
    },
    {
        request: "Add sorting and bulk actions to the React appointments table",
        modules: ["frontend", "ui", "ux", "accessibility", "queries"],
        references: ["react-nextjs", "dashboards-and-data-visualization"],
        excluded: ["mobile-react-native"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Create a responsive booking page",
        modules: ["frontend", "ui", "ux", "accessibility"],
        references: ["responsive-layout", "forms-and-data-entry"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Update the Next.js appointment component",
        modules: ["frontend", "accessibility"],
        references: ["component-architecture", "react-nextjs"],
        workflow: "build",
        scale: "standard"
    },
    {
        request: "Improve the plain HTML interface",
        modules: ["frontend", "ui", "accessibility"],
        references: ["component-architecture", "design-review"],
        workflow: "fix",
        scale: "standard"
    },
    {
        request: "Add a button that lets administrators delete a patient",
        modules: [
            "frontend",
            "ui",
            "ux",
            "accessibility",
            "authorization",
            "security",
            "database",
            "recovery"
        ],
        workflow: "build",
        scale: "high-risk"
    },
    {
        request: "Audit an internal server library",
        area: "frontend",
        modules: ["frontend", "accessibility"],
        workflow: "audit",
        scale: "standard"
    },
    {
        request: "Review the React admin interface user flow, visual design, accessibility, permissions, and sensitive data handling",
        modules: ["frontend", "ui", "ux", "accessibility", "authorization", "security"],
        workflow: "audit",
        scale: "high-risk"
    }
];
// Explicit frontend selection is represented by the scenario with area: "frontend" above.
for (const scenario of scenarios) {
    test(`routes scenario proportionately: ${scenario.request}`, () => {
        const route = routeFrontendRequest(scenario.request, scenario.area, scenario.evidence);
        assert.equal(route.active, true);
        assert.equal(route.workflow, scenario.workflow);
        assert.equal(route.scale, scenario.scale);
        for (const module of scenario.modules)
            assert.ok(route.modules.includes(module), `missing module ${module}`);
        for (const reference of scenario.references ?? [])
            assert.ok(route.references.includes(reference), `missing reference ${reference}`);
        for (const reference of scenario.excluded ?? [])
            assert.ok(!route.references.includes(reference), `unexpected reference ${reference}`);
        assert.ok(route.reasons.length > 0);
    });
}
for (const request of [
    "Change the database table schema for appointment status",
    "Increase the API page size",
    "Update a backend form parser",
    "Refactor a React-independent component in a server library",
    "Change a backend-only service"
]) {
    test(`does not route backend ambiguity to frontend: ${request}`, () => {
        assert.deepEqual(routeFrontendRequest(request), {
            active: false,
            modules: [],
            references: [],
            workflow: "audit",
            scale: "standard",
            reasons: []
        });
    });
}
test("uses affected path and project profile evidence to support ambiguous terms", () => {
    const route = routeFrontendRequest("Update the appointment table", undefined, {
        applicationType: "fullstack",
        affectedPaths: ["apps/web/components/Appointments.tsx"]
    });
    assert.equal(route.active, true);
    assert.ok(route.modules.includes("frontend"));
    assert.ok(route.modules.includes("ui"));
});
for (const request of [
    "The booking page overflows on mobile.",
    "The buttons do not fit on smaller screens.",
    "The text is cut off.",
    "There is horizontal scrolling on my phone.",
    "The appointment form is difficult to use."
]) {
    test(`routes corroborated user-interface symptom language: ${request}`, () => {
        const route = routeFrontendRequest(request, undefined, {
            applicationType: "fullstack",
            frameworks: ["React"],
            affectedPaths: ["src/components/Booking.tsx"]
        });
        assert.equal(route.active, true);
        assert.ok(route.modules.includes("frontend"));
        assert.ok(route.modules.includes("ui"));
        assert.ok(route.modules.includes("accessibility"));
        if (/booking|form|difficult to use/iu.test(request))
            assert.ok(route.modules.includes("ux"));
    });
}
for (const request of [
    "Fix an integer overflow in the backend.",
    "Increase the database page size.",
    "Update the server-side form parser.",
    "Review the dependency component graph."
]) {
    test(`negative backend evidence suppresses symptom-like ambiguity: ${request}`, () => {
        assert.equal(routeFrontendRequest(request).active, false);
    });
}
test("symptom language without repository UI evidence stays inactive", () => {
    assert.equal(routeFrontendRequest("The text is cut off on my phone.", undefined, {
        applicationType: "backend"
    }).active, false);
});
test("keeps a small visual completion contract proportional", () => {
    const route = routeFrontendRequest("Change the primary button spacing");
    const completion = assessCompletionApplicability("Change the primary button spacing", route);
    assert.equal(completion.accessibility.status, "REQUIRED");
    assert.equal(completion["runtime-rendered"].status, "REQUIRED");
    assert.equal(completion.database.status, "NOT_APPLICABLE");
    assert.equal(completion["authentication-authorization"].status, "NOT_APPLICABLE");
    assert.notEqual(completion.database.status, "PASS");
    assert.ok(completion.database.reason.length > 0);
});
test("requires sensitive protected-workflow completion evidence", () => {
    const request = "Add a button that lets administrators delete a patient";
    const completion = assessCompletionApplicability(request);
    assert.equal(completion["authentication-authorization"].status, "REQUIRED");
    assert.equal(completion.database.status, "REQUIRED");
    assert.equal(completion["workflow-states"].status, "REQUIRED");
    assert.equal(completion.security.status, "REQUIRED");
});
test("requires persisted-data and reachable failure-state completion conditions", () => {
    const dataRequest = "Add sorting and bulk actions to the React appointments table";
    assert.equal(assessCompletionApplicability(dataRequest).database.status, "REQUIRED");
    const stateRequest = "Add an error state to the React appointment form";
    assert.equal(assessCompletionApplicability(stateRequest)["workflow-states"].status, "REQUIRED");
});
test("normalizes scoped command aliases without widening modes", () => {
    assert.equal(normalizeFrontendWorkflow("frontend", "build"), "build");
    assert.equal(normalizeFrontendWorkflow("ui", "review"), "audit");
    assert.equal(normalizeFrontendWorkflow("ux", "review"), "audit");
    assert.equal(normalizeFrontendWorkflow("ux", "improve"), "fix");
    assert.throws(() => normalizeFrontendWorkflow("frontend", "deploy"), /Unknown frontend workflow/u);
});
