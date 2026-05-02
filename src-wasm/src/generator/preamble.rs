pub fn get_preamble() -> String {
    let mut t = String::new();
    t.push_str("// PHOENIX ENGINE (RUST/WASM) v3.2 — RECURSIVE ROBUST FORMATTING\n");
    t.push_str("#import \"@preview/codetastic:0.2.2\": qrcode, ean13, ean8\n\n");

    t.push_str("// --- Formatting Helpers ---\n");
    t.push_str("#let add_commas(v) = {\n");
    t.push_str("  let s = str(v).replace(\",\", \"\")\n");
    t.push_str("  let is_neg = s.starts-with(\"-\")\n");
    t.push_str("  let s = if is_neg { s.slice(1) } else { s }\n");
    t.push_str("  let res = if s.len() <= 3 { s } else {\n");
    t.push_str("    let rest = s.slice(0, s.len() - 3)\n");
    t.push_str("    let last = s.slice(s.len() - 3)\n");
    // Manual recursion depth for safety in Typst if needed, but Typst supports recursion.
    // However, let's use a while loop for absolute robustness across all Typst versions.
    t.push_str("    let out = \"\"\n");
    t.push_str("    let temp = s\n");
    t.push_str("    while temp.len() > 3 {\n");
    t.push_str("      out = \",\" + temp.slice(temp.len() - 3) + out\n");
    t.push_str("      temp = temp.slice(0, temp.len() - 3)\n");
    t.push_str("    }\n");
    t.push_str("    temp + out\n");
    t.push_str("  }\n");
    t.push_str("  if is_neg { \"-\" + res } else { res }\n");
    t.push_str("}\n\n");
    
    t.push_str("#let fmt_number(v) = {\n");
    t.push_str("  if v == none or v == \"\" { return \"\" }\n");
    t.push_str("  let val = if type(v) == str {\n");
    t.push_str("    let trimmed = v.trim().replace(\",\", \"\")\n");
    t.push_str("    if trimmed == \"\" { 0 } else {\n");
    t.push_str("      let f = float(trimmed)\n");
    t.push_str("      if f == none { trimmed } else { f }\n");
    t.push_str("    }\n");
    t.push_str("  } else { v }\n");
    t.push_str("  \n");
    t.push_str("  if type(val) == float or type(val) == int {\n");
    t.push_str("    let s = str(float(val))\n");
    t.push_str("    let parts = s.split(\".\")\n");
    t.push_str("    let whole = add_commas(parts.at(0))\n");
    t.push_str("    let decimal = if parts.len() > 1 { parts.at(1) } else { \"00\" }\n");
    t.push_str("    if decimal.len() == 1 { decimal = decimal + \"0\" }\n");
    t.push_str("    whole + \".\" + decimal.slice(0, 2)\n");
    t.push_str("  } else { str(v) }\n");
    t.push_str("}\n\n");

    t.push_str("#let fmt_currency_thb(v) = {\n");
    t.push_str("  \"฿\" + fmt_number(v)\n");
    t.push_str("}\n\n");

    t.push_str("#let fmt_currency_usd(v) = {\n");
    t.push_str("  \"$\" + fmt_number(v)\n");
    t.push_str("}\n\n");

    t.push_str("#let fmt_date_th(v) = {\n");
    t.push_str("  if type(v) != \"string\" or v == \"\" { return str(v) }\n");
    t.push_str("  let months = (\"มกราคม\", \"กุมภาพันธ์\", \"มีนาคม\", \"เมษายน\", \"พฤษภาคม\", \"มิถุนายน\", \"กรกฎาคม\", \"สิงหาคม\", \"กันยายน\", \"ตุลาคม\", \"พฤศจิกายน\", \"ธันวาคม\")\n");
    t.push_str("  if v.len() >= 10 {\n");
    t.push_str("    let y = int(v.slice(0, 4))\n");
    t.push_str("    let m = int(v.slice(5, 7))\n");
    t.push_str("    let d = int(v.slice(8, 10))\n");
    t.push_str("    if m >= 1 and m <= 12 { return str(d) + \" \" + months.at(m - 1) + \" \" + str(y + 543) }\n");
    t.push_str("  }\n");
    t.push_str("  v\n");
    t.push_str("}\n\n");

    t.push_str("#let fmt_date_en(v) = {\n");
    t.push_str("  if type(v) != \"string\" or v == \"\" { return str(v) }\n");
    t.push_str("  let months = (\"Jan\", \"Feb\", \"Mar\", \"Apr\", \"May\", \"Jun\", \"Jul\", \"Aug\", \"Sep\", \"Oct\", \"Nov\", \"Dec\")\n");
    t.push_str("  if v.len() >= 10 {\n");
    t.push_str("    let y = int(v.slice(0, 4))\n");
    t.push_str("    let m = int(v.slice(5, 7))\n");
    t.push_str("    let d = int(v.slice(8, 10))\n");
    t.push_str("    if m >= 1 and m <= 12 { return str(d) + \" \" + months.at(m - 1) + \" \" + str(y) }\n");
    t.push_str("  }\n");
    t.push_str("  v\n");
    t.push_str("}\n\n");

    t.push_str("#let fmt_percent(v) = {\n");
    t.push_str("  fmt_number(v) + \"%\"\n");
    t.push_str("}\n\n");

    t.push_str("#let fmt_boolean(v) = {\n");
    t.push_str("  if v == true or v == \"true\" or v == \"1\" or v == \"yes\" { \"Yes\" }\n");
    t.push_str("  else { \"No\" }\n");
    t.push_str("}\n\n");
    
    t
}
