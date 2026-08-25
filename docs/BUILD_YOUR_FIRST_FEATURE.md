# Build your first feature

Start with ordinary language. You do not need to choose a slug, risk tier, engineering module, or
evidence format.

```bash
npx --no-install forge build "add appointment reminders"
```

Forge records the original request, derives a safe feature ID, discovers relevant project signals,
and starts the existing evidence-backed Build workflow. Identity, payment, tenant, upload, and other
sensitive signals still raise the risk tier; simple wording never lowers a gate.

Continue the only unfinished feature with:

```bash
npx --no-install forge continue
```

If several features are unfinished, an interactive terminal asks which one to continue. A
noninteractive run lists the choices and refuses to guess.

`forge build` with no request initializes a new project frame when none exists. The agent should ask
only questions that change the product outcome or a safety boundary: who the product serves, its
durable outcome, critical rules, sensitive data or trust boundaries, scale, and constraints.

Build phases are guidance plus enforced checks. A frame or plan is not proof. Completion still
requires current evidence from registered producers, and Build evidence can never approve
`forge ship`.

Use `npx --no-install forge status` at any time. Expert users can still use `forge new`,
`forge feature <slug> ...`, `forge resume`, and `forge migrate build`.
