import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  resolveComposition,
  type CompositionEvidence,
  type CompositionManifest,
  type CompositionResult,
  type CompositionSource,
  type CompositionTaskFlag,
  type ModuleComposition
} from "./composition.js";
import type { ModuleSlug } from "./constants.js";
import { PACKAGE_ROOT } from "./constants.js";
import type { Confidence, ProjectProfile } from "./types.js";
import { assertNoSymlinkPath, resolveInside } from "./utils.js";

type ResolvedRuntimeSource = {
  provider: string;
  skill: string;
  runtimePath: string;
};

type RuntimeModuleComposition = ModuleComposition & {
  resolvedSources: ResolvedRuntimeSource[];
};

type RuntimeCompositionManifest = CompositionManifest & {
  modules: RuntimeModuleComposition[];
};

const PROVEN_CONFIDENCE = new Set<Confidence>(["HIGH", "MEDIUM"]);
const COMPOSITION_ARTIFACT = join(".forge", "composition.json");

export function compositionEvidenceFor(
  profile: ProjectProfile,
  input: {
    requested?: string[] | undefined;
    taskFlags?: CompositionTaskFlag[] | undefined;
    riskSurfaces?: string[] | undefined;
  } = {}
): CompositionEvidence {
  const capability = new Set(
    (profile.capability_assessments ?? [])
      .filter((assessment) => assessment.status === "PRESENT")
      .map((assessment) => assessment.capability)
  );
  const provenRisks = (profile.risk_evidence ?? []).filter((entry) =>
    PROVEN_CONFIDENCE.has(entry.confidence)
  );
  const riskSurfaces = new Set(
    (input.riskSurfaces ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)
  );
  if (
    capability.has("frontend") ||
    profile.frameworks.some((record) => PROVEN_CONFIDENCE.has(record.confidence))
  )
    riskSurfaces.add("frontend");
  if (capability.has("api") || provenRisks.some((entry) => entry.modules.includes("api")))
    riskSurfaces.add("api");
  if (capability.has("payments") || provenRisks.some((entry) => entry.modules.includes("payments")))
    riskSurfaces.add("payments");

  const flags: NonNullable<CompositionEvidence["flags"]> = {
    ci: profile.ci.some((record) => PROVEN_CONFIDENCE.has(record.confidence)),
    testingApplicable: profile.tests.some((record) => PROVEN_CONFIDENCE.has(record.confidence)),
    gdprRelevant: provenRisks.some((entry) => entry.risk === "personal-or-medical-data")
  };
  for (const flag of input.taskFlags ?? []) flags[flag] = true;

  return {
    profile,
    requested: [...new Set((input.requested ?? []).map((value) => value.trim()).filter(Boolean))],
    riskSurfaces: [...riskSurfaces].sort(),
    flags
  };
}

export async function resolveRuntimeComposition(
  root: string,
  modules: ModuleSlug[],
  evidence: CompositionEvidence,
  runtimeRootOverride?: string
): Promise<CompositionResult[]> {
  const projectManifestPath = resolveInside(
    root,
    join(".fullstack-forge", "manifests", "module-composition.json")
  );
  const installManifestPath = resolveInside(
    root,
    join(".fullstack-forge", "install-manifest.json")
  );
  const projectInstalled = await pathExists(root, installManifestPath);
  const runtimeRoot =
    runtimeRootOverride ??
    (projectInstalled || (await pathExists(root, projectManifestPath)) ? root : PACKAGE_ROOT);
  const manifestPath = resolveInside(
    runtimeRoot,
    join(".fullstack-forge", "manifests", "module-composition.json")
  );
  await assertNoSymlinkPath(runtimeRoot, manifestPath);
  const manifest = parseRuntimeManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const runtimePathBySource = new Map<string, string>();
  for (const declaration of manifest.modules) {
    for (const source of declaration.resolvedSources) {
      const key = sourceKey(source);
      const previous = runtimePathBySource.get(key);
      if (previous !== undefined && previous !== source.runtimePath)
        throw new Error(`Composition manifest maps ${key} to conflicting runtime paths`);
      runtimePathBySource.set(key, source.runtimePath);
    }
  }

  const declaredPaths = [...new Set(runtimePathBySource.values())];
  const availableRuntimePaths = new Set<string>();
  await Promise.all(
    declaredPaths.map(async (runtimePath) => {
      const absolute = resolveInside(runtimeRoot, runtimePath);
      await assertNoSymlinkPath(runtimeRoot, absolute);
      try {
        await access(absolute);
        availableRuntimePaths.add(runtimePath);
      } catch {
        // Missing paths remain absent so the resolver records damaged-installation provenance.
      }
    })
  );

  const results: CompositionResult[] = [];
  for (const module of modules) {
    const result = resolveComposition({
      manifest,
      module,
      evidence,
      availableRuntimePaths,
      runtimePathFor: (source) => {
        const runtimePath = runtimePathBySource.get(sourceKey(source));
        if (runtimePath === undefined)
          throw new Error(
            `Composition manifest has no resolved runtime path for ${source.provider}/${source.skill}`
          );
        return runtimePath;
      }
    });
    const contractPath = join(
      ".fullstack-forge",
      "skills",
      "fullstack-forge",
      result.selected[0]?.runtimePath ?? ""
    ).replaceAll("\\", "/");
    const contract = result.selected[0];
    if (contract !== undefined) contract.runtimePath = contractPath;
    try {
      const absolute = resolveInside(runtimeRoot, contractPath);
      await assertNoSymlinkPath(runtimeRoot, absolute);
      await access(absolute);
    } catch {
      result.missing.unshift(contractPath);
    }
    results.push(result);
  }
  return results;
}

export async function writeCompositionArtifact(
  root: string,
  results: CompositionResult[]
): Promise<string> {
  const path = resolveInside(root, COMPOSITION_ARTIFACT);
  await assertNoSymlinkPath(root, dirname(path));
  await mkdir(dirname(path), { recursive: true });
  await assertNoSymlinkPath(root, path);
  await writeFile(
    path,
    `${JSON.stringify({ schemaVersion: 1, compositions: results }, null, 2)}\n`,
    "utf8"
  );
  return path;
}

function sourceKey(source: Pick<CompositionSource, "provider" | "skill">): string {
  return `${source.provider}\u0000${source.skill}`;
}

async function pathExists(root: string, path: string): Promise<boolean> {
  await assertNoSymlinkPath(root, path);
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function parseRuntimeManifest(value: unknown): RuntimeCompositionManifest {
  if (value === null || typeof value !== "object")
    throw new Error("Composition manifest must be an object");
  const candidate = value as Partial<RuntimeCompositionManifest>;
  if (
    candidate.schemaVersion !== 2 ||
    !Array.isArray(candidate.modules) ||
    candidate.defaultContextBudget === undefined
  )
    throw new Error("Composition manifest has an unsupported or invalid schema");
  for (const module of candidate.modules) {
    if (
      typeof module.module !== "string" ||
      !Array.isArray(module.primary) ||
      !Array.isArray(module.overlays) ||
      !Array.isArray(module.resolvedSources)
    )
      throw new Error("Composition manifest contains an invalid module declaration");
    for (const source of module.resolvedSources) {
      if (
        typeof source.provider !== "string" ||
        typeof source.skill !== "string" ||
        typeof source.runtimePath !== "string"
      )
        throw new Error(`Composition manifest contains an invalid source for ${module.module}`);
    }
  }
  return candidate as RuntimeCompositionManifest;
}
