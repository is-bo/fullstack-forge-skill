import ts from "typescript";
import type { Confidence, Severity, Status } from "./types.js";
import { lineNumber } from "./utils.js";
import {
  createModuleResolver,
  namespaceRequest,
  type ModuleResolver,
  type ModuleSourceFile,
  type ResolutionBudget
} from "./module-resolution.js";

/**
 * Upload-pipeline analysis.
 *
 * Two defects in the previous implementation motivate this module.
 *
 * The first was a false pass. Any imported function that happened to receive an expression
 * mentioning `file`, `buffer`, `mimetype`, or `originalname` downgraded a proven missing-validation
 * failure to NOT_VERIFIED. A logger, a thumbnailer, a queue publisher, or the storage call itself
 * silenced the finding, because the rule asked what the payload *touched* rather than what decided
 * whether the payload was accepted. Delegation is now decided structurally: a resolved body must
 * actually inspect the bytes, and an unresolved body must actually sit in the acceptance decision.
 *
 * The second was coverage. Discovery was gated on a Multer-shaped `upload.single(...)` call, so a
 * Busboy, Formidable, Next.js `formData()`, raw multipart, presigned S3/GCS, or server-side
 * object-storage pipeline was silently unanalyzed — reported as nothing rather than as unsupported.
 *
 * The status contract is unchanged and is the reason the module exists:
 *  - a proven defect is `FAIL`;
 *  - a proven control is clean, with no finding at all;
 *  - indirection that bounded analysis cannot open is `NOT_VERIFIED`, never a confident failure;
 *  - a flow shape this module does not model is reported as unsupported, not as safe.
 */

/**
 * Structural mirror of the analyzer source record. This module stays wire-in only, so it declares
 * the shape it consumes instead of importing a private type from the analyzer module.
 */
export type UploadSourceRecord = {
  absolute: string;
  path: string;
  content: string;
  hash: string;
  sourceFile: ts.SourceFile;
};

type UploadIssueSpec = {
  id: string;
  analyzer: string;
  section: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  impact: string;
  recommendation: string;
  safeFix: boolean;
  absenceProvesResolution: boolean;
  verification: string[];
  standards: string[];
};

/** Structurally assignable to the analyzer `Issue` type so the caller can push these directly. */
export type UploadIssue = {
  spec: UploadIssueSpec;
  file: UploadSourceRecord;
  status?: Status;
  node?: ts.Node;
  start: number;
  end?: number;
  evidence: string;
  source: string;
  sink: string;
};

/** The analyzer owns the rule catalogue; this module owns when each rule fires. */
export type UploadSpecs = {
  extension: UploadIssueSpec;
  mime: UploadIssueSpec;
  publicStorage: UploadIssueSpec;
  scan: UploadIssueSpec;
  failOpen: UploadIssueSpec;
  filename: UploadIssueSpec;
  limits: UploadIssueSpec;
  directVerify: UploadIssueSpec;
  unsupportedFlow: UploadIssueSpec;
};

export type UploadAnalyzer = (file: UploadSourceRecord, specs: UploadSpecs) => UploadIssue[];

/** Module jumps followed when opening a validation helper. */
const MAX_UPLOAD_HOPS = 3;
/** Distinct modules opened while resolving one upload file's helpers. */
const MAX_UPLOAD_FILES = 12;
/** `export *` branches searched in one barrel module. */
const MAX_UPLOAD_BARREL_BRANCHES = 8;
/** Helper-calls-helper depth followed while looking for byte inspection. */
const MAX_HELPER_DEPTH = 2;

type UploadFamily =
  | "multer"
  | "busboy"
  | "formidable"
  | "next-formdata"
  | "raw-multipart"
  | "presigned-s3"
  | "presigned-gcs"
  | "object-storage";

type RuleKey =
  | "extension"
  | "mime"
  | "publicStorage"
  | "scan"
  | "failOpen"
  | "filename"
  | "limits"
  | "directVerify";

const PARSER_RULES: readonly RuleKey[] = [
  "extension",
  "mime",
  "publicStorage",
  "scan",
  "failOpen",
  "filename",
  "limits"
];

/**
 * Which rules this module claims to decide for each discovered flow shape.
 *
 * A rule left out here is not "passing" for that family — it is out of the evidence this module
 * can produce. Presigned flows never see the bytes server-side, so a scan boundary at signing time
 * would be meaningless; the equivalent question is asked by `directVerify` instead. A server-side
 * object-storage write has already left the parser behind, so parser limits are not its concern.
 */
const FAMILY_RULES: Record<UploadFamily, readonly RuleKey[]> = {
  multer: PARSER_RULES,
  busboy: PARSER_RULES,
  formidable: PARSER_RULES,
  "next-formdata": PARSER_RULES,
  "raw-multipart": PARSER_RULES,
  "presigned-s3": ["extension", "mime", "publicStorage", "failOpen", "filename", "directVerify"],
  "presigned-gcs": ["extension", "mime", "publicStorage", "failOpen", "filename", "directVerify"],
  "object-storage": ["extension", "mime", "publicStorage", "scan", "failOpen", "filename"]
};

/** Tokens that mark an expression as carrying uploaded bytes or client-supplied file metadata. */
const FILE_VALUE =
  /\b(?:attachment|blob|buffer|bytes|chunk|file|filedata|filename|files|formdata|mime|mimetype|mimeType|originalFilename|originalname|newFilename|part|upload)\b/iu;

/** Property names through which a client-declared content type enters the acceptance decision. */
const MIME_PROPERTY = new Set(["contentType", "content_type", "mimetype", "mimeType", "mime_type"]);
/** Ambiguous type properties that count only when their receiver is already a file value. */
const FILE_TYPE_PROPERTY = new Set(["mime", "type"]);

/** Client-supplied name properties whose use in a storage key is the filename defect. */
const CLIENT_NAME =
  /\b(?:originalname|original_name|originalFilename|original_filename|newFilename|filename|file_name|filepath|filePath)\b/u;

