// PHOENIX ENGINE (RUST/WASM) v3.2 — RECURSIVE ROBUST FORMATTING
#import "@preview/codetastic:0.2.2": qrcode, ean13, ean8

// --- Formatting Helpers ---
#let add_commas(v) = {
  let s = str(v).replace(",", "")
  let is_neg = s.starts-with("-")
  let s = if is_neg { s.slice(1) } else { s }
  let res = if s.len() <= 3 { s } else {
    let rest = s.slice(0, s.len() - 3)
    let last = s.slice(s.len() - 3)
    let out = ""
    let temp = s
    while temp.len() > 3 {
      out = "," + temp.slice(temp.len() - 3) + out
      temp = temp.slice(0, temp.len() - 3)
    }
    temp + out
  }
  if is_neg { "-" + res } else { res }
}

#let fmt_number(v) = {
  if v == none or v == "" { return "" }
  let val = if type(v) == str {
    let trimmed = v.trim().replace(",", "")
    if trimmed == "" { 0 } else {
      let f = float(trimmed)
      if f == none { trimmed } else { f }
    }
  } else { v }
  
  if type(val) == float or type(val) == int {
    let s = str(float(val))
    let parts = s.split(".")
    let whole = add_commas(parts.at(0))
    let decimal = if parts.len() > 1 { parts.at(1) } else { "00" }
    if decimal.len() == 1 { decimal = decimal + "0" }
    whole + "." + decimal.slice(0, 2)
  } else { str(v) }
}

#let fmt_currency_thb(v) = {
  "฿" + fmt_number(v)
}

#let fmt_currency_usd(v) = {
  "$" + fmt_number(v)
}

#let fmt_date_th(v) = {
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4))
    let m = int(v.slice(5, 7))
    let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 { return str(d) + " " + months.at(m - 1) + " " + str(y + 543) }
  }
  v
}

#let fmt_date_en(v) = {
  if type(v) != "string" or v == "" { return str(v) }
  let months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
  if v.len() >= 10 {
    let y = int(v.slice(0, 4))
    let m = int(v.slice(5, 7))
    let d = int(v.slice(8, 10))
    if m >= 1 and m <= 12 { return str(d) + " " + months.at(m - 1) + " " + str(y) }
  }
  v
}

#let fmt_percent(v) = {
  fmt_number(v) + "%"
}

#let fmt_boolean(v) = {
  if v == true or v == "true" or v == "1" or v == "yes" { "Yes" }
  else { "No" }
}

#set page(
  paper: "a4",
  flipped: false,
  margin: 0mm,
)

#set text(font: ("Sarabun", "Sarabun", "sans-serif"), size: 10pt, lang: "th")
#set par(leading: 0.2em, justify: false)

