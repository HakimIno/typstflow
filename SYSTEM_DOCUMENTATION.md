# TypstFlow System Documentation

> **Version**: 2.0.0 (Next.js 16 + React 19)  
> **Thai Summary (บทสรุปภาษาไทย)**: TypstFlow คือ Visual Designer สำหรับสร้าง Report คุณภาพสูง โดยใช้ Typst Engine เป็นตัวขับเคลื่อนเบื้องหลัง ระบบถูกออกแบบมาให้ทำงานแบบ WYSIWYG (What You See Is What You Get) โดยใช้หน่วยวัดเป็นมิลลิเมตร (mm) ทั้งหมด เพื่อความแม่นยำสูงสุดในการจัดพิมพ์

---

## 1. Overview

TypstFlow is a professional-grade visual report designer built on modern web technologies. It allows users to design complex report templates using a drag-and-drop interface and exports them as high-quality PDFs via the **Typst** typesetting engine.

### Key Value Propositions

- **Precision**: Uses a millimeter-based coordinate system for 100% accuracy between the designer and the PDF output.
- **Performance**: High-frequency interaction handling (60fps) and virtualized multi-page canvas.
- **Live Preview**: Instant SVG-based preview powered by Typst WASM.
- **Extensibility**: Logic-driven layout with support for data binding and grouping bands.

---

## 2. Technical Stack

- **Framework**: Next.js 16 (App Router) with React 19.
- **Runtime**: Bun (Package management and execution).
- **Styling**: Tailwind CSS v4 + Vanilla CSS.
- **State Management**: Zustand with `persist` (IndexedDB) for persistent sessions.
- **Drag & Drop**: `@atlaskit/pragmatic-drag-and-drop`.
- **Typing**: Strict TypeScript 5+.
- **Engines**:
  - **Layout**: TypeScript-based `LayoutEngine`.
  - **Code Generation**: `TypstGenerator`.
  - **Output**: Typst WASM (Preview) / Typst CLI (Production PDF).

---

## 3. Architecture

### 3.1 The Engine Layer

The system relies on three core engines to maintain consistency:

1.  **LayoutEngine (`src/lib/engine/layout-engine.ts`)**:
    - Handles all math calculations.
    - Converts between Screen Pixels (px) and Physical Millimeters (mm).
    - Manages grid snapping and DPI compensation.
    - **Rule**: All positions in the store MUST be in `mm`.

2.  **TypstGenerator (`src/lib/engine/typst-generator.ts`)**:
    - Translates the `LayoutSchema` (JSON) into Typst Source Code (`.typ`).
    - Handles data binding resolution and aggregate calculations (SUM, AVG, etc.).
    - Implements the grouping logic for nested reports.

3.  **WASM Bridge (`src/lib/wasm-bridge/`)**:
    - Rust-powered components compiled to WASM for heavy computational tasks (like complex table layout algorithms).

### 3.2 State Management

TypstFlow uses a single source of truth: the **Designer Store** (`src/store/designer-store.ts`).

- **History System**: Every mutation (except high-frequency drags) is recorded via `pushHistory` for undo/redo.
- **Persistence**: State is automatically saved to IndexedDB to survive page refreshes.

---

## 4. Data Model: `LayoutSchema`

The entire report is represented by a single JSON object.

```typescript
// Simplified Structure
{
  id: string,
  page: { size: 'A4', orientation: 'portrait', margin: { ... } },
  zones: {
    header: Zone, // Global header
    footer: Zone  // Global footer
  },
  pages: [
    { id: 'p1', body: Zone } // Page-specific body
  ],
  groups: [
    { id: 'g1', field: 'customer.id', header: Zone, footer: Zone } // Banding
  ],
  variables: [...],
  dataSchema: [...]
}
```

### Components

All elements are `ComponentNode`s, which extend a `BaseComponent` with `x, y, width, height` (all in `mm`).

- **Standard**: `text`, `image`, `line`, `spacer`.
- **Advanced**: `table` (multi-row support), `barcode`, `qr`.
- **Utility**: `page-break-indicator`, `page-number`.

---

## 5. Core Concepts

### 5.1 Coordinate System

TypstFlow uses a **Millimeter-First** approach.

- The browser displays elements in `px`, but the store saves them in `mm`.
- **DPI Calculation**: 96 DPI is standardized. `LayoutEngine` ensures that a 10mm box in the designer is exactly 10mm in the PDF.

### 5.2 Zones and Banding

Reports are divided into **Zones** (Bands):

1.  **Header**: Top of every page.
2.  **Group Headers**: Rendered when a specific data field changes.
3.  **Body (Detail)**: The main content area, repeated for each data row.
4.  **Group Footers**: Rendered at the end of a group (for totals).
5.  **Footer**: Bottom of every page.

---

## 6. Development Guidelines

- **No `any`**: Strictly type everything.
- **Performance**: Use `React.memo` for canvas elements. Use `skipHistory: true` for mouse-move updates.
- **Units**: Never hardcode pixel values for layout. Always use `LayoutEngine.mmToPx()`.
- **Styles**: Use Tailwind v4 for UI, but use the `style` object in the schema for report components.

---

## 7. Directory Structure

- `src/app/`: Next.js Pages (Designer UI).
- `src/components/designer/`: Visual components (Canvas, Toolbar, Panels).
- `src/lib/engine/`: Logic for layout and code generation.
- `src/store/`: Zustand state management.
- `src/types/`: TypeScript interfaces and schemas.
- `src-wasm/`: Rust source code for WASM extensions.

---

_Created for TypstFlow Development Team_

คุณคิดว่าตอนนี้ตัวช่วยการจัดว่างทำไมมันไม่มีประสฺธิภาพเลย @src/components/designer/Ruler.tsx  
 ทำไมไม่สามารถลากตีเส้นเองได้ด้วยอยากได้ตัวช่วยจัดว่าง element ที่อัจริยะสูงประสิธิภาพสูงลื่นไหลเร็วแม่นยำ
