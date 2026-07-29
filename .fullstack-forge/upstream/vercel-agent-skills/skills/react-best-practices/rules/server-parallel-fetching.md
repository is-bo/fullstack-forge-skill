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
## Parallel Data Fetching with Component Composition

React Server Components execute sequentially within a tree. Restructure with composition to parallelize data fetching.

**Incorrect (Sidebar waits for Page's fetch to complete):**

```tsx
export default async function Page() {
  const header = await fetchHeader()
  return (
    <div>
      <div>{header}</div>
      <Sidebar />
    </div>
  )
}

async function Sidebar() {
  const items = await fetchSidebarItems()
  return <nav>{items.map(renderItem)}</nav>
}
```

**Correct (both fetch simultaneously):**

```tsx
async function Header() {
  const data = await fetchHeader()
  return <div>{data}</div>
}

async function Sidebar() {
  const items = await fetchSidebarItems()
  return <nav>{items.map(renderItem)}</nav>
}

export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  )
}
```

**Alternative with children prop:**

```tsx
async function Header() {
  const data = await fetchHeader()
  return <div>{data}</div>
}

async function Sidebar() {
  const items = await fetchSidebarItems()
  return <nav>{items.map(renderItem)}</nav>
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Header />
      {children}
    </div>
  )
}

export default function Page() {
  return (
    <Layout>
      <Sidebar />
    </Layout>
  )
}
```
