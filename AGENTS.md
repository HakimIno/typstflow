# TypstFlow — Universal AI Agent Rules

> Compatible with: **Cursor** (`.cursorrules` / `.mdc`) · **Antigravity** · **Claude Code** · **Windsurf** · **Codex**

---

## ⚠️ Critical: Read Before Writing Any Code

<!-- BEGIN:nextjs-agent-rules -->
### This is NOT the Next.js you know

This project uses **Next.js 16** with **React 19** — both have breaking API changes from training data.
**Read `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.**
<!-- END:nextjs-agent-rules -->

---

## 1. Project Identity

| Field       | Value                         |
| ----------- | ----------------------------- |
| Name        | TypstFlow                     |
| Runtime     | Next.js 16 + React 19         |
| Language    | TypeScript (strict)           |
| Package Mgr | **Bun** (`bun.lockb`)         |
| Linter      | Biome 1.9.4                   |
| Formatter   | Biome (2-space, single-quote) |
| Test Runner | Vitest                        |
| WASM        | Rust → `wasm-pack` → `src/lib/wasm-bridge/` |

---

## 2. Directory Structure (Canonical)

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── designer/page.tsx   # Main designer UI
│   └── api/                # Server-side API routes
├── components/
│   └── designer/           # All designer UI components (Canvas, Zone, etc.)
│       └── toolbar/        # Toolbar sub-components
├── hooks/                  # Custom React hooks (use-*.ts)
├── lib/
│   ├── engine/             # Core logic: layout-engine.ts, typst-generator.ts, snap-engine.ts
│   ├── templates/          # Built-in report templates
│   ├── utils/              # Pure utility functions (units, paper-sizes, etc.)
│   ├── wasm-bridge/        # Auto-generated WASM bindings — DO NOT EDIT
│   ├── async-storage.ts    # IndexedDB persistence
│   └── typst-wasm.ts       # WASM initialization
├── store/
│   └── designer-store.ts   # Zustand store — single source of truth
└── types/
    └── schema.ts           # Canonical LayoutSchema and all component types
```

**Rules:**
- New utilities → `src/lib/utils/`
- New hooks → `src/hooks/use-<name>.ts`
- New components → `src/components/designer/`
- Never add files to `src/lib/wasm-bridge/` (auto-generated)
- Never create new Zustand stores; extend `designer-store.ts`

---

## 3. Core Data Model

All designer state revolves around `LayoutSchema` (see `src/types/schema.ts`):

```
LayoutSchema
├── page: PageConfig           # Paper size, orientation, margins
├── zones
│   ├── header: Zone           # Global header (shared across pages)
│   └── footer: Zone           # Global footer (shared across pages)
├── pages: PageDefinition[]    # Each page has its own body Zone
│   └── body: Zone
│       └── components: ComponentNode[]
├── variables: VariableDefinition[]
├── dataSchema: DataFieldDefinition[]
└── metadata
```

### Zone Key Convention

| ZoneKey  | Maps To                             |
| -------- | ----------------------------------- |
| `header` | `schema.zones.header`               |
| `footer` | `schema.zones.footer`               |
| `body`   | `schema.pages[n].body` (page-aware) |

Always pass `pageId` when operating on `body` zones.

### Component Types (Discriminated Union)

`text` | `table` | `image` | `line` | `spacer` | `repeater` | `columns` | `barcode` | `qr` | `summary-box` | `page-break-indicator`

All extend `BaseComponent` with `id`, `type`, `x`, `y`, `width`, `height` (all in **mm**).

---

## 4. State Management Rules

- **Single store**: `src/store/designer-store.ts` via Zustand + `persist` (IndexedDB)
- Every schema mutation goes through `pushHistory()` for undo/redo (max 50 steps)
- Pass `skipHistory = true` for high-frequency updates (drag, resize)
- Never mutate `state.schema` directly — always spread: `{ ...state.schema }`
- Body zone updates **require** `pageId`; default to `state.activePageId || schema.pages[0].id`

---

## 5. Coordinate System

All positions are in **millimeters (mm)**.

| Conversion | Function                                                        |
| ---------- | --------------------------------------------------------------- |
| px → mm    | `LayoutEngine.pxToMm(px)`                                       |
| mm → px    | `LayoutEngine.mmToPx(mm)`                                       |
| Snap       | `LayoutEngine.snap(mm)`                                         |
| Full calc  | `LayoutEngine.calculateDropPosition(clientX, clientY, context)` |

**DPI**: Standardised at 96 DPI. Never hardcode pixel conversions.

---

## 6. Coding Standards

### TypeScript
- Strict mode. No `@ts-ignore` unless absolutely unavoidable (add comment explaining why).
- Use `import type` for type-only imports (`Biome: useImportType: error`).
- Discriminated unions via `comp.type` — use `switch` exhaustively.
- `noExplicitAny` is **off** for WASM bridge only; elsewhere prefer explicit types.

