/**
 * Structured analyzer support registry.
 *
 * This is the single source of truth for what Fullstack Forge can actually execute. README and
 * generated platform skills are checked against it so documentation cannot claim coverage the
 * runtime does not have.
 *
 * When a module has no adapter for a detected language/framework, the audit reports
 * NOT_VERIFIED and names the missing adapter instead of implying executable coverage.
 */
const JS_TS = "JavaScript/TypeScript";
export const ANALYZER_SUPPORT = [
    {
        module: "security",
        language: JS_TS,
        framework: "any",
        analyzer_id: "js-ts-security",
        coverage: "executable",
        supported_shapes: [
            "local alias and reassignment propagation",
            "object and array destructuring",
            "template literal and string concatenation propagation",
            "same-file function-parameter summaries",
            "typed protection evidence bound to the tainted value"
        ],
        unsupported_shapes: [
            "cross-file taint propagation",
            "dynamic property access computed at runtime",
            "reflection and eval-constructed call targets"
        ]
    },
    {
        module: "authorization",
        language: JS_TS,
        framework: "Express",
        analyzer_id: "js-ts-authorization",
        coverage: "partial",
        supported_shapes: ["literal route registration", "object lookup sinks"],
        unsupported_shapes: ["middleware-inherited policy chains", "runtime policy engines"],
        required_adapter: "express-authorization-boundaries"
    },
    {
        module: "authorization",
        language: JS_TS,
        framework: "any",
        analyzer_id: "js-ts-authorization",
        coverage: "partial",
        supported_shapes: ["object lookup sinks", "structurally connected subject/object guards"],
        unsupported_shapes: ["framework-inherited guards", "runtime policy engines"],
        required_adapter: "js-ts-framework-authorization-boundaries"
    },
    {
        module: "authorization",
        language: "Python",
        framework: "FastAPI",
        analyzer_id: "none",
        coverage: "none",
        supported_shapes: [],
        unsupported_shapes: ["dependency-injected authorization", "decorator-based guards"],
        required_adapter: "fastapi-authorization-boundaries"
    },
    {
        module: "authorization",
        language: "Python",
        framework: "Django",
        analyzer_id: "none",
        coverage: "none",
        supported_shapes: [],
        unsupported_shapes: ["permission classes", "middleware-inherited policy"],
        required_adapter: "django-authorization-boundaries"
    },
    {
        module: "security",
        language: "Go",
        framework: "any",
        analyzer_id: "none",
        coverage: "none",
        supported_shapes: [],
        unsupported_shapes: ["all Go source shapes"],
        required_adapter: "go-security-boundaries"
    },
    {
        module: "security",
        language: "Rust",
        framework: "any",
        analyzer_id: "none",
        coverage: "none",
        supported_shapes: [],
        unsupported_shapes: ["all Rust source shapes"],
        required_adapter: "rust-security-boundaries"
    },
    {
        module: "security",
        language: "Java/Kotlin",
        framework: "any",
        analyzer_id: "none",
        coverage: "none",
        supported_shapes: [],
        unsupported_shapes: ["all JVM source shapes"],
        required_adapter: "jvm-security-boundaries"
    },
    {
        module: "cache",
        language: JS_TS,
        framework: "any",
        analyzer_id: "js-ts-queries-cache",
        coverage: "executable",
        supported_shapes: [
            "inline literal and template cache keys",
            "bounded local aliases and straight-line reassignment",
            "string concatenation and TypeScript expression wrappers",
            "static local object properties and object destructuring"
        ],
        unsupported_shapes: [
            "cross-file and helper-function key construction",
            "dynamic computed object properties",
            "non-linear reassignment and aliases beyond the bounded depth"
        ]
    },
    {
        module: "tenancy",
        language: JS_TS,
        framework: "any",
        analyzer_id: "js-ts-tenancy",
        coverage: "partial",
        supported_shapes: ["ORM query scoping on supported call shapes"],
        unsupported_shapes: ["row-level security policies enforced in the database"],
        required_adapter: "database-rls-tenancy"
    },
    {
        module: "uploads",
        language: JS_TS,
        framework: "any",
        analyzer_id: "js-ts-uploads",
        coverage: "partial",
        supported_shapes: ["multipart configuration", "archive extraction limits"],
        unsupported_shapes: ["provider-side scanner state", "runtime quarantine behaviour"],
        required_adapter: "runtime-upload-pipeline"
    }
];
/** Resolves the support record for a module/language pair, if one is registered. */
export function findSupport(module, language, framework) {
    return (ANALYZER_SUPPORT.find((entry) => entry.module === module &&
        entry.language === language &&
        entry.framework === (framework ?? "any")) ??
        ANALYZER_SUPPORT.find((entry) => entry.module === module && entry.language === language && entry.framework === "any"));
}
/**
 * Reports the adapters that would be required to give a module executable coverage over the
 * languages a project actually contains.
 */