/** Library calls that decode or fingerprint the bytes rather than trusting declared metadata. */
const CONTENT_VALIDATION_CALL =
  /^(?:fileTypeFromBuffer|fileTypeFromStream|fileTypeFromFile|fileTypeFromBlob|imageSize|sizeOf|probeImageSize|detectContentType|detectFileType|sniffMimeType|magicNumber|magicBytes|readMagic|isSvg|isBinaryFile|pdfParse|parsePdf)$/u;

/** Buffer reads that only make sense as a magic-number or signature inspection. */
const BYTE_READ =
  /^(?:readUInt8|readUInt16BE|readUInt16LE|readUInt32BE|readUInt32LE|readInt8|readInt16BE|readInt16LE|readInt32BE|readInt32LE)$/u;

/** Durable storage or public release of the bytes. Response helpers are deliberately excluded. */
const RELEASE_CALL =
  /^(?:copyFile|createWriteStream|extract|extractZip|makePublic|move|persist|publish|put|putObject|release|rename|save|setPublic|store|unzip|upload|uploadData|uploadFile|uploadStream)$/iu;

/** Receivers that make an otherwise generic method name an object-storage write. */
const STORAGE_RECEIVER = /\b(?:blob|bucket|container|gcs|minio|r2|s3|spaces|storage)\b/iu;

/** Malware or content-risk gates. */
const SCAN_CALL =
  /^(?:avScan|checkFile|clamscan|isInfected|malwareScan|scan|scanBuffer|scanFile|scanObject|scanStream|virusScan)$/u;
const SCAN_RECEIVER = /\b(?:antivirus|av|clam|clamav|defender|malware|scanner|virus)\b/iu;

/** Bounded resource ceilings, in the parser options or in the acceptance region. */
const LIMIT_KEY =
  /\b(?:bodyLimit|contentLengthRange|content-length-range|fileSize|limits|maxBytes|maxDepth|maxEntries|maxFields|maxFieldsSize|maxFiles|maxFileSize|maxRatio|maxSize|maxTotalFileSize|sizeLimit|timeout)\b/u;

/** Object-literal keys through which a storage destination is expressed. */
const KEY_PROPERTY = new Set(["Key", "destination", "destinationKey", "key", "objectKey"]);

/** Object locations or grants that publish the bytes. */
const PUBLIC_DESTINATION =
  /public[\\/]|\bpublicPath\b|\bpublicUrl\b|acl\s*:\s*["'`]public|predefinedAcl\s*:\s*["'`]public|public\s*:\s*true|\bmakePublic\b|["'`]public-read["'`]/iu;

/** Server-side confirmation that the object a client uploaded is what the server expected. */
const OBJECT_VERIFICATION =
  /\b(?:headObject|HeadObjectCommand|getObject|GetObjectCommand|getMetadata|statObject|headBlob|getProperties|exists)\b/u;

/**
 * Call roles that consume the bytes rather than decide about them.
 *
 * This list only ever makes a finding stronger: it prevents an unresolved effect from downgrading
 * a proven missing-validation failure. It is never used to prove that a control exists.
 */
const EFFECT_ROLE =
  /^(?:add|append|archive|audit|cache|capture|checksum|compress|convert|copy|count|create|debug|digest|dispatch|emit|encode|encrypt|enqueue|error|extract|forward|hash|index|info|insert|log|metric|monitor|move|notify|observe|optimise|optimize|persist|pipe|post|process|publish|push|put|queue|record|register|rename|render|report|resize|save|send|set|sign|store|stream|thumbnail|touch|trace|track|transform|unzip|update|upload|warn|write)(?![a-z])/u;

/** Multipart parsers this module does not model. Their presence is reported, never assumed safe. */
const UNSUPPORTED_PARSER_PACKAGES = new Set([
  "@fastify/multipart",
  "@koa/multer",
  "connect-multiparty",
  "express-fileupload",
  "koa-body",
  "multiparty"
]);

type UploadFlow = {
  family: UploadFamily;
  /** Node the flow-level findings are anchored to. */
  anchor: ts.Node;
  /** Subtree that constitutes the acceptance decision for this flow. */
  region: ts.Node;
  /** Parser configuration object, when one can be resolved from the parser construction. */
  options?: ts.Node;
};

/** What bounded analysis could establish about decoded-content validation for one flow. */
type ContentVerdict =
  | { kind: "proven"; node: ts.Node }
  | { kind: "unresolved"; label: string; node: ts.Node }
  | { kind: "absent" };

type FileIndex = {
  file: UploadSourceRecord;
  sourceFile: ts.SourceFile;
  /** One-level variable aliases, so a storage key held in a local is still readable. */
  aliases: Map<string, string>;
  /** Names bound by a static import, a `require`, or an awaited dynamic `import()`. */
  importedNames: Set<string>;
  /** Names bound by an awaited dynamic `import()`, which bounded analysis never opens. */
  dynamicNames: Set<string>;
  /** Locals holding the uploaded value, so `const doc = form.get("doc")` stays a file value. */
  fileBindings: Set<string>;
};

export function createUploadAnalyzer(files: readonly UploadSourceRecord[]): UploadAnalyzer {
  const modules = createModuleResolver(files, {
    hops: MAX_UPLOAD_HOPS,
    files: MAX_UPLOAD_FILES,
    barrelBranches: MAX_UPLOAD_BARREL_BRANCHES
  });
  return (file, specs) => analyzeUploads(file, specs, modules);
}

