# SPEC.md — TypstFlow: Visual Report Designer

**Version**: 1.0.0  
**Stack**: Next.js 14 · TypeScript · Typst WASM · Pragmatic DnD · Zustand  
**Target**: Developer-friendly visual designer that generates Typst-powered PDFs

---

## 1. Project Overview

TypstFlow คือ visual drag-drop designer สำหรับสร้าง report template ที่ export เป็น PDF คุณภาพสูงผ่าน Typst engine  

### Core Value Proposition
- **Design**: drag-drop เหมือน Jasper/Crystal
- **Quality**: PDF คุณภาพ Typst (ดีกว่า HTML/CSS export)
- **Preview**: live preview แม่นยำ 100% ผ่าน WASM engine เดียวกัน
- **Integration**: API-first ให้ ERP/backend ใดก็ส่ง data มา generate ได้

---

## 2. Tech Stack

```
Frontend:
├── Next.js 14          (App Router)
├── TypeScript 5        (strict mode)
├── Tailwind CSS        (styling)
├── @atlaskit/pragmatic-drag-and-drop (drag-drop)
├── Zustand             (designer state)
├── typst.ts            (Typst WASM — live preview)
└── @radix-ui           (headless UI primitives)

Backend (Next.js API Routes):
├── typst CLI           (server-side PDF export)
├── zod                 (schema validation)
└── node fs/child_process (file management)

Dev Tools:
├── Bun                 (package manager & runner)
├── Vitest              (unit tests)
├── Playwright          (e2e tests)
└── tsx                 (script runner)
```

---

## 3. Data Schema (Single Source of Truth)

### 3.1 LayoutSchema — โครงสร้างหลักของ template

```typescript
// src/types/schema.ts

export interface LayoutSchema {
  id: string
  name: string
  version: string                    // "1.0.0"
  page: PageConfig
  fonts: FontConfig[]
  zones: {
    header: Zone
    body: Zone
    footer: Zone
  }
  variables: VariableDefinition[]    // user-defined reusable values
  dataSchema: DataFieldDefinition[]  // expected input data shape
  metadata: {
    createdAt: string
    updatedAt: string
    author: string
  }
}

export interface PageConfig {
  size: 'A4' | 'A5' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  margin: {
    top: string      // CSS-like: "2cm", "20mm", "56pt"
    bottom: string
    left: string
    right: string
  }
  background?: string   // hex color or image path
}

export interface FontConfig {
  family: string         // "Sarabun", "Noto Sans Thai"
  role: 'body' | 'heading' | 'mono'
  size: number           // pt
  embedded: boolean      // must be true for PDF
}

export interface Zone {
  id: string
  components: ComponentNode[]
  minHeight?: string
  background?: string
  padding?: string
  showOnFirstPageOnly?: boolean   // for header
  showOnLastPageOnly?: boolean    // for footer
}
```

### 3.2 ComponentNode — building block ของ template