export function missingAdapters(module, languages, frameworks = []) {
    return coverageForDetections(module, languages, frameworks)
        .filter((entry) => entry.coverage !== "executable" && entry.required_adapter !== undefined)
        .map((entry) => ({
        module: entry.module,
        language: entry.language,
        framework: entry.framework,
        required_adapter: entry.required_adapter
    }));
}
export function coverageForProfile(module, profile) {
    return coverageForDetections(module, profile.languages.map((language) => language.name), profile.frameworks.map((framework) => framework.name));
}
export function coverageForDetections(module, languages, frameworks = []) {
    const normalizedLanguages = [...new Set(languages.map(normalizeLanguage))].sort();
    return normalizedLanguages.flatMap((language) => {
        const detectedFrameworks = frameworksForLanguage(language, frameworks);
        return detectedFrameworks.map((framework) => coverageEntry(module, language, framework));
    });
}
function coverageEntry(module, language, framework) {
    const support = findSupport(module, language, framework === "unknown" ? undefined : framework);
    if (support !== undefined) {
        return {
            status: support.coverage === "executable" ? "PASS" : "NOT_VERIFIED",
            module,
            language: support.language,
            framework: support.framework,
            analyzer_id: support.analyzer_id,
            coverage: support.coverage,
            supported_shapes: [...support.supported_shapes],
            unsupported_shapes: [...support.unsupported_shapes],
            ...(support.required_adapter === undefined
                ? {}
                : { required_adapter: support.required_adapter })
        };
    }
    const adapterPrefix = ["unknown", "any"].includes(framework) ? slug(language) : slug(framework);
    return {
        status: "NOT_VERIFIED",
        module,
        language,
        framework,
        analyzer_id: "none",
        coverage: "none",
        supported_shapes: [],
        unsupported_shapes: [`all ${framework === "unknown" ? language : framework} ${module} shapes`],
        required_adapter: `${adapterPrefix}-${module}-boundaries`
    };
}
function frameworksForLanguage(language, frameworks) {
    if (language === "Python") {
        const detected = frameworks.filter((framework) => ["FastAPI", "Django"].includes(framework));
        return detected.length > 0 ? [...new Set(detected)].sort() : ["unknown"];
    }
    if (language === JS_TS)
        return frameworks.includes("Express") ? ["Express"] : ["any"];
    return ["any"];
}
function normalizeLanguage(language) {
    if (["JavaScript", "TypeScript", JS_TS].includes(language))
        return JS_TS;
    if (["Java", "Kotlin", "Java/Kotlin"].includes(language))
        return "Java/Kotlin";
    return language;
}
/** Renders the structured NOT_VERIFIED evidence line for a missing adapter. */
export function describeMissingAdapter(missing) {
    return [
        "NOT_VERIFIED",
        `missing adapter: module=${missing.module}`,
        `language=${missing.language}`,
        `framework=${missing.framework}`,
        `required adapter=${missing.required_adapter}`
    ].join("; ");
}
/** Exact documentation rendering; a test keeps docs/ANALYZER_SUPPORT.md synchronized. */
export function renderSupportRegistryMarkdown() {
    const header = [
        "Module",
        "Language",
        "Framework",
        "Analyzer",
        "Coverage",
        "Required adapter",
        "Supported shapes",
        "Unsupported shapes"
    ];
    const rows = ANALYZER_SUPPORT.map((entry) => [
        entry.module,
        entry.language,
        entry.framework,
        entry.analyzer_id,
        entry.coverage,
        entry.required_adapter ?? "—",
        entry.supported_shapes.join("; ") || "—",
        entry.unsupported_shapes.join("; ") || "—"
    ].map(escapeCell));
    const widths = header.map((heading, index) => Math.max(heading.length, ...rows.map((row) => row[index].length)));
    const renderRow = (cells) => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
    const separator = renderRow(widths.map((width) => "-".repeat(width)));
    return `# Analyzer support registry

This file is rendered from the executable registry in \`cli/src/support.ts\`. The test suite fails if
documentation and runtime support diverge. “Executable” remains bounded by the listed unsupported
shapes and never implies whole-program or runtime proof. Build-mode producer coverage is a separate,
exact \`(script, criterion)\` registry in \`cli/src/build-producers.ts\`; an analyzer row does not by
itself authorize a Build \`PASS\`, and missing producers remain \`NOT_VERIFIED\`.

${renderRow(header)}
${separator}
${rows.map(renderRow).join("\n")}
`;
}
function escapeCell(value) {
    return value.replaceAll("|", "\\|").replace(/\s+/gu, " ").trim();
}
function slug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-|-$/gu, "");
}
//# sourceMappingURL=support.js.map