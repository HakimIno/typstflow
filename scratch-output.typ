#import "@preview/codetastic:0.2.2": qrcode, ean13, ean8
#set page(
  paper: "a4",
  flipped: true,
  margin: 0mm,
)

#set text(font: ("Inter", "Sarabun", "sans-serif"), size: 9pt, lang: "th")
#set par(leading: 0.2em, justify: false)


// --- Formatting Helpers ---
#let add_commas(n) = {
  let s = str(n)
  let result = ""
  let count = 0
  let is_negative = s.starts-with("-")
  let start_idx = if is_negative { 1 } else { 0 }
  for i in range(s.len() - 1, start_idx - 1, step: -1) {
    if count > 0 and calc.rem(count, 3) == 0 { result = "," + result }
    result = s.at(i) + result
    count += 1
  }
  if is_negative { "-" + result } else { result }
}

#let fmt_number(v) = {
  let val = if type(v) == "string" {
    let t = v.trim()
    if t == "" { 0 } else { let f = float(t); if f == none { t } else { f } }
  } else { v }
  if type(val) == "float" or type(val) == "integer" {
    let s = str(val)
    if s.contains(".") {
      let parts = s.split(".")
      let decimal = parts.at(1)
      if decimal == "0" or decimal == "00" { add_commas(parts.at(0)) }
      else { add_commas(parts.at(0)) + "." + decimal.slice(0, calc.min(2, decimal.len())) }
    } else { add_commas(s) }
  } else { str(v) }
}

#let fmt_currency_thb(v) = {
  let n = if type(v) == "string" { let t = v.trim(); if t == "" { 0 } else { float(t) } } else { v }
  "฿" + fmt_number(n)
}

#let fmt_currency_usd(v) = {
  let n = if type(v) == "string" { let t = v.trim(); if t == "" { 0 } else { float(t) } } else { v }
  "$" + fmt_number(n)
}

#let fmt_date_th(v) = {
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4)); let m = int(v.slice(5, 7)); let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 { return str(d) + " " + months.at(m - 1) + " " + str(y + 543) }
  }
  v
}

#let fmt_date_en(v) = {
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4)); let m = int(v.slice(5, 7)); let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 { return str(d) + " " + months.at(m - 1) + " " + str(y) }
  }
  v
}

#let fmt_percent(v) = {
  let n = if type(v) == "string" { let t = v.trim(); if t == "" { 0 } else { float(t) } } else { v }
  fmt_number(n) + "%"
}

#let fmt_boolean(v) = {
  if v == true or v == "true" or v == "1" or v == "yes" { "Yes" } else { "No" }
}
#set page(margin: (top: 20mm, bottom: 15mm, left: 0mm, right: 0mm))

// --- Report ---
// --- PAGE 1 HEADER ---
// --- PAGE 1 BODY ---
#block(above: 0pt, below: 5mm, width: 100%)[#block(width: 277mm, clip: false)[#block(inset: (top: 1.200pt, bottom: 1.200pt))[#set align(center)
#set par(leading: 0.2em, justify: false)
#text(size: 12pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#000000"), tracking: 0pt)[UNLIQUIDATED CASH ADVANCES#linebreak()As of March 31, 2019]]]]
#block(above: 0pt, below: 5mm, width: 100%)[#block(width: 100mm, clip: false)[#block(inset: (top: 1.000pt, bottom: 1.000pt))[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 10pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#000000"), tracking: 0pt)[Municipality : Miagao]]]]
#align(top + left)[#pad(top: 20mm, left: 0mm)[#block(width: 277mm, clip: false)[#set text(size: 8pt)
#table(
  columns: (50mm, 25mm, 25mm, 40mm, 20mm, 20mm, 20mm, 20mm, 20mm, 20mm, auto),
  inset: 1.5mm,
  stroke: (x, y) => (
    top: if y == 0 { if true { (paint: rgb("#94a3b8"), thickness: 0.1mm) } else { none } } 
         else if y == 3 { (paint: rgb("#94a3b8"), thickness: 0.1mm) }
         else if y < 3 { (paint: rgb("#94a3b8"), thickness: 0.1mm) }
         else { if true { (paint: rgb("#94a3b8"), thickness: 0.1mm) } else { none } },
    left: if x == 0 { if true { (paint: rgb("#94a3b8"), thickness: 0.1mm) } else { none } } 
          else if y < 3 { (paint: rgb("#94a3b8"), thickness: 0.1mm) }
          else { if true { (paint: rgb("#94a3b8"), thickness: 0.1mm) } else { none } },
    bottom: none, // handled by hline for better reliability
    right: none,  // handled by vline for better reliability
  ),
  fill: (x, y) => if y < 3 { rgb("#f1f5f9") } else { none },
  table.header(repeat: true,
    table.cell(rowspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Name of Debtor
(In alphabetical order)
  ],
    table.cell(rowspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Amount
Balance
  ],
    table.cell(rowspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Date Granted
  ],
    table.cell(rowspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Purpose
  ],
    table.cell(colspan: 6, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Amount Due
  ],
    table.cell(rowspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Remarks
  ],
    table.cell(colspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Current
  ],
    table.cell(colspan: 3, align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Past Due
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Less than 30 days
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    31-90 days
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    91-365 days
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    Over 1 yr.
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    over 2 yrs.
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    3 yrs and above
  ],
  ),
  table.cell(colspan: 11, fill: rgb("#f8fafc"))[
    #set text(size: 10pt, fill: rgb("#000000"), weight: "bold")
    #set align(left)
    General Fund
  ],
    table.cell(align: left + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    John Doe
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    15000
  ],
    table.cell(align: center + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    2019-01-15
  ],
    table.cell(align: left + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    Travel expenses
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    15000
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    0
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    0
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    0
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    0
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    0
  ],
    table.cell(align: left + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "regular")
    Pending liquidation
  ],
  table.footer(repeat: true,
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    Total
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    15000.00
  ],
    table.cell(colspan: 2, align: left + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    15000.00
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    0.00
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    0.00
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    0.00
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    0.00
  ],
    table.cell(align: right + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    0.00
  ],
    table.cell(align: left + horizon)[
    #set par(leading: 0.2em)
    #set text(size: 10pt, fill: rgb("#334155"), weight: "bold")
    -
  ],
  ),
  table.hline(y: 6, stroke: (paint: rgb("#94a3b8"), thickness: 0.1mm)),
  table.vline(x: 11, stroke: (paint: rgb("#94a3b8"), thickness: 0.1mm)),
)
]]]
// --- PAGE 1 FOOTER ---