```typescript
export type ComponentNode =
  | TextComponent
  | TableComponent
  | ImageComponent
  | LineComponent
  | SpacerComponent
  | RepeaterComponent
  | ColumnLayoutComponent
  | BarcodeComponent
  | SummaryBoxComponent

export interface BaseComponent {
  id: string
  type: ComponentNode['type']
  visible?: BindingExpression        // "{{invoice.show_discount}}"
  marginTop?: string
  marginBottom?: string
  pageBreakBefore?: boolean
}

// --- Text Component ---
export interface TextComponent extends BaseComponent {
  type: 'text'
  content: string                    // "{{customer.name}}" or static
  style: TextStyle
  align?: 'left' | 'center' | 'right' | 'justify'
}

export interface TextStyle {
  fontSize?: number
  fontWeight?: 'regular' | 'medium' | 'bold'
  color?: string                     // hex
  italic?: boolean
  underline?: boolean
  textTransform?: 'none' | 'upper' | 'lower' | 'title'
}

// --- Table Component ---
export interface TableComponent extends BaseComponent {
  type: 'table'
  dataSource: BindingExpression      // "{{invoice.items}}"
  columns: TableColumn[]
  style: TableStyle
  showHeader: boolean
  repeatHeaderOnPage: boolean
  summaryRows?: SummaryRow[]
}

export interface TableColumn {
  id: string
  header: string
  field: string                      // "item.description" relative to dataSource
  width: 'auto' | '1fr' | string     // "30%", "4cm"
  align?: 'left' | 'center' | 'right'
  format?: FormatType
  style?: TextStyle
}

export interface TableStyle {
  headerBackground?: string
  headerTextColor?: string
  alternateRowBackground?: string
  borderColor?: string
  borderWidth?: string
  cellPadding?: string
}

export interface SummaryRow {
  label: string
  value: BindingExpression           // "{{formatTHB(invoice.subtotal)}}"
  style?: TextStyle
  separator?: boolean
}

// --- Image Component ---
export interface ImageComponent extends BaseComponent {
  type: 'image'
  src: string                        // path or "{{company.logo_url}}"
  width?: string
  height?: string
  fit?: 'cover' | 'contain' | 'stretch'
  align?: 'left' | 'center' | 'right'
}

// --- Line Component ---
export interface LineComponent extends BaseComponent {
  type: 'line'
  style?: 'solid' | 'dashed' | 'dotted'
  color?: string
  thickness?: string
}

// --- Spacer Component ---
export interface SpacerComponent extends BaseComponent {
  type: 'spacer'
  height: string
}

// --- Repeater Component ---
export interface RepeaterComponent extends BaseComponent {
  type: 'repeater'
  dataSource: BindingExpression
  children: ComponentNode[]
  columns?: number                   // multi-column layout
}

// --- Column Layout ---
export interface ColumnLayoutComponent extends BaseComponent {
  type: 'columns'
  columns: {
    width: string
    components: ComponentNode[]
  }[]
  gap?: string
}

// --- Barcode Component ---
export interface BarcodeComponent extends BaseComponent {
  type: 'barcode'
  value: BindingExpression
  format: 'qr' | 'code128' | 'ean13' | 'pdf417'
  width?: string
  height?: string
}

// --- Summary Box ---
export interface SummaryBoxComponent extends BaseComponent {
  type: 'summary-box'
  rows: {
    label: string
    value: BindingExpression
    style?: 'normal' | 'subtotal' | 'total' | 'highlight'
  }[]
  width?: string
  align?: 'left' | 'right'
}

// --- Supporting Types ---
export type BindingExpression = string  // "{{...}}" or static string
export type FormatType = 
  | 'text' 
  | 'number' 
  | 'currency-thb' 
  | 'currency-usd'
  | 'date-th'
  | 'date-en'
  | 'percent'
  | 'boolean'
```

### 3.3 Variable & Data Schema Definitions

```typescript
export interface VariableDefinition {
  name: string
  type: 'string' | 'number' | 'boolean' | 'color'
  defaultValue: string | number | boolean
  description?: string
}

export interface DataFieldDefinition {
  path: string           // "invoice.customer.name"
  type: 'string' | 'number' | 'boolean' | 'date' | 'array'
  required: boolean
  description?: string
  example?: unknown
}
```

---

## 4. Zustand Store

```typescript
// src/store/designer-store.ts

interface DesignerState {
  // Schema
  schema: LayoutSchema
  
  // Selection
  selectedComponentId: string | null
  selectedZone: 'header' | 'body' | 'footer' | null
  
  // Preview
  previewData: Record<string, unknown>     // sample data for preview
  previewPages: string[]                   // SVG strings from WASM
  previewStatus: 'idle' | 'compiling' | 'error'
  previewError: string | null
  
  // History (undo/redo)
  history: LayoutSchema[]
  historyIndex: number
  
  // Actions
  addComponent: (zone: ZoneKey, component: ComponentNode) => void
  updateComponent: (id: string, updates: Partial<ComponentNode>) => void
  removeComponent: (id: string) => void
  moveComponent: (id: string, zone: ZoneKey, newIndex: number) => void
  duplicateComponent: (id: string) => void
  
  selectComponent: (id: string | null) => void
  updateSchema: (updates: Partial<LayoutSchema>) => void
  setPreviewData: (data: Record<string, unknown>) => void
  
  undo: () => void
  redo: () => void
  
  // Export
  exportToPDF: () => Promise<void>
  saveSchema: () => Promise<void>
  loadSchema: (schema: LayoutSchema) => void
}

type ZoneKey = 'header' | 'body' | 'footer'
```

---

## 5. Core Functions

### 5.1 Schema → Typst Code Generator

```typescript
// src/lib/schema-to-typst.ts

export function schemaToTypst(
  schema: LayoutSchema,
  data: Record<string, unknown>
): string {
  // Returns complete .typ source code as string
  // Must handle:
  // - Page setup with correct margins
  // - Font embedding
  // - Header/footer zones
  // - All component types
  // - Data binding resolution
  // - Thai formatting functions
}

// Helper: resolve {{expression}} against data
export function resolveBinding(
  expression: BindingExpression,
  data: Record<string, unknown>
): string
```

**Generated Typst Output Example:**

