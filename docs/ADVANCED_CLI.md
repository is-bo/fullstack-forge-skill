# Advanced CLI

The v0.5 simple commands orchestrate the existing trusted engines; they do not replace them. Print
the complete built-in reference with:

```bash
npx forge help advanced
```

Expert entry points remain compatible:

```text
forge new [options]
forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status] [options]
forge resume
forge migrate build [--dry-run|--resume|--rollback]
forge <section> <audit|fix|verify|report> [options]
forge all audit --scope <changed|full|applicable> [options]
forge ship [options]
forge init|update|uninstall|doctor|validate|package|list
forge tool <name> [options]
```

See [CLI_REFERENCE.md](CLI_REFERENCE.md) for every flag, [COMMANDS.md](COMMANDS.md) for behavior,
[BUILD_MODE.md](BUILD_MODE.md) for Build evidence, and [SECURITY_MODEL.md](SECURITY_MODEL.md) for
trust boundaries.
