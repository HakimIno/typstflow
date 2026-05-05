# AI Agent Test Prompts

Test prompts for validating the TypstFlow AI agent — covers layout building, memory,
style consistency, data bindings, and edge cases.

---

## 1. Basic Layout — Invoice (Navy Theme)

```
Create a professional Thai invoice layout. Use navy color theme (#1a1a2e / #4361ee).
Include: logo placeholder top-left, company name and address, invoice number and date
top-right, items table with 5 columns (no, description, qty, unit price, total),
VAT summary box bottom-right, and footer with payment terms and page number.
```

**Expected**: header with logo + company info, body table, summary box at x≥110mm, footer

---

## 2. Basic Layout — Tax Invoice (Thai)

```
Build a Thai tax invoice (ใบกำกับภาษี) layout using teal color theme.
Header: "ใบกำกับภาษี / TAX INVOICE" as main title centered, seller info left,
buyer info right, document number and date right-aligned below.
Body: items table (no, description, unit, qty, unit price, amount).
Bottom: subtotal, VAT 7%, grand total summary box right-aligned.
Signature section: 3 columns — issuer, reviewer, authorized.
Footer: tax ID, contact, page number.
Fill with realistic Thai business mock data.
```

**Expected**: bilingual title, proper Thai tax invoice structure, mock data injected

---

## 3. Basic Layout — Delivery Order

```
Build a delivery order layout with teal color theme:
Header: logo left, company name/address, title "DELIVERY ORDER" bold right-aligned,
document number and date below title.
Body: sender and receiver info in 2-column boxes with borders.
Items table: item code, description, ordered qty, delivered qty, unit, remark.
Signature section: sender signature left, receiver signature right with date field.
Footer: terms note left, page number right.
Fill with Thai mock data including 5 delivery items.
```

**Expected**: 2-column info boxes, items table, dual signature boxes

---

## 4. Memory Consistency Test (2-turn)

**Turn 1 — establish theme:**
```
Build a quotation header using navy color theme (#1a1a2e / #4361ee).
Include logo placeholder, company name bold 18pt, and "QUOTATION" title right-aligned 20pt.
Add a 2mm accent line under the title in color #4361ee.
```

**Turn 2 — test if AI remembers color:**
```
Now add an items table to the body and a grand total summary box.
```

> **Pass**: table uses navy `headerBackground` (#f0f2ff) and border (#d0d5e8) — matching turn 1
> **Fail**: table uses default gray colors — memory not working

---

## 5. Style Override Test

```
Load the invoice template, then:
1. Change the main accent line color to #e63946 (red)
2. Increase the company name font size to 20pt bold
3. Add a tagline text below company name: "Your Trusted Business Partner" in gray 9pt italic
4. Change the items table header background to #fff5f5
```

**Expected**: AI calls `get_layout` first, then `update_component` with correct IDs

---

## 6. Data Binding Test

```
Create a sales report layout with these exact dynamic bindings:
Header: {{report.title}}, {{report.period}}, {{company.name}}
Body KPI row (3 boxes side by side):
  - "Total Revenue" label + {{stats.totalRevenue}} value bold large
  - "Order Count" label + {{stats.orderCount}} value bold large
  - "Avg Order Value" label + {{stats.avgOrderValue}} value bold large
Body table bound to {{transactions}} with columns:
  date, customer name, amount, status
Footer: "Generated: {{generatedAt}}" left | "Page {{page}}" right
Then call set_sample_data with complete Thai mock data covering all bindings above.
```

**Expected**: all `{{bindings}}` appear in layout, mock data covers every binding

---

## 7. Complex Multi-section Test

```
Build a complete purchase order document using modern slate theme (#1e293b / #6366f1):

HEADER:
- Logo placeholder top-left (35x18mm)
- Company name bold 16pt + address 9pt gray below
- Title "PURCHASE ORDER" right-aligned bold 18pt
- PO number and date right-aligned below title
- Full-width accent line 1mm under header content

BODY:
- Vendor info box left + Ship-to box right (2 columns, bordered)
- Spacer 5mm
- Items table: no, SKU, description, qty, unit, unit price, amount
  bound to {{items}}
- Spacer 8mm
- Terms and conditions text block (small gray text)
- Signature row: Prepared by | Approved by | Received by

FOOTER:
- Company address + contact left | Page {{page}} right

Fill with Thai mock data: 6 line items, realistic SKU codes, Thai company names.
```

**Expected**: full document, 2-col vendor section, table, signature row, mock data

---

## 8. Incremental Build Test (4-turn)

**Turn 1:**
```
Start a payslip layout. Add only the header: company logo left, company name
"บริษัท เทคโนโลยี ไทย จำกัด" bold 16pt, address below, and title "PAY SLIP"
centered bold 20pt. Use navy theme.
```

**Turn 2:**
```
Add employee info section to the body: name, position, department, employee ID,
pay period — arranged in a 2-column grid at the top of the body.
```

**Turn 3:**
```
Add earnings table (item, days, rate, amount) bound to {{earnings}},
then deductions table (item, amount) bound to {{deductions}} below it.
```

**Turn 4:**
```
Add a net pay summary box bottom-right: gross pay, total deductions, net pay in
large bold accent color. Then fill everything with Thai mock data for a
software engineer monthly salary of 85,000 THB.
```

> **Pass**: each turn adds to existing layout without overwriting previous work

---

## 9. Get Layout + Verify Test

```
Get the current layout and tell me exactly:
- How many components exist in header, body, and footer
- The position (x, y) and size of each component
- Any components that might be overlapping
```

**Expected**: AI calls `get_layout`, returns structured summary

---

## 10. Quick Edit Tests

```
Add a horizontal separator line at y=25 in the header, full width (190mm),
color #4361ee, 1.5mm thick, solid style.
```

```
Remove all components from the footer and replace with a single centered text:
"Page {{page}} of {{totalPages}}" — gray color, 9pt, centered.
```

```
Update the items table: change header background to #0f3460, border color to #1a6b9a,
and add column "Discount %" between unit price and total.
```

---

## 11. Error Recovery Test

```
Load the delivery-order template.
```

> **Expected behavior**: AI should explain that `delivery-order` template does not exist,
> list available templates, and offer to build one from scratch or load an existing template.

---

## 12. Stress Test — Full Document in One Shot

```
Build a complete employee payslip layout from scratch in one go:

HEADER:
- Company logo placeholder left (35x18mm)
- Company name bold 16pt, address 9pt gray below logo
- Title "PAY SLIP" centered 20pt bold
- Pay period and employee ID right-aligned

BODY:
- Employee info: name, position, department, bank account in 2-col grid
- Earnings table bound to {{earnings}}: item, days/hours, rate, amount
- Deductions table bound to {{deductions}}: item, amount
- Net pay box right-aligned: gross, total deductions, net pay (large bold accent)

FOOTER:
- "This is a computer-generated document. No signature required." centered gray 8pt
- Page number right

Use navy theme. Fill with Thai mock data: software engineer, 85,000 THB gross,
standard deductions (social security, withholding tax, provident fund).
```

**Expected**: complete payslip, all tables bound, mock data covers all bindings

---

## Checklist — What to Verify After Each Test

- [ ] Components placed without overlapping
- [ ] Color theme consistent throughout (check headerBackground, accentColor)  
- [ ] All `{{bindings}}` resolved in mock data (no empty placeholders in preview)
- [ ] Tool call accordion shows correct action count
- [ ] Memory badge appears after turn 3+
- [ ] AI doesn't reset style when adding new components (memory test)
- [ ] `get_layout` called before making changes to existing layout