```typst
// AUTO-GENERATED BY TYPSTFLOW — DO NOT EDIT
#import "@preview/tiaoma:0.3.0": qrcode

// === Formatters ===
#let formatTHB(amount) = {
  let rounded = calc.round(amount, digits: 2)
  "฿" + str(rounded)
}
#let formatThaiDate(dateStr) = { /* ... */ }

// === Page Setup ===
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 2cm, right: 2cm),
  header: [
    /* header zone components */
  ],
  footer: [
    /* footer zone components */
  ]
)
#set text(font: "Sarabun", size: 10pt, lang: "th")

// === Data ===
#let data = (
  invoice_no: "INV-2024-001",
  customer: (name: "บริษัท ตัวอย่าง จำกัด"),
  items: (
    (description: "สินค้า A", qty: 2, price: 500, total: 1000),
  ),
  total: 1000
)

// === Body ===
/* body zone components rendered here */
```

### 5.2 Typst WASM Integration

```typescript
// src/lib/typst-wasm.ts

let compiler: TypstCompiler | null = null

export async function initTypstWasm(): Promise<void> {
  // Lazy load WASM bundle (~15-20MB)
  // Cache in module-level variable
}

export async function compileToSVG(
  typSource: string,
  fonts: ArrayBuffer[]
): Promise<{ pages: string[]; error: string | null }> {
  // Returns array of SVG strings (one per page)
}
```

### 5.3 Formatters

```typescript
// src/lib/formatters.ts

export const formatters = {
  formatTHB: (amount: number): string => { /* ฿1,234.56 */ },
  formatTHBWords: (amount: number): string => { /* หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบหกสตางค์ */ },
  formatThaiDate: (date: Date | string): string => { /* ๑๕ มกราคม ๒๕๖๘ */ },
  formatDate: (date: Date | string, locale: 'th' | 'en'): string => {},
  formatNumber: (n: number, decimals?: number): string => {},
  formatPercent: (n: number): string => {},
}
```

---

## 6. API Contracts

### POST /api/export

Request:
```typescript
{
  schema: LayoutSchema
  data: Record<string, unknown>
  options?: {
    filename?: string
    watermark?: string
  }
}
```

Response: `application/pdf` binary stream  
Error: `{ error: string, code: ErrorCode }`

### POST /api/schema/save

Request: `{ schema: LayoutSchema }`  
Response: `{ id: string, savedAt: string }`

### GET /api/schema/:id

Response: `{ schema: LayoutSchema }`

### POST /api/preview (server-side fallback)

Request: `{ schema: LayoutSchema, data: Record<string, unknown> }`  
Response: `{ pages: string[] }` (SVG strings)

---

## 7. UI Component Breakdown

```
Designer Layout:
┌─────────────────────────────────────────────────────┐
│  Toolbar (save, undo/redo, preview mode, export)    │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Palette  │     Canvas               │  Properties   │
│          │                          │  Panel        │
│ [Text]   │  ┌─── HEADER ───┐        │               │
│ [Table]  │  │  components  │        │  (selected    │
│ [Image]  │  └──────────────┘        │   component   │
│ [Line]   │  ┌─── BODY ─────┐        │   settings)   │
│ [Spacer] │  │  components  │        │               │
│ [Column] │  └──────────────┘        │               │
│ [QR]     │  ┌─── FOOTER ───┐        │               │
│ [Summary]│  │  components  │        │               │
│          │  └──────────────┘        │               │
├──────────┴──────────────────────────┴───────────────┤
│  Preview Panel (SVG pages from WASM compile)        │
└─────────────────────────────────────────────────────┘
```

### Component Files
```
src/components/designer/
├── DesignerLayout.tsx        ← master layout (3-panel)
├── Toolbar.tsx               ← top action bar
├── Palette/
│   ├── Palette.tsx           ← component list
│   └── PaletteItem.tsx       ← draggable item
├── Canvas/
│   ├── Canvas.tsx            ← main drop zone
│   ├── Zone.tsx              ← header/body/footer zone
│   ├── ComponentWrapper.tsx  ← selectable + drag handle
│   └── components/           ← visual representation per type
│       ├── TextRenderer.tsx
│       ├── TableRenderer.tsx
│       ├── ImageRenderer.tsx
│       └── ...
├── Properties/
│   ├── PropertiesPanel.tsx   ← container (switches by type)
│   └── panels/
│       ├── TextProperties.tsx
│       ├── TableProperties.tsx
│       ├── PageProperties.tsx
│       └── ...
└── Preview/
    ├── PreviewPanel.tsx      ← compile status + SVG display
    └── PreviewPage.tsx       ← single SVG page renderer
```

---

## 8. Implementation Phases

### Phase 1 — Core Foundation (MVP)
**Goal**: สามารถสร้าง template และ export PDF ได้

