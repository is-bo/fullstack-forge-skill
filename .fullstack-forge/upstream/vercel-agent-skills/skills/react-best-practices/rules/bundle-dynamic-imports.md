<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

<!-- fullstack-forge:upstream-reference provider=vercel-agent-skills -->

> **Fullstack Forge managed reference.** This is vendored upstream expertise, compiled into
> Forge's managed tree. It is not an independently installable skill and no agent host can
> discover or trigger it: Forge's composition engine decides when it applies. Forge's module
> contract, evidence rules, and status semantics take precedence over anything written here.
## Dynamic Imports for Heavy Components

Use `next/dynamic` to lazy-load large components not needed on initial render.

**Incorrect (Monaco bundles with main chunk ~300KB):**

```tsx
import { MonacoEditor } from './monaco-editor'

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

**Correct (Monaco loads on demand):**

```tsx
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false }
)

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```