### React
- Components are functional. No class components.
- Memoize with `React.memo`, `useMemo`, `useCallback` for designer canvas components.
- Prefer named exports; use default export only for Next.js pages.
- Event handlers: prefix with `handle` (`handleDrop`, `handleMouseMove`).
- High-frequency handlers (drag, resize) → use `skipHistory: true` in store.

### Styling
- Tailwind CSS v4 + custom CSS in `src/app/globals.css`
- Use `clsx` + `tailwind-merge` (`cn()` utility) for conditional classes
- Dark mode is the default theme; respect `theme` from store

### Biome Rules (enforced in CI)
- `noUnusedImports`: **error** — remove all dead imports
- `noUnusedVariables`: **warn**
- `useImportType`: **error** — type imports must use `import type`
- `noNonNullAssertion`: **warn** — use optional chaining instead
- Single quotes, 2-space indent, 100-char line width, trailing commas (ES5), semicolons always

---

## 7. Engine Rules

### LayoutEngine (`src/lib/engine/layout-engine.ts`)
- Pure computation — no DOM side-effects in math functions
- `calculateDropPosition` handles scroll, scale, DPI compensation
- `calculateAbsolutePosition` reads `[data-paper-container][data-page-id]` from DOM

### TypstGenerator (`src/lib/engine/typst-generator.ts`)
- Generates valid Typst source from `LayoutSchema`
- Sanitize all user content through `escapeTypst()`
- Resolve `{{binding}}` expressions via `resolveBinding()`

### WASM Bridge (`src/lib/wasm-bridge/`)
- **DO NOT EDIT** — auto-generated from `src-wasm/` via `bun run build:wasm`
- Use wrappers: `src/lib/typst-wasm.ts` and `src/lib/wasm-layout-engine.ts`
- WASM calls are async; always `await` and handle errors

---

## 8. Testing Rules

**Test runner**: Vitest  
**Test location**: `src/__tests__/` (unit) or co-located `*.test.ts` files  
**Run tests**: `bun test` or `bunx vitest`

### What to Test
- All functions in `src/lib/engine/` (pure math — easy to unit test)
- `src/lib/utils/` utility functions
- `src/types/schema.ts` shape validation
- Store action logic (create store instance in tests, call actions, assert state)
- Typst code generation output

### What NOT to Test in Unit Tests
- DOM-dependent functions (`createContextFromElement`, `setupDpiMonitoring`)
- WASM bridge (integration test only)
- Next.js routing

---

## 9. Git & Branch Rules

| Branch   | Purpose                   |
| -------- | ------------------------- |
| `main`   | Production-ready releases |
| `dev`    | Integration branch        |
| `feat/*` | Feature branches          |
| `fix/*`  | Bug fix branches          |

- **Never** commit directly to `main`
- Commit format: `type(scope): description` — e.g., `feat(canvas): add multi-select marquee`
- Types: `feat` | `fix` | `refactor` | `test` | `docs` | `chore`

---

## 10. Performance Rules

- Drag handlers: use `skipHistory = true` + direct DOM mutation for overlay feedback
- Avoid re-rendering the whole canvas; update only the affected component via `updateComponent`
- Canvas components should be memoized (`React.memo`)
- `TransientOverlay` for ephemeral drag visuals (no React state updates)
- Worker thread for Typst compilation: `src/lib/worker/typst.worker.ts`

---

## 11. Common Patterns

### Adding a New Component Type
1. Add interface extending `BaseComponent` in `src/types/schema.ts`
2. Add to `ComponentNode` discriminated union
3. Handle in `TypstGenerator.getComponentBody()` switch
4. Add preview renderer in `src/components/designer/ComponentPreview.tsx`
5. Add palette entry in `src/components/designer/Palette.tsx`
6. Write unit test in `src/__tests__/schema.test.ts`

### Updating Store State
```ts
// Correct ✅
set((state) => {
  const newSchema = { ...state.schema };
  // ... mutation
  return skipHistory ? { schema: newSchema } : pushHistory(state, newSchema);
});

// Wrong ❌
set({ schema: { ...currentSchema, newField: value } }); // loses history
```

### Reading Zone Components
```ts
// Correct — page-aware ✅
const components =
  zoneKey === 'body'
    ? schema.pages.find((p) => p.id === pageId)?.body.components ?? []
    : schema.zones[zoneKey].components;
```

---

## 12. What Agents Must NOT Do

- ❌ Edit `src/lib/wasm-bridge/*` files
- ❌ Create a second Zustand store
- ❌ Use `useEffect` for state synchronization (use store actions)
- ❌ Hardcode pixel-to-mm ratios (use `LayoutEngine`)
- ❌ Use `any` outside WASM bridge — use proper TypeScript types
- ❌ Commit `.env` or secrets
- ❌ Run `npm install` — use `bun add`
- ❌ Use `next/router` — use `next/navigation` (App Router)
- ❌ Use `require()` in TypeScript files — use `import`
- ❌ Mutate schema without going through store actions
- ❌ Skip tests when adding new engine/util functions
