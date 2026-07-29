# Fullstack Forge composition runtime

Generated from the same TypeScript implementation used by the npm CLI. Host adapters invoke
`cli/src/composition-entry.js`; it discovers repository evidence, resolves the selected and
suppressed sources under the configured context budget, and writes `.forge/composition.json`.
