// PHOENIX ENGINE (RUST/WASM) v3.0 — UNIFIED ABSOLUTE PLACEMENT
#import "@preview/codetastic:0.2.2": qrcode, ean13, ean8

#set page(
  paper: "a4",
  flipped: false,
  margin: 0mm,
)

#set text(font: "Sarabun", size: 10pt, lang: "th")
#set par(leading: 0.2em, justify: false)

    #place(dx: 0mm + 15mm, dy: 0mm + 5mm)[#block(width: 120mm, height: 10mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 24pt, weight: "bold", tracking: 0pt)[BLUE SKY INDIA LIMITED]]]
    #place(dx: 0mm + 15mm, dy: 0mm + 15mm)[#block(width: 100mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 10pt, weight: "bold", tracking: 0pt)[GST No. ASDF23486DD]]]
    #place(dx: 0mm + 15mm, dy: 0mm + 20mm)[#block(width: 150mm, height: 15mm, clip: false)[#set align(left)
#set par(leading: 0.30000000000000004em, justify: false)
#text(size: 8.5pt, weight: "bold", tracking: 0pt)[B-126, Rear Side Basement Malviya Nagar New Delhi-110017
e-mail : info\@gmail.com, Ph. 011-3483465734, 123323487348
State Name : Delhi, State Code : DL]]]
    #place(dx: 0mm + 150mm, dy: 0mm + 5mm)[#block(width: 45mm, height: 12mm, clip: false)[#rect(width: 100%, height: 100%, fill: rgb("#9333ea"), stroke: none)]]
    #place(dx: 0mm + 150mm, dy: 0mm + 6.5mm)[#block(width: 45mm, height: 12mm, clip: false)[#set align(center)
#set par(leading: 0.2em, justify: false)
#text(size: 13pt, weight: "bold", tracking: 0pt)[Tax Invoice]]]
    #place(dx: 0mm + 15mm, dy: 40mm + 0mm)[#block(width: 180mm, height: 6mm, clip: false)[#rect(width: 100%, height: 100%, fill: rgb("#c084fc"), stroke: none)]]
    #place(dx: 0mm + 17mm, dy: 40mm + 1mm)[#block(width: 100mm, height: 4mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[Client Name : TECHGURUPLUS]]]
    #place(dx: 0mm + 145mm, dy: 40mm + 1mm)[#block(width: 48mm, height: 4mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[Date : 25-10-2017]]]
    #place(dx: 0mm + 15mm, dy: 40mm + 6mm)[#block(width: 180mm, height: 20mm, clip: false)[#rect(width: 100%, height: 100%, fill: rgb("#000000"), stroke: none)]]
    #place(dx: 0mm + 17mm, dy: 40mm + 7mm)[#block(width: 120mm, height: 18mm, clip: false)[#set align(left)
#set par(leading: 0.3999999999999999em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[Address : H-195, Sarita Vihar, New Delhi 110076
GSTIN : 07PDUJS4678K1Z4]]]
    #place(dx: 0mm + 145mm, dy: 40mm + 7mm)[#block(width: 48mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[Invoice No : 76/2017-18]]]
    #place(dx: 0mm + 17mm, dy: 40mm + 28mm)[#block(width: 50mm, height: 4mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[Delivery Address:]]]
    #place(dx: 0mm + 17mm, dy: 40mm + 33mm)[#block(width: 120mm, height: 18mm, clip: false)[#set align(left)
#set par(leading: 0.3999999999999999em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[Client Name : TECHGURUPLUS
Address : H-195, Sarita Vihar, New Delhi 110076
GSTIN : 07PDUJS4678K1Z4]]]
    #place(dx: 0mm + 135mm, dy: 40mm + 28mm)[#block(width: 58mm, height: 15mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, weight: "regular", tracking: 0pt)[State Name: Delhi

State Code: DL]]]
    #place(dx: 0mm + 15mm, dy: 40mm + 55mm)[#block(width: 180mm, height: 120mm, clip: false)[#table(
  columns: (0.4fr, 3fr, 1fr, 0.6fr, 0.8fr, 1.2fr),
  inset: 6pt,
  stroke: 0.5pt + rgb("#000000"),
  fill: (x, y) => if y < 1 { rgb("#c084fc") } else { none },
  align: (center, left, center, center, right, right),
  table.header(repeat: true,
    [#set align(center); *S.No*],
    [#set align(left); *Description*],
    [#set align(center); *HSN Code*],
    [#set align(center); *Qty*],
    [#set align(right); *Rate*],
    [#set align(right); *Amount*],
  ),
  [#set align(center); 1],
  [#set align(left); Service Item 1],
  [#set align(center); 998311],
  [#set align(center); 1],
  [#set align(right); 1000],
  [#set align(right); 1000],
  [#set align(center); 2],
  [#set align(left); Service Item 2],
  [#set align(center); 998312],
  [#set align(center); 2],
  [#set align(right); 500],
  [#set align(right); 1000],
  table.vline(x: 1, stroke: 0.5pt + black),
  table.vline(x: 2, stroke: 0.5pt + black),
  table.vline(x: 3, stroke: 0.5pt + black),
  table.vline(x: 4, stroke: 0.5pt + black),
  table.vline(x: 5, stroke: 0.5pt + black),
  table.footer(repeat: true,
    table.cell(colspan: 5, fill: rgb("#c084fc"), align: right)[*Total Value*],
    table.cell(fill: rgb("#c084fc"), align: right)[*2000*],
    table.cell(colspan: 3)[**],
    table.cell(colspan: 2, align: right)[*Add : CGST*],
    table.cell(align: center)[*14%*],
    table.cell(colspan: 3)[**],
    table.cell(colspan: 2, align: right)[*Add : SGST*],
    table.cell(align: center)[*14%*],
    table.cell(colspan: 5, fill: rgb("#c084fc"), align: right)[*Grand Total*],
    table.cell(fill: rgb("#c084fc"), align: right)[*2560*],
  ),
)]]
    #place(dx: 0mm + 15mm, dy: 40mm + 215mm)[#block(width: 100mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 10pt, weight: "bold", tracking: 0pt)[Amount in Words: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_]]]
    #place(dx: 0mm + 115mm, dy: 267mm + 5mm)[#block(width: 80mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, weight: "bold", tracking: 0pt)[For BLUE SKY INDIA LIMITED]]]
    #place(dx: 0mm + 115mm, dy: 267mm + 22mm)[#block(width: 80mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 10pt, weight: "bold", tracking: 0pt)[Authorised Signature]]]

#pad(top: 10mm + 40mm + 2mm, bottom: 10mm + 30mm + 2mm, left: 15mm, right: 15mm)[]