function analyzeUploads(
  file: UploadSourceRecord,
  specs: UploadSpecs,
  modules: ModuleResolver
): UploadIssue[] {
  const index = buildFileIndex(file);
  const flows = discoverFlows(index);
  if (flows.length === 0) return unsupportedParserIssues(index, specs);

  const issues: UploadIssue[] = [];
  for (const flow of flows) issues.push(...evaluateFlow(index, flow, specs, modules));

  // Two flows over the same handler (a parser and the storage call it feeds) describe one
  // pipeline, so an identical rule at an identical position is one finding, not two.
  const seen = new Set<string>();
  const unique = issues.filter((candidate) => {
    const key = `${candidate.spec.id} ${candidate.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort(
    (left, right) => left.start - right.start || left.spec.id.localeCompare(right.spec.id)
  );
}

/* -------------------------------------------------------------------------- */
/* File index                                                                 */
/* -------------------------------------------------------------------------- */

function buildFileIndex(file: UploadSourceRecord): FileIndex {
  const sourceFile = file.sourceFile;
  const aliases = new Map<string, string>();
  const importedNames = new Set<string>();
  const dynamicNames = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause === undefined) continue;
      if (clause.name !== undefined) importedNames.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings === undefined) continue;
      if (ts.isNamespaceImport(bindings)) importedNames.add(bindings.name.text);
      else for (const element of bindings.elements) importedNames.add(element.name.text);
    }
  }

  walk(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node)) return;
    const initializer = node.initializer;
    if (initializer === undefined) return;
    if (ts.isIdentifier(node.name) && !isFunctionValue(initializer))
      aliases.set(node.name.text, initializer.getText(sourceFile));
    // `const { assertType } = await import("./x.js")` binds a name whose body bounded analysis
    // never opens. Treating it as ordinary local data would silently drop the indirection.
    const names = bindingNames(node.name);
    if (names.length === 0) return;
    if (isDynamicImport(initializer) || isRequireCall(initializer))
      for (const name of names) {
        importedNames.add(name);
        if (isDynamicImport(initializer)) dynamicNames.add(name);
      }
  });

  return {
    file,
    sourceFile,
    aliases,
    importedNames,
    dynamicNames,
    fileBindings: fileBindings(aliases)
  };
}

/**
 * Locals that hold the uploaded value.
 *
 * `const form = await request.formData()` then `const doc = form.get("doc")` renames the payload
 * twice before the acceptance decision reads `doc.type`. Without following those renames the
 * decision looks like it concerns an unrelated object and the rule silently stops firing.
 */
function fileBindings(aliases: ReadonlyMap<string, string>): Set<string> {
  const bound = new Set<string>();
  for (const [name, initializer] of aliases) if (FILE_VALUE.test(initializer)) bound.add(name);
  // Renames form a short chain in practice; three passes reach a fixpoint without unbounded work.
  for (let pass = 0; pass < 3; pass += 1)
    for (const [name, initializer] of aliases) {
      if (bound.has(name)) continue;
      if ([...bound].some((known) => new RegExp(`\\b${known}\\b`, "u").test(initializer)))
        bound.add(name);
    }
  return bound;
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name))
    return name.elements.flatMap((element) => bindingNames(element.name));
  return [];
}

function isDynamicImport(expression: ts.Expression): boolean {
  const value = ts.isAwaitExpression(expression) ? expression.expression : expression;
  return ts.isCallExpression(value) && value.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function isRequireCall(expression: ts.Expression): boolean {
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "require"
  );
}

function isFunctionValue(expression: ts.Expression): boolean {
  return ts.isArrowFunction(expression) || ts.isFunctionExpression(expression);
}

/* -------------------------------------------------------------------------- */
/* Flow discovery                                                             */
/* -------------------------------------------------------------------------- */

function discoverFlows(index: FileIndex): UploadFlow[] {
  const flows: UploadFlow[] = [];
  const sourceFile = index.sourceFile;
  const multipartLiteral = hasMultipartLiteral(sourceFile);

  walk(sourceFile, (node) => {
    if (ts.isNewExpression(node)) {
      const constructed = node.expression.getText(sourceFile);
      if (/(?:^|\.)Busboy$/u.test(constructed))
        flows.push(streamFlow(index, node, "busboy", node.arguments?.[0]));
      if (/(?:^|\.)IncomingForm$/u.test(constructed))
        flows.push(streamFlow(index, node, "formidable", node.arguments?.[0]));
      return;
    }
    if (!ts.isCallExpression(node)) return;
    const name = callName(node.expression, sourceFile);
    const last = lastSegment(name);

    if (/^(?:any|array|fields|none|single)$/u.test(last) && isParserInstance(index, node)) {
      flows.push({
        family: "multer",
        anchor: node,
        region: acceptanceRegion(node, sourceFile),
        ...optionsOf(parserOptions(index, node))
      });
      return;
    }
    if (last === "busboy" || /(?:^|\.)busboy$/iu.test(name)) {
      flows.push(streamFlow(index, node, "busboy", node.arguments[0]));
      return;
    }
    if (last === "formidable" || last === "IncomingForm") {
      flows.push(streamFlow(index, node, "formidable", node.arguments[0]));
      return;
    }
    if (last === "formData" && isRequestReceiver(node.expression, sourceFile)) {
      flows.push({
        family: "next-formdata",
        anchor: node,
        region: enclosingRegion(node, sourceFile)
      });
      return;
    }
    if (multipartLiteral && isRawBodyCall(node, name, sourceFile)) {
      flows.push({
        family: "raw-multipart",
        anchor: node,
        region: enclosingRegion(node, sourceFile)
      });
      return;
    }
    const presigned = presignedFamily(node, name, index);
    if (presigned !== undefined) {
      flows.push({ family: presigned, anchor: node, region: enclosingRegion(node, sourceFile) });
      return;
    }
    if (isObjectStorageWrite(node, name, index))
      flows.push({
        family: "object-storage",
        anchor: node,
        region: enclosingRegion(node, sourceFile)
      });
  });

  return flows;
}

function optionsOf(options: ts.Node | undefined): { options?: ts.Node } {
  return options === undefined ? {} : { options };
}

/** A Busboy/Formidable pipeline is decided inside the callback that receives the file part. */
function streamFlow(
  index: FileIndex,
  node: ts.Node,
  family: "busboy" | "formidable",
  options: ts.Expression | undefined
): UploadFlow {
  const enclosing = enclosingRegion(node, index.sourceFile);
  const callback = partCallback(enclosing, index.sourceFile);
  return {
    family,
    anchor: node,
    region: callback ?? enclosing,
    ...optionsOf(options)
  };
}

/**
 * The callback a streaming parser hands the file part to.
 *
 * `bb.on("file", handler)` and `form.parse(req, handler)` are the two shapes where the acceptance
 * decision lives in a nested function rather than in the enclosing route handler.
 */
function partCallback(region: ts.Node, sourceFile: ts.SourceFile): ts.Node | undefined {
  let found: ts.Node | undefined;
  walk(region, (node) => {
    if (found !== undefined || !ts.isCallExpression(node)) return;
    const name = lastSegment(callName(node.expression, sourceFile));
    if (name === "on") {
      const event = node.arguments[0];
      if (event === undefined || !ts.isStringLiteralLike(event) || event.text !== "file") return;
      const handler = node.arguments[1];
      if (handler !== undefined && isFunctionValue(handler)) found = handler;
      return;
    }
    if (name === "parse") {
      const handler = node.arguments[1];
      if (handler !== undefined && isFunctionValue(handler)) found = handler;
    }
  });
  return found;
}

/** True when the receiver of `.single(...)`/`.array(...)` is a multipart parser, not a collection. */
function isParserInstance(index: FileIndex, node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const receiver = node.expression.expression;
  if (!ts.isIdentifier(receiver)) return false;
  if (/^(?:multer|upload)/iu.test(receiver.text)) return true;
  const initializer = index.aliases.get(receiver.text);
  return initializer !== undefined && /\bmulter\s*\(/u.test(initializer);
}

/** The options object a parser instance was constructed with, when it is written in this file. */
function parserOptions(index: FileIndex, node: ts.CallExpression): ts.Node | undefined {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  const receiver = node.expression.expression;
  if (!ts.isIdentifier(receiver)) return undefined;
  let found: ts.Node | undefined;
  walk(index.sourceFile, (candidate) => {
    if (found !== undefined) return;
    if (!ts.isVariableDeclaration(candidate)) return;
    if (!ts.isIdentifier(candidate.name) || candidate.name.text !== receiver.text) return;
    const initializer = candidate.initializer;
    if (initializer === undefined || !ts.isCallExpression(initializer)) return;
    found = initializer;
  });
  return found;
}

function isRequestReceiver(expression: ts.Expression, sourceFile: ts.SourceFile): boolean {
  if (!ts.isPropertyAccessExpression(expression)) return false;
  return /^(?:req|request|event\.request|ctx\.req)$/u.test(
    expression.expression.getText(sourceFile)
  );
}

function hasMultipartLiteral(sourceFile: ts.SourceFile): boolean {
  let found = false;
  walk(sourceFile, (node) => {
    if (found || !ts.isStringLiteralLike(node)) return;
    if (node.text.includes("multipart/form-data")) found = true;
  });
  return found;
}

/** Byte collection from the raw request, which only counts once a multipart literal is present. */
function isRawBodyCall(node: ts.CallExpression, name: string, sourceFile: ts.SourceFile): boolean {
  const last = lastSegment(name);
  if (/^(?:getRawBody|arrayBuffer|blob|rawBody|parseMultipart|parseFormData)$/u.test(last))
    return true;
  if (last === "concat" && /^Buffer\b/u.test(name)) return true;
  if (last === "on") {
    const event = node.arguments[0];
    return event !== undefined && ts.isStringLiteralLike(event) && event.text === "data";
  }
  void sourceFile;
  return false;
}

/**
 * Presigned upload grants.
 *
 * A signed URL is only an upload flow when the request that is being signed writes. Signing a
 * `GetObjectCommand` is a read and must not be dragged into upload rules.
 */
function presignedFamily(
  node: ts.CallExpression,
  name: string,
  index: FileIndex
): UploadFamily | undefined {
  const last = lastSegment(name);
  if (
    !/^(?:getSignedUrl|getSignedUrlPromise|createPresignedPost|createPresignedUrl|generateSignedPostPolicyV4)$/u.test(
      last
    )
  )
    return undefined;
  const argumentText = node.arguments.map((value) => expand(value, index)).join(" ");
  const gcs =
    last === "generateSignedPostPolicyV4" ||
    /action\s*:\s*["'`](?:write|resumable)/u.test(argumentText);
  if (gcs) return "presigned-gcs";
  const writes =
    last === "createPresignedPost" ||
    /\b(?:PutObjectCommand|putObject|CreateMultipartUpload|UploadPartCommand)\b/u.test(
      argumentText
    ) ||
    /\bConditions\b|content-length-range/u.test(argumentText);
  return writes ? "presigned-s3" : undefined;
}

function isObjectStorageWrite(node: ts.CallExpression, name: string, index: FileIndex): boolean {
  const last = lastSegment(name);
  const argumentText = node.arguments.map((value) => expand(value, index)).join(" ");
  if (last === "send" && /\bnew\s+PutObjectCommand\b/u.test(argumentText)) return true;
  if (
    !/^(?:createWriteStream|put|putObject|save|upload|uploadData|uploadFile|uploadStream|write)$/u.test(
      last
    )
  )
    return false;
  if (!FILE_VALUE.test(argumentText)) return false;
  return STORAGE_RECEIVER.test(name) || last === "putObject";
}

/**
 * The subtree that constitutes the acceptance decision.
 *
 * When the parser middleware is registered alongside its handler, that handler is the decision.
 * When it is registered on its own — an exported middleware, a handler passed by name — the file
 * is the honest boundary, because the decision could be anywhere in it.
 */
function acceptanceRegion(node: ts.CallExpression, sourceFile: ts.SourceFile): ts.Node {
  const parent = node.parent;
  if (ts.isCallExpression(parent)) {
    const handler = [...parent.arguments].reverse().find((value) => isFunctionValue(value));
    if (handler !== undefined) return handler;
  }
  return enclosingRegion(node, sourceFile);
}

function enclosingRegion(node: ts.Node, sourceFile: ts.SourceFile): ts.Node {
  let current: ts.Node = node.parent;
  while (!ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return sourceFile;
}

/* -------------------------------------------------------------------------- */
/* Rule evaluation                                                            */
/* -------------------------------------------------------------------------- */

function evaluateFlow(
  index: FileIndex,
  flow: UploadFlow,
  specs: UploadSpecs,
  modules: ModuleResolver
): UploadIssue[] {
  const issues: UploadIssue[] = [];
  const rules = new Set(FAMILY_RULES[flow.family]);
  const sourceFile = index.sourceFile;
  const calls = regionCalls(flow.region);
  const releaseStart = firstReleaseStart(index, calls);
  const content = contentVerdict(index, flow, calls, releaseStart, modules);

  if (rules.has("extension")) {
    const extension = extensionDecision(index, flow.region);
    if (extension !== undefined && content.kind !== "proven")
      issues.push(
        graded(
          issue(
            specs.extension,
            index.file,
            extension,
            "original filename extension",
            "upload acceptance branch"
          ),
          content
        )
      );
  }

  if (rules.has("mime")) {
    const mime = mimeTrust(index, flow.region);
    if (mime !== undefined && content.kind !== "proven")
      issues.push(
        graded(
          issue(specs.mime, index.file, mime, "client-provided MIME", "upload acceptance branch"),
          content
        )
      );
  }

  const scan = scanBoundary(calls, sourceFile);

  if (rules.has("publicStorage")) {
    const published = publicRelease(index, flow.region, calls);
    if (
      published !== undefined &&
      (scan === undefined || published.getStart(sourceFile) < scan.getStart(sourceFile))
    )
      issues.push(
        issue(
          specs.publicStorage,
          index.file,
          published,
          "untrusted upload bytes",
          "public storage before approval"
        )
      );
  }

  if (rules.has("scan") && scan === undefined) {
    const candidate = issue(
      specs.scan,
      index.file,
      flow.anchor,
      "upload middleware",
      "durable/released storage"
    );
    // A helper that sits in the acceptance decision but cannot be opened may or may not be the
    // scan boundary. Claiming its absence would be inventing evidence.
    issues.push(graded(candidate, content));
  }

  if (rules.has("failOpen")) {
    const failOpen = failOpenCatch(index, flow.region, sourceFile);
    if (failOpen !== undefined)
      issues.push(
        issue(specs.failOpen, index.file, failOpen, "scanner error", "continued release path")
      );
  }

  if (rules.has("filename")) {
    const named = clientNamedKey(index, flow.region, calls);
    if (named !== undefined)
      issues.push(
        issue(specs.filename, index.file, named, "client original filename", "storage object path")
      );
  }

  if (rules.has("limits") && !hasBoundedLimits(flow, index))
    issues.push(
      issue(
        specs.limits,
        index.file,
        flow.anchor,
        "multipart/archive input",
        "parser and storage resources"
      )
    );

  if (rules.has("directVerify")) {
    const verified = OBJECT_VERIFICATION.test(index.file.content) || scan !== undefined;
    if (!verified) {
      const candidate = issue(
        specs.directVerify,
        index.file,
        flow.anchor,
        "client-uploaded object",
        "server-side object verification"
      );
      // The verifier may legitimately live in a webhook or worker this file never mentions, so
      // absence here is missing evidence rather than a proven gap.
      candidate.status = "NOT_VERIFIED";
      candidate.evidence +=
        " No server-side verification of the uploaded object is written in this file; a verifier in another module is neither proven nor disproven.";
      issues.push(candidate);
    }
  }

  return issues;
}

/** Applies the content-validation verdict to a rule that depends on decoded-content evidence. */
function graded(candidate: UploadIssue, verdict: ContentVerdict): UploadIssue {
  if (verdict.kind !== "unresolved") return candidate;
  candidate.status = "NOT_VERIFIED";
  candidate.evidence += ` The upload payload is passed to imported \`${verdict.label}\`, declared outside this file, so decoded/signature validation is neither proven nor disproven.`;
  return candidate;
}

/* -------------------------------------------------------------------------- */
/* Decoded-content validation                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Whether decoded-content validation guards this flow.
 *
 * Ordering matters as much as presence: validation that runs after the bytes are already stored or
 * released has not protected anything, so only evidence positioned before the first release counts.
 */
function contentVerdict(
  index: FileIndex,
  flow: UploadFlow,
  calls: readonly ts.CallExpression[],
  releaseStart: number,
  modules: ModuleResolver
): ContentVerdict {
  const sourceFile = index.sourceFile;
  const inFile = calls.find(
    (call) =>
      call.getStart(sourceFile) < releaseStart && inspectsBytes(call, index, /* nested */ false)
  );
  if (inFile !== undefined) return { kind: "proven", node: inFile };

  const byteRead = byteInspection(flow.region, index, releaseStart);
  if (byteRead !== undefined) return { kind: "proven", node: byteRead };

  let unresolved: ContentVerdict | undefined;
  for (const call of calls) {
    if (call.getStart(sourceFile) >= releaseStart) continue;
    const candidate = helperCandidate(index, call);
    if (candidate === undefined) continue;
    const resolution = resolveHelper(index, call, candidate, modules);
    if (resolution === "validates") {
      if (verdictEnforced(index, call, resolution)) return { kind: "proven", node: call };
      continue;
    }
    if (resolution === "opaque" && unresolved === undefined && isAcceptanceGate(index, call))
      unresolved = { kind: "unresolved", label: candidate, node: call };
  }
  return unresolved ?? { kind: "absent" };
}

/**
 * The callee name of a call that could denote a validation helper.
 *
 * Only a bare identifier or a member of a module namespace qualifies. A method on a data value —
 * `file.originalname.endsWith(...)`, `scanner.scan(...)` — is not a candidate helper, because its
 * receiver is a value rather than a module and resolving it would resolve the wrong thing.
 */
function helperCandidate(index: FileIndex, call: ts.CallExpression): string | undefined {
  if (!callTakesFileValue(call, index)) return undefined;
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (!ts.isPropertyAccessExpression(callee)) return undefined;
  const receiver = callee.expression;
  if (!ts.isIdentifier(receiver)) return undefined;
  if (namespaceRequest(index.sourceFile, receiver.text) === undefined) return undefined;
  return `${receiver.text}.${callee.name.text}`;
}

function callTakesFileValue(call: ts.CallExpression, index: FileIndex): boolean {
  return call.arguments.some((argument) => isFileExpression(argument, index));
}

/** True when an expression names the uploaded bytes, directly or through a tracked rename. */
function isFileExpression(node: ts.Node, index: FileIndex): boolean {
  if (FILE_VALUE.test(node.getText(index.sourceFile))) return true;
  let found = false;
  walk(node, (child) => {
    if (found || !ts.isIdentifier(child)) return;
    if (index.fileBindings.has(child.text)) found = true;
  });
  return found;
}

type HelperResolution = "validates" | "inert" | "opaque";

/**
 * Reads the body a helper name actually refers to.
 *
 * `validates` requires the resolved body to inspect the bytes, directly or through another helper
 * it calls. `inert` means a body was read and it does not validate — the missing-validation
 * finding stands, because the question was answered. `opaque` means no body was read.
 */
function resolveHelper(
  index: FileIndex,
  call: ts.CallExpression,
  candidate: string,
  modules: ModuleResolver
): HelperResolution {
  const root = candidate.split(".")[0] ?? candidate;
  if (index.dynamicNames.has(root)) return "opaque";
  const budget = modules.budgetFor(index.file);
  const resolved = modules.resolveValue(call.expression, index.file, 0, budget);
  if (resolved.kind === "unresolved") return "opaque";
  return bodyValidates(resolved.fn, resolved.file, modules, budget, 0) ? "validates" : "inert";
}

function bodyValidates(
  fn: ts.FunctionLikeDeclaration,
  owner: ModuleSourceFile,
  modules: ModuleResolver,
  budget: ResolutionBudget,
  depth: number
): boolean {
  const body = fn.body;
  if (body === undefined) return false;
  const scope: FileIndex = {
    file: {
      absolute: owner.path,
      path: owner.path,
      content: owner.content,
      hash: "",
      sourceFile: owner.sourceFile
    },
    sourceFile: owner.sourceFile,
    aliases: new Map(),
    importedNames: new Set(),
    dynamicNames: new Set(),
    fileBindings: new Set()
  };
  const calls = regionCalls(body);
  if (calls.some((call) => inspectsBytes(call, scope, true))) return true;
  if (byteInspection(body, scope, Number.POSITIVE_INFINITY) !== undefined) return true;
  if (depth >= MAX_HELPER_DEPTH) return false;
  return calls.some((call) => {
    const callee = call.expression;
    if (!ts.isIdentifier(callee) && !ts.isPropertyAccessExpression(callee)) return false;
    const nested = modules.resolveValue(callee, owner, 0, budget);
    return (
      nested.kind === "function" &&
      bodyValidates(nested.fn, nested.file, modules, budget, depth + 1)
    );
  });
}

/** A call that decodes or fingerprints the bytes rather than reading declared metadata. */
function inspectsBytes(call: ts.CallExpression, index: FileIndex, nested: boolean): boolean {
  const name = callName(call.expression, index.sourceFile);
  const last = lastSegment(name);
  if (CONTENT_VALIDATION_CALL.test(last)) return true;
  if (/\b(?:fileType|FileType|magic|Magic|mmm)\b/u.test(name) && /^(?:from|detect)/u.test(last))
    return true;
  if (last === "metadata" && /\bsharp\b/u.test(name)) return true;
  // Inside a resolved helper the payload is a parameter, so the argument text no longer names the
  // upload; the call itself is the evidence. At the call site the argument still has to be the file.
  return nested ? false : callTakesFileValue(call, index) && BYTE_READ.test(last);
}

/** Direct magic-byte reads: an indexed or sliced buffer compared against a literal signature. */
function byteInspection(region: ts.Node, index: FileIndex, limit: number): ts.Node | undefined {
  const sourceFile = index.sourceFile;
  let found: ts.Node | undefined;
  walk(region, (node) => {
    if (found !== undefined || node.getStart(sourceFile) >= limit) return;
    if (ts.isCallExpression(node)) {
      const last = lastSegment(callName(node.expression, sourceFile));
      const receiver = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.expression.getText(sourceFile)
        : "";
      if (BYTE_READ.test(last) && FILE_VALUE.test(receiver)) found = node;
      if (
        last === "equals" &&
        /\bBuffer\.from\b/u.test(node.arguments.map((a) => a.getText(sourceFile)).join(" "))
      )
        found = node;
      if (
        (last === "subarray" || last === "slice") &&
        FILE_VALUE.test(receiver) &&
        comparedToLiteral(node)
      )
        found = node;
      return;
    }
    if (
      ts.isElementAccessExpression(node) &&
      FILE_VALUE.test(node.expression.getText(sourceFile)) &&
      ts.isNumericLiteral(node.argumentExpression) &&
      comparedToLiteral(node)
    )
      found = node;
  });
  return found;
}

/** True when the value is (possibly after a `.toString(...)` hop) compared against a literal. */
function comparedToLiteral(node: ts.Node): boolean {
  let current: ts.Node = node.parent;
  for (let step = 0; step < 4 && !ts.isSourceFile(current); step += 1) {
    if (ts.isBinaryExpression(current)) {
      const operator = current.operatorToken.kind;
      const comparison =
        operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        operator === ts.SyntaxKind.EqualsEqualsToken ||
        operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        operator === ts.SyntaxKind.ExclamationEqualsToken;
      if (comparison) return true;
    }
    if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
      current = current.parent;
      continue;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Whether a proven validator's answer actually gates acceptance.
 *
 * A helper that throws or answers the request enforces itself. A helper that only returns a
 * verdict enforces nothing unless the caller reads that verdict, so a discarded verdict leaves the
 * finding standing rather than clearing it.
 */
function verdictEnforced(
  index: FileIndex,
  call: ts.CallExpression,
  resolution: HelperResolution
): boolean {
  if (resolution !== "validates") return false;
  const statement = enclosingStatement(call);
  if (statement !== undefined && ts.isExpressionStatement(statement)) return true;
  return isAcceptanceGate(index, call);
}

/* -------------------------------------------------------------------------- */
/* Acceptance-decision position                                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether an unopened call participates in the decision to accept the upload.
 *
 * Three shapes count: the returned verdict is tested, the call is the condition of a branch, or the
 * call is a bare statement that can throw before anything is stored. A call whose name says it
 * consumes the bytes — store, log, resize, forward, enqueue, hash, persist — never counts, because
 * an effect is not a decision no matter where it sits.
 */
function isAcceptanceGate(index: FileIndex, call: ts.CallExpression): boolean {
  const name = lastSegment(callName(call.expression, index.sourceFile));
  if (EFFECT_ROLE.test(name)) return false;

  let current: ts.Node = call;
  let parent: ts.Node = call.parent;
  for (let step = 0; step < 6 && !ts.isSourceFile(parent); step += 1) {
    if (
      ts.isAwaitExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isAsExpression(parent)
    ) {
      current = parent;
      parent = parent.parent;
      continue;
    }
    if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken)
      return true;
    if (ts.isBinaryExpression(parent) || ts.isConditionalExpression(parent)) return true;
    if (ts.isIfStatement(parent) && parent.expression === current) return true;
    if (ts.isWhileStatement(parent) && parent.expression === current) return true;
    if (ts.isThrowStatement(parent) || ts.isReturnStatement(parent)) return true;
    if (ts.isExpressionStatement(parent)) return true;
    if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
      current = parent;
      parent = parent.parent;
      continue;
    }
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
      return verdictNameTested(index, parent.name.text, call.getStart(index.sourceFile));
    return false;
  }
  return false;
}

/** True when a name holding a helper's answer is later read as a condition rather than stored. */
function verdictNameTested(index: FileIndex, name: string, after: number): boolean {
  let tested = false;
  walk(index.sourceFile, (node) => {
    if (tested || !ts.isIdentifier(node) || node.text !== name) return;
    if (node.getStart(index.sourceFile) <= after) return;
    let parent: ts.Node = node.parent;
    for (let step = 0; step < 4 && !ts.isSourceFile(parent); step += 1) {
      if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
        parent = parent.parent;
        continue;
      }
      if (
        ts.isBinaryExpression(parent) ||
        ts.isPrefixUnaryExpression(parent) ||
        ts.isIfStatement(parent) ||
        ts.isConditionalExpression(parent) ||
        ts.isWhileStatement(parent)
      ) {
        tested = true;
        return;
      }
      return;
    }
  });
  return tested;
}

function enclosingStatement(node: ts.Node): ts.Statement | undefined {
  let current: ts.Node = node.parent;
  while (!ts.isSourceFile(current)) {
    if (ts.isStatement(current)) return current;
    current = current.parent;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Individual rules                                                           */
/* -------------------------------------------------------------------------- */

/** The first durable write or public release of the bytes, or infinity when there is none. */
function firstReleaseStart(index: FileIndex, calls: readonly ts.CallExpression[]): number {
  const sourceFile = index.sourceFile;
  let earliest = Number.POSITIVE_INFINITY;
  for (const call of calls) {
    const name = callName(call.expression, sourceFile);
    if (!RELEASE_CALL.test(lastSegment(name))) continue;
    const carriesPayload =
      call.arguments.some((argument) => isFileExpression(argument, index)) ||
      FILE_VALUE.test(call.arguments.map((argument) => expand(argument, index)).join(" "));
    if (!carriesPayload && !STORAGE_RECEIVER.test(name)) continue;
    earliest = Math.min(earliest, call.getStart(sourceFile));
  }
  return earliest;
}

function scanBoundary(
  calls: readonly ts.CallExpression[],
  sourceFile: ts.SourceFile
): ts.CallExpression | undefined {
  return calls.find((call) => {
    const name = callName(call.expression, sourceFile);
    return SCAN_CALL.test(lastSegment(name)) || SCAN_RECEIVER.test(name);
  });
}

/**
 * Acceptance decided from the filename's extension rather than from the bytes.
 *
 * The whole region is searched, not just the part before the first release: trusting an extension
 * is the defect wherever it happens, and it is the decoded-content evidence — not the trust site —
 * that has to arrive before the bytes are stored.
 */
function extensionDecision(index: FileIndex, region: ts.Node): ts.Node | undefined {
  const sourceFile = index.sourceFile;
  let found: ts.Node | undefined;
  walk(region, (node) => {
    if (found !== undefined || !ts.isCallExpression(node)) return;
    const name = callName(node.expression, sourceFile);
    const last = lastSegment(name);
    const receiver = ts.isPropertyAccessExpression(node.expression)
      ? expand(node.expression.expression, index)
      : "";
    const argumentText = node.arguments.map((argument) => expand(argument, index)).join(" ");
    if ((last === "endsWith" || last === "match") && CLIENT_NAME.test(receiver)) found = node;
    if (last === "extname" && CLIENT_NAME.test(argumentText)) found = node;
    if (last === "pop" && /\.split\s*\(\s*["'`]\.["'`]\s*\)/u.test(receiver)) found = node;
  });
  return found;
}

/** Client-declared content type entering the acceptance decision. */
function mimeTrust(index: FileIndex, region: ts.Node): ts.Node | undefined {
  let found: ts.Node | undefined;
  walk(region, (node) => {
    if (found !== undefined) return;
    if (ts.isPropertyAccessExpression(node)) {
      const property = node.name.text;
      if (MIME_PROPERTY.has(property)) found = node;
      else if (FILE_TYPE_PROPERTY.has(property) && isFileExpression(node.expression, index))
        found = node;
      return;
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      /content-type/iu.test(node.argumentExpression.text)
    )
      found = node;
  });
  return found;
}

/** A write that publishes the bytes, or a grant that makes the stored object publicly readable. */
function publicRelease(
  index: FileIndex,
  region: ts.Node,
  calls: readonly ts.CallExpression[]
): ts.Node | undefined {
  const sourceFile = index.sourceFile;
  const candidates: ts.Node[] = [];
  for (const call of calls) {
    const name = callName(call.expression, sourceFile);
    const last = lastSegment(name);
    if (last === "makePublic" || last === "setPublic") {
      candidates.push(call);
      continue;
    }
    if (!RELEASE_CALL.test(last)) continue;
    const argumentText = call.arguments.map((argument) => expand(argument, index)).join(" ");
    if (PUBLIC_DESTINATION.test(argumentText)) candidates.push(call);
  }
  // A presigned grant and an SDK command express the destination as an option rather than as a
  // positional argument, so the same publication is invisible to the call-shaped rule above.
  walk(region, (node) => {
    if (!ts.isPropertyAssignment(node)) return;
    if (PUBLIC_DESTINATION.test(expand(node, index))) candidates.push(node);
  });
  return earliest(candidates, sourceFile);
}

/** A storage key built from the client's filename rather than from a server-owned identifier. */
function clientNamedKey(
  index: FileIndex,
  region: ts.Node,
  calls: readonly ts.CallExpression[]
): ts.Node | undefined {
  const sourceFile = index.sourceFile;
  const candidates: ts.Node[] = [];
  for (const call of calls) {
    const last = lastSegment(callName(call.expression, sourceFile));
    if (!RELEASE_CALL.test(last) && last !== "writeFile") continue;
    const key = call.arguments[0];
    if (key !== undefined && CLIENT_NAME.test(expand(key, index))) candidates.push(call);
  }
  walk(region, (node) => {
    if (!ts.isPropertyAssignment(node)) return;
    const name =
      ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : "";
    if (!KEY_PROPERTY.has(name)) return;
    if (CLIENT_NAME.test(expand(node.initializer, index))) candidates.push(node);
  });
  return earliest(candidates, sourceFile);
}

/** The first candidate in source order, so a rule's anchor never depends on discovery order. */
function earliest(nodes: readonly ts.Node[], sourceFile: ts.SourceFile): ts.Node | undefined {
  return nodes.reduce<ts.Node | undefined>(
    (best, node) =>
      best === undefined || node.getStart(sourceFile) < best.getStart(sourceFile) ? node : best,
    undefined
  );
}

/**
 * A scanner error that does not stop the release.
 *
 * The catch has to swallow the failure — no rethrow, no early return, no rejection status — and
 * something after the try has to hand the object on, otherwise the outage is already fail-closed.
 */
function failOpenCatch(
  index: FileIndex,
  region: ts.Node,
  sourceFile: ts.SourceFile
): ts.Node | undefined {
  let found: ts.Node | undefined;
  walk(region, (node) => {
    if (found !== undefined || !ts.isTryStatement(node)) return;
    const clause = node.catchClause;
    if (clause === undefined) return;
    if (scanBoundary(regionCalls(node.tryBlock), sourceFile) === undefined) return;
    const handled = clause.block.getText(sourceFile);
    if (/\b(?:throw|return|reject)\b/u.test(handled)) return;
    if (/\b(?:status|sendStatus|statusCode)\b/u.test(handled)) return;
    const after = index.file.content.slice(node.getEnd());
    if (!/(?:res\.|send|url|release|extract|publish|makePublic)/u.test(after)) return;
    found = clause;
  });
  return found;
}

function hasBoundedLimits(flow: UploadFlow, index: FileIndex): boolean {
  const options = flow.options?.getText(index.sourceFile) ?? "";
  if (LIMIT_KEY.test(options)) return true;
  return LIMIT_KEY.test(flow.region.getText(index.sourceFile));
}

/**
 * A multipart parser this module does not model.
 *
 * Reporting nothing would read as "no upload defects here", which is exactly the false assurance
 * the status contract exists to prevent.
 */
function unsupportedParserIssues(index: FileIndex, specs: UploadSpecs): UploadIssue[] {
  for (const statement of index.sourceFile.statements) {
    const request = importRequest(statement);
    if (request === undefined || !UNSUPPORTED_PARSER_PACKAGES.has(request)) continue;
    const candidate = issue(
      specs.unsupportedFlow,
      index.file,
      statement,
      "unsupported upload parser",
      "upload rule coverage"
    );
    candidate.status = "NOT_VERIFIED";
    candidate.evidence += ` The upload pipeline is built on \`${request}\`, whose acceptance flow this analyzer does not model, so its upload controls are neither proven nor disproven.`;
    return [candidate];
  }
  return [];
}

function importRequest(statement: ts.Statement): string | undefined {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier))
    return statement.moduleSpecifier.text;
  if (!ts.isVariableStatement(statement)) return undefined;
  for (const declaration of statement.declarationList.declarations) {
    const initializer = declaration.initializer;
    if (initializer === undefined || !isRequireCall(initializer)) continue;
    const argument = (initializer as ts.CallExpression).arguments[0];
    if (argument !== undefined && ts.isStringLiteralLike(argument)) return argument.text;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Shared utilities                                                           */
/* -------------------------------------------------------------------------- */

function regionCalls(region: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  walk(region, (node) => {
    if (ts.isCallExpression(node)) calls.push(node);
  });
  return calls;
}

/** One level of alias expansion, so a destination held in a local is still readable as text. */
function expand(node: ts.Node, index: FileIndex): string {
  const parts = [node.getText(index.sourceFile)];
  const seen = new Set<string>();
  walk(node, (child) => {
    if (!ts.isIdentifier(child)) return;
    const value = index.aliases.get(child.text);
    if (value === undefined || seen.has(child.text)) return;
    seen.add(child.text);
    parts.push(value);
  });
  return parts.join(" ");
}

function walk(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => walk(child, callback));
}

function callName(expression: ts.Expression, sourceFile: ts.SourceFile): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression))
    return `${callName(expression.expression, sourceFile)}.${expression.name.text}`;
  if (ts.isCallExpression(expression)) return callName(expression.expression, sourceFile);
  return expression.getText(sourceFile);
}

function lastSegment(name: string): string {
  return name.split(".").at(-1) ?? name;
}

function issue(
  spec: UploadIssueSpec,
  file: UploadSourceRecord,
  node: ts.Node,
  source: string,
  sink: string
): UploadIssue {
  const start = node.getStart(file.sourceFile);
  return {
    spec,
    file,
    node,
    start,
    end: node.getEnd(),
    evidence: `${source} reaches ${sink} at ${file.path}:${lineNumber(file.content, start)}.`,
    source,
    sink
  };
}
