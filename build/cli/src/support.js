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
            "sanitizer bound to the tainted value"
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
        (framework === undefined || entry.framework === framework)) ??
        ANALYZER_SUPPORT.find((entry) => entry.module === module && entry.language === language && entry.framework === "any"));
}
/**
 * Reports the adapters that would be required to give a module executable coverage over the
 * languages a project actually contains.
 */
export function missingAdapters(module, languages) {
    const missing = [];
    for (const language of languages) {
        const support = findSupport(module, language);
        if (support === undefined) {
            missing.push({
                module,
                language,
                framework: "unknown",
                required_adapter: `${slug(language)}-${module}-boundaries`
            });
            continue;
        }
        if (support.coverage === "executable" || support.required_adapter === undefined)
            continue;
        missing.push({
            module,
            language: support.language,
            framework: support.framework,
            required_adapter: support.required_adapter
        });
    }
    return missing;
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
function slug(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-|-$/gu, "");
}
//# sourceMappingURL=support.js.map