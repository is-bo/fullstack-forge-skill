export function parseNodeCoverage(output) {
  const files = new Map();
  const directories = [];
  let overall;
  for (const rawLine of output.split(/\r?\n/u)) {
    // Node writes the information glyph as UTF-8. Some Windows capture paths expose its mojibake;
    // accept both forms so the same parser gates Linux, macOS, and Windows.
    const line = rawLine.replace(/^(?:\u2139|\u00e2\u201e\u00b9) ?/u, "");
    if (!line.includes("|")) continue;
    const columns = line.split("|");
    if (columns.length < 4) continue;
    const nameCell = columns[0];
    const lines = number(columns[1]);
    const branches = number(columns[2]);
    const functions = number(columns[3]);
    if (nameCell === undefined) continue;
    const name = nameCell.trim();
    if (name.length === 0 || name === "file" || /^-+$/u.test(name)) continue;
    if (name === "all files") {
      if (lines !== undefined && branches !== undefined && functions !== undefined)
        overall = { lines, branches, functions };
      continue;
    }
    const indent = nameCell.length - nameCell.trimStart().length;
    if (lines === undefined || branches === undefined || functions === undefined) {
      directories.length = indent;
      directories[indent] = name;
      continue;
    }
    const path = [...directories.slice(0, indent), name].join("/");
    files.set(path, { lines, branches, functions });
  }
  if (overall === undefined) throw new Error("Node coverage output contains no overall totals.");
  return { overall, files };
}

export function enforceCoverage(report, thresholds) {
  const failures = [];
  compare("all files", report.overall, thresholds.overall, failures);
  for (const [path, expected] of Object.entries(thresholds.files ?? {})) {
    const actual = report.files.get(path);
    if (actual === undefined) {
      failures.push(`${path}: no coverage record was produced`);
      continue;
    }
    compare(path, actual, expected, failures);
  }
  if (failures.length > 0)
    throw new Error(`Coverage non-regression threshold failed:\n${failures.join("\n")}`);
}

function compare(label, actual, expected, failures) {
  for (const metric of ["lines", "branches", "functions"]) {
    if (actual[metric] + Number.EPSILON < expected[metric])
      failures.push(
        `${label} ${metric}: ${actual[metric].toFixed(2)} < ${expected[metric].toFixed(2)}`
      );
  }
}

function number(value) {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}