// --- PAGE 1 HEADER ---
#place(dx: 6.6000000000000005mm, dy: 1.4738867210619395mm)[#block(width: 36.9mm, height: 15.8487474788319mm, clip: false)[#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)[#set align(center + horizon); #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND]]]]
#place(dx: 45mm, dy: 2mm)[#block(width: 90mm, height: 7mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 13pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#1e293b"), tracking: 0pt)[บริษัท เทคโซลูชันส์ จำกัด]]]
#place(dx: 45mm, dy: 9mm)[#block(width: 90mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 8pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#64748b"), tracking: 0pt)[88/8 อาคารสาทรซิตี้ ชั้น 12 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก กรุงเทพฯ 10500]]]
#place(dx: 45mm, dy: 14mm)[#block(width: 90mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 8pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#64748b"), tracking: 0pt)[เลขประจำตัวผู้เสียภาษี: 0105567089234]]]
#place(dx: 120mm, dy: 2mm)[#block(width: 70mm, height: 8mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 16pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#1e293b"), tracking: 0pt)[TAX INVOICE / ใบกำกับภาษี]]]
#place(dx: 120mm, dy: 11mm)[#block(width: 70mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[เลขที่: INV-2567-00142]]]
#place(dx: 120mm, dy: 17mm)[#block(width: 70mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[วันที่: 4 พฤษภาคม 2567]]]
#place(dx: 5mm, dy: 22.160924160119254mm)[#block(width: 200mm, height: 1mm, clip: false)[#line(length: 100%, stroke: 0.5mm + rgb("#6366f1"))]]
// --- PAGE 1 BODY ---
#place(dx: 5mm, dy: 33.38577473958334mm)[#block(width: 40mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#6366f1"), tracking: 0pt)[BILL TO / ผู้ซื้อ]]]
#place(dx: 5mm, dy: 38.09453271808047mm)[#block(width: 95mm, height: 6mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 11pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#1e293b"), tracking: 0pt)[บริษัท ไพศาล โลจิสติกส์ จำกัด \(มหาชน\)]]]
#place(dx: 5mm, dy: 44.12413736979167mm)[#block(width: 95mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[200 ถนนนวมินทร์ แขวงนวมินทร์ เขตบึงกุ่ม กรุงเทพฯ 10240]]]
#place(dx: 5mm, dy: 50.12480615558046mm)[#block(width: 95mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[เลขประจำตัวผู้เสียภาษี: 0107548002156]]]
#place(dx: 118.3mm, dy: 33.387109375mm)[#block(width: 85mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#6366f1"), tracking: 0pt)[PAYMENT DETAILS]]]
#place(dx: 118mm, dy: 38.1248046875mm)[#block(width: 85mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[วันครบกำหนด: 4 มิถุนายน 2567]]]
#place(dx: 118mm, dy: 43.83177223205567mm)[#block(width: 85mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[ผู้ขาย: \{\{invoice.salesperson\}\}]]]
#place(dx: 118mm, dy: 49.863623046875006mm)[#block(width: 85mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[เงื่อนไข: Net 30 วัน | โอนเงินผ่านบัญชี ธ.กสิกรไทย 123-4-56789-0]]]
#place(dx: 4.8mm, dy: 60.03990758260091mm)[#block(width: 200mm, height: 20mm, clip: false)[]]
#place(dx: 5.300000000000001mm, dy: 59.0622272491455mm)[#block(width: 200mm, height: 1mm, clip: false)[#line(length: 100%, stroke: 0.3mm + rgb("#e2e8f0"))]]
#place(dx: 5.3mm, dy: 70.52799479166667mm)[#block(width: 200mm, height: 140mm, clip: false)[#table(
  columns: (0.2fr, 0.8fr, 18mm, 24mm, 18mm, 28mm),
  inset: 4pt,
  stroke: 0.5pt + rgb("#e0e0e0"),
  fill: (x, y) => if y < 1 { rgb("#f5f5f5") } else { none },
  table.header(repeat: false,
    [#set align(center); *\#*],
    [#set align(left); *รายการ*],
    [#set align(right); *จำนวน*],
    [#set align(right); *ราคา/หน่วย*],
    [#set align(right); *ส่วนลด*],
    [#set align(right); *จำนวนเงิน*],
  ),
  table.cell(align: center)[1],
  table.cell(align: left)[บริการพัฒนาระบบ ERP Module การเงินและบัญชี],
  table.cell(align: right)[],
  table.cell(align: right)[35,000.00],
  table.cell(align: right)[],
  table.cell(align: right)[35,000.00],
  table.cell(align: center)[2],
  table.cell(align: left)[ค่าบำรุงรักษาระบบรายปี \(Annual Maintenance\)],
  table.cell(align: right)[],
  table.cell(align: right)[18,000.00],
  table.cell(align: right)[],
  table.cell(align: right)[18,000.00],
  table.cell(align: center)[3],
  table.cell(align: left)[ใบอนุญาตซอฟต์แวร์ Enterprise License \(50 users\)],
  table.cell(align: right)[],
  table.cell(align: right)[24,500.00],
  table.cell(align: right)[],
  table.cell(align: right)[24,500.00],
  table.cell(align: center)[4],
  table.cell(align: left)[อบรมการใช้งานระบบ \(Training 2 วัน\)],
  table.cell(align: right)[],
  table.cell(align: right)[4,000.00],
  table.cell(align: right)[],
  table.cell(align: right)[8,000.00],
)
]]
#place(dx: 5mm, dy: 209.86079101562498mm)[#block(width: 200mm, height: 1mm, clip: false)[#line(length: 100%, stroke: 0.3mm + rgb("#e2e8f0"))]]
#place(dx: 105mm, dy: 212.6mm)[#block(width: 60mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[รวมเงิน / Subtotal]]]
#place(dx: 143.4mm, dy: 212.576171875mm)[#block(width: 60mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 10pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#1e293b"), tracking: 0pt)[85,500.00]]]
#place(dx: 105mm, dy: 218.6mm)[#block(width: 60mm, height: 5mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 9pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#475569"), tracking: 0pt)[ภาษีมูลค่าเพิ่ม 7% / VAT]]]
#place(dx: 143.4mm, dy: 218.53958811904448mm)[#block(width: 60mm, height: 5mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 10pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#1e293b"), tracking: 0pt)[5,985.00]]]
#place(dx: 5.300000000000001mm, dy: 225.64898341785775mm)[#block(width: 200mm, height: 1mm, clip: false)[#line(length: 100%, stroke: 0.5mm + rgb("#6366f1"))]]
#place(dx: 104.8mm, dy: 236.29287962480026mm)[#block(width: 60mm, height: 7mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 13pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#1e293b"), tracking: 0pt)[จำนวนรวมทั้งสิ้น]]]
#place(dx: 147.8mm, dy: 235.13760306618428mm)[#block(width: 55.5mm, height: 8.280563816879749mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 16pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "bold", style: "normal", fill: rgb("#6366f1"), tracking: 0pt)[91,485.00]]]
// --- PAGE 1 FOOTER ---
#place(dx: 5mm, dy: 267.6mm)[#block(width: 200mm, height: 1mm, clip: false)[#line(length: 100%, stroke: 0.3mm + rgb("#e2e8f0"))]]
#place(dx: 4.6000000000000005mm, dy: 288.778084379254mm)[#block(width: 140mm, height: 4mm, clip: false)[#set align(left)
#set par(leading: 0.2em, justify: false)
#text(size: 7pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#94a3b8"), tracking: 0pt)[บริษัท เทคโซลูชันส์ จำกัด | 02-234-5678 | info\@techsolutions.co.th]]]
#place(dx: 190mm, dy: 288.37826734600645mm)[#block(width: 14mm, height: 4mm, clip: false)[#set align(right)
#set par(leading: 0.2em, justify: false)
#text(size: 7pt, font: ("Sarabun", "Sarabun", "sans-serif"), weight: "regular", style: "normal", fill: rgb("#94a3b8"), tracking: 0pt)[Page 1 of 1]]]
