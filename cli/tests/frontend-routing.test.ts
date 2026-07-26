import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeFrontendWorkflow,
  routeFrontendRequest,
  type FrontendReferenceId
} from "../src/frontend-routing.js";

type Scenario = {
  request: string;
  modules: string[];
  references: FrontendReferenceId[];
  excluded: FrontendReferenceId[];
  workflow: "build" | "audit" | "fix" | "verify";
  scale: "small" | "standard" | "high-risk";
};

const scenarios: Scenario[] = [
  {
    request: "Build a healthcare SaaS dashboard",
    modules: ["frontend", "ui", "accessibility", "security"],
    references: ["product-and-ux", "dashboards-and-data-visualization"],
    excluded: ["mobile-react-native"],
    workflow: "build",
    scale: "high-risk"
  },
  {
    request: "Create a responsive startup landing page",
    modules: ["frontend", "ui", "accessibility", "seo"],
    references: ["visual-direction", "responsive-layout"],
    excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
    workflow: "build",
    scale: "standard"
  },
  {
    request: "Design an inventory and POS desktop interface",
    modules: ["ui", "accessibility"],
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
    modules: ["frontend", "accessibility"],
    references: ["forms-and-data-entry", "dashboards-and-data-visualization", "design-review"],
    excluded: ["mobile-react-native"],
    workflow: "audit",
    scale: "standard"
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
    modules: ["frontend", "offline", "performance", "accessibility"],
    references: ["mobile-react-native", "motion-and-interactions"],
    excluded: ["dashboards-and-data-visualization"],
    workflow: "build",
    scale: "standard"
  },
  {
    request: "Implement an Arabic RTL and French interface",
    modules: ["ui", "i18n", "accessibility"],
    references: ["responsive-layout", "accessibility-integration"],
    excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
    workflow: "build",
    scale: "standard"
  },
  {
    request: "Accessibility review of a form",
    modules: ["ux", "accessibility"],
    references: ["forms-and-data-entry", "design-review"],
    excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
    workflow: "audit",
    scale: "standard"
  },
  {
    request: "Make a small one-component styling change",
    modules: ["frontend", "ui", "accessibility"],
    references: ["component-architecture"],
    excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
    workflow: "build",
    scale: "small"
  },
  {
    request: "Improve an existing UI but preserve functionality",
    modules: ["ui", "accessibility"],
    references: ["design-review", "anti-patterns"],
    excluded: ["mobile-react-native", "dashboards-and-data-visualization"],
    workflow: "fix",
    scale: "standard"
  }
];

for (const scenario of scenarios) {
  test(`routes scenario proportionately: ${scenario.request}`, () => {
    const route = routeFrontendRequest(scenario.request);
    assert.equal(route.active, true);
    assert.equal(route.workflow, scenario.workflow);
    assert.equal(route.scale, scenario.scale);
    for (const module of scenario.modules)
      assert.ok(route.modules.includes(module as never), `missing module ${module}`);
    for (const reference of scenario.references)
      assert.ok(route.references.includes(reference), `missing reference ${reference}`);
    for (const reference of scenario.excluded)
      assert.ok(!route.references.includes(reference), `unexpected reference ${reference}`);
    assert.ok(route.reasons.length > 0);
  });
}

test("does not activate for backend-only work", () => {
  assert.deepEqual(routeFrontendRequest("Change a database migration with no frontend impact"), {
    active: false,
    modules: [],
    references: [],
    workflow: "audit",
    scale: "standard",
    reasons: []
  });
});

test("normalizes scoped command aliases without widening modes", () => {
  assert.equal(normalizeFrontendWorkflow("frontend", "build"), "build");
  assert.equal(normalizeFrontendWorkflow("ui", "review"), "audit");
  assert.equal(normalizeFrontendWorkflow("ux", "review"), "audit");
  assert.equal(normalizeFrontendWorkflow("ux", "improve"), "fix");
  assert.throws(
    () => normalizeFrontendWorkflow("frontend", "deploy"),
    /Unknown frontend workflow/u
  );
});
