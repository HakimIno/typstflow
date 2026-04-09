# TASK PROMPT — Phase 1 Bootstrap

## Context
อ่าน SPEC.md และ agent-system-prompt.md ก่อนทำงาน

## Task: Bootstrap Phase 1 Foundation

ให้ implement ส่วนต่อไปนี้ตามลำดับ:

---

### Step 1: Project Setup

```bash
/usr/local/bin/bun x create-next-app@latest typstflow \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-git
```

ติดตั้ง dependencies:
```bash
/usr/local/bin/bun add zustand @atlaskit/pragmatic-drag-and-drop \
  @atlaskit/pragmatic-drag-and-drop-react-drop-indicator \
  @atlaskit/pragmatic-drag-and-drop-hitbox \
  tiny-invariant zod @radix-ui/react-select @radix-ui/react-tabs \
  @radix-ui/react-dialog @radix-ui/react-tooltip \
  lucide-react clsx tailwind-merge
```

---

### Step 2: Type Definitions
สร้าง `src/types/schema.ts` — copy จาก Section 3 ของ SPEC.md ทั้งหมด อย่าตัดทอน

---

### Step 3: Formatters
สร้าง `src/lib/formatters.ts` พร้อม implement:
- `formatTHB(amount: number): string` → "฿1,234.56"
- `formatThaiDate(date: string): string` → "15 มกราคม 2568" (ปี พ.ศ.)
- `formatNumber(n: number, decimals: number): string`
- `formatPercent(n: number): string`

ทดสอบด้วย console ก่อน commit

---

### Step 4: Schema to Typst Generator
สร้าง `src/lib/schema-to-typst.ts`

ต้อง handle component types: `text`, `table`, `line`, `spacer`, `image`

เขียน unit test ใน `src/lib/__tests__/schema-to-typst.test.ts`:
- text component → valid typst text block
- table component → valid typst table block  
- empty schema → valid minimal typst document

---

### Step 5: Zustand Store
สร้าง `src/store/designer-store.ts` ตาม Section 4 ของ SPEC.md

---

### Step 6: Export API Route
สร้าง `src/app/api/export/route.ts`

```typescript
// POST /api/export
// รับ { schema, data } → generate .typ file → run typst CLI → return PDF
```

ต้องทำ:
1. Validate input ด้วย Zod
2. เขียน .typ ไปที่ tmp directory
3. Run `typst compile` ด้วย child_process.execSync
4. อ่าน PDF กลับมา
5. Return PDF binary พร้อม correct headers
6. ลบ tmp files เสมอ (ใน finally block)

---

### Step 7: Canvas UI (Basic)
สร้าง designer page ที่แสดง:
- Palette panel ทางซ้าย (6 components)
- Canvas กลาง (3 zones: header/body/footer)
- Properties panel ทางขวา (placeholder ได้)

Drag จาก palette → drop ใน zone ได้
แสดง component ที่ drop แล้วเป็น visual block

---

## Verification Checklist

ก่อนบอกว่าเสร็จ ตรวจสอบ:

- [ ] `npx tsc` ไม่มี error
- [ ] `npm run build` สำเร็จ
- [ ] unit tests ผ่านทั้งหมด
- [ ] drag text component ลง body zone ได้ (ด้วย Pragmatic DnD)
- [ ] เรียก POST /api/export ด้วย Postman/curl ได้รับ PDF กลับมา
- [ ] PDF ที่ได้เปิดได้ใน PDF viewer
- [ ] Thai text แสดงถูกต้องใน PDF (ไม่เป็น ???)

---

## If You Get Stuck

**typst CLI ไม่อยู่ใน PATH:**
```bash
# macOS
brew install typst

# Linux
curl -sSL https://typst.app/install.sh | sh
```

**Thai font ไม่มีในระบบ:**
```bash
# Download Sarabun font
mkdir -p /app/fonts
# ดาวน์โหลด Sarabun จาก Google Fonts → วางใน /app/fonts
```

**typst compile Thai font ไม่แสดง:**
```
typst compile --font-path /app/fonts document.typ output.pdf
```