- [ ] Project setup (Next.js + TypeScript + Tailwind)
- [ ] Schema types definition (`src/types/schema.ts`)
- [ ] Zustand store skeleton
- [ ] `schemaToTypst()` function สำหรับ: text, table, image, line, spacer
- [ ] API route: `POST /api/export` (server-side typst CLI)
- [ ] Canvas UI: 3 zones, drag-drop ด้วย @atlaskit/pragmatic-drag-and-drop
- [ ] Palette: 6 basic components
- [ ] Properties panel: text + table
- [ ] Static preview (compile on-demand, not live)
- [ ] Sample invoice template

**Definition of Done**: สร้างใบแจ้งหนี้ได้ export PDF ได้

### Phase 2 — Live Preview + Data Binding
**Goal**: preview เห็นผลจริงก่อน export

- [ ] typst.ts WASM integration (lazy load)
- [ ] Live preview panel (debounce 500ms)
- [ ] Data binding UI (`{{field}}` picker)
- [ ] Sample data editor (JSON editor)
- [ ] Expression validator
- [ ] Thai formatters in generated code
- [ ] Conditional visibility
- [ ] Column layout component

**Definition of Done**: แก้ template แล้วเห็น preview ทันที

### Phase 3 — Production Ready
**Goal**: ใช้งานได้จริงใน production

- [ ] Schema save/load (database หรือ file)
- [ ] Template library (3-5 templates สำเร็จรูป)
- [ ] Undo/redo
- [ ] Multi-page preview
- [ ] Repeater component
- [ ] Summary box component
- [ ] Barcode/QR component
- [ ] Thai number-to-text (`formatTHBWords`)
- [ ] Font management UI
- [ ] Export options (filename, watermark)
- [ ] API key authentication สำหรับ export endpoint

---

## 9. Sample Data Structure (สำหรับ Invoice Template)

```json
{
  "company": {
    "name": "บริษัท ไทยเทค โซลูชั่นส์ จำกัด",
    "address": "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
    "tax_id": "0105567123456",
    "phone": "02-123-4567",
    "logo_url": "/logos/company.png"
  },
  "invoice": {
    "number": "INV-2024-00142",
    "date": "2024-11-15",
    "due_date": "2024-12-15",
    "tax_type": "VAT",
    "customer": {
      "name": "บริษัท ลูกค้า ตัวอย่าง จำกัด",
      "address": "456 ถนนพระราม 4 กรุงเทพฯ 10500",
      "tax_id": "0105568234567"
    },
    "items": [
      {
        "description": "บริการพัฒนาซอฟต์แวร์",
        "qty": 1,
        "unit": "งาน",
        "price": 50000,
        "discount": 0,
        "total": 50000
      },
      {
        "description": "บริการดูแลระบบ (1 เดือน)",
        "qty": 1,
        "unit": "เดือน",
        "price": 5000,
        "discount": 500,
        "total": 4500
      }
    ],
    "subtotal": 54500,
    "discount_total": 500,
    "vat_rate": 7,
    "vat_amount": 3815,
    "total": 58315,
    "payment_terms": "ชำระภายใน 30 วัน",
    "notes": "ขอบคุณที่ใช้บริการ"
  }
}
```

---

## 10. Constraints & Rules

### Must Have
- TypeScript strict mode — no `any`
- Zod validation on all API inputs
- Error boundaries on all major UI sections
- Loading states for all async operations
- Mobile-responsive properties panel (tablet minimum)
- Thai font (Sarabun) embedded in all exports

### Must Not
- Never use `innerHTML` with untrusted content
- Never expose typst CLI path in client bundle
- Never store sensitive data in Zustand (persisted to localStorage)
- Never block main thread with WASM compile (use Web Worker)
- Never generate Typst code with template literals without escaping user input

### Performance Targets
- WASM compile + preview: < 1 second for typical invoice
- PDF export API response: < 3 seconds
- Canvas interaction: 60fps (no layout thrash)
- Initial page load: < 3s (WASM loaded lazily)

---

## 11. Environment Variables

```env
# .env.local
TYPST_CLI_PATH=/usr/local/bin/typst          # path to typst binary
TYPST_FONT_DIR=/app/fonts                    # Thai fonts directory
MAX_EXPORT_PAGES=50                          # safety limit
API_SECRET=your-secret-here                  # for export endpoint auth
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 12. Testing Requirements

### Unit Tests (Vitest)
- `schemaToTypst()` — test every component type → valid Typst output
- `resolveBinding()` — test expression resolution edge cases
- `formatters.*` — test all Thai formatting functions
- Schema validation — test Zod schemas with valid/invalid inputs

### Integration Tests
- `POST /api/export` — returns valid PDF binary
- WASM compile — returns correct SVG page count

### E2E Tests (Playwright)
- Drag text component → canvas → see in preview
- Change table data binding → preview updates
- Export PDF → file downloads

---

*End of SPEC.md*
