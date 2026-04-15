use crate::schema::*;
use serde_json::Value;

pub fn generate_typst(schema: &LayoutSchema, data: &Value) -> String {
    let mut t = String::new();
    t.push_str("// PHOENIX ENGINE (RUST/WASM) v2.0 — ADVANCED TABLE\n");

    // Page Setup
    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: 0mm,\n)\n",
        schema.page.size.to_lowercase(),
        schema.page.orientation == "landscape",
    ));

    // Fonts
    if let Some(font) = schema.fonts.first() {
        t.push_str(&format!(
            "#set text(font: \"{}\", size: {}pt, lang: \"th\")\n",
            font.family, font.size
        ));
    }
    t.push_str("#set par(leading: 0.2em, justify: false)\n");

    // Zones
    render_zone(&mut t, &schema.zones.header, "HEADER", data);
    render_zone(&mut t, &schema.zones.body, "BODY", data);
    render_zone(&mut t, &schema.zones.footer, "FOOTER", data);

    t
}

fn render_zone(t: &mut String, zone: &Zone, label: &str, data: &Value) {
    if zone.components.is_empty() && zone.min_height.is_none() {
        return;
    }
    t.push_str(&format!("\n// ZONE: {}\n", label));

    let height = zone.min_height.as_deref().unwrap_or("auto");
    let fill = zone.background.as_deref().map(|c| format_color(c)).unwrap_or("none".to_string());
    let inset = zone.padding.as_deref().unwrap_or("0mm");

    t.push_str(&format!(
        "#block(width: 100%, height: {}, fill: {}, inset: {})[\n",
        height, fill, inset
    ));

    for comp in &zone.components {
        t.push_str("  ");
        t.push_str(&render_component(comp, data));
    }
    t.push_str("]\n");
}

fn render_component(comp: &ComponentNode, data: &Value) -> String {
    match comp {
        ComponentNode::Text(c) => render_text(c, data),
        ComponentNode::Table(c) => render_table(c, data),
        ComponentNode::Line(c) => render_line(c),
        ComponentNode::Image(c) => render_image(c),
        ComponentNode::Spacer(c) => render_spacer(c),
        ComponentNode::SummaryBox(c) => render_summary_box(c, data),
        ComponentNode::Barcode(c) => render_placeholder_box("BARCODE", &c.base, &c.value, data),
        ComponentNode::Qr(c) => render_placeholder_box("QR", &c.base, &c.value, data),
        ComponentNode::Repeater(_) => render_placeholder_box("REPEATER (NESTED)", &comp_base(comp), "", data),
        ComponentNode::Columns(_) => render_placeholder_box("COLUMNS (LAYOUT)", &comp_base(comp), "", data),
    }
}

fn comp_base(comp: &ComponentNode) -> &BaseComponent {
    match comp {
        ComponentNode::Text(c) => &c.base,
        ComponentNode::Table(c) => &c.base,
        ComponentNode::Image(c) => &c.base,
        ComponentNode::Line(c) => &c.base,
        ComponentNode::Spacer(c) => &c.base,
        ComponentNode::SummaryBox(c) => &c.base,
        ComponentNode::Barcode(c) => &c.base,
        ComponentNode::Qr(c) => &c.base,
        ComponentNode::Repeater(c) => &c.base,
        ComponentNode::Columns(c) => &c.base,
    }
}

fn render_text(c: &TextComponent, data: &Value) -> String {
    let content = resolve_binding(&c.content, data);
    let s = c.style.as_ref();
    let size = s.and_then(|st| st.font_size).unwrap_or(10.0);
    let weight = s.and_then(|st| st.font_weight.clone()).unwrap_or("regular".to_string());
    let align = c.base.align.as_deref().unwrap_or("left");

    let leading = s.and_then(|st| st.line_height).map(|v| v - 1.0).unwrap_or(0.2);
    let mut tracking = s.and_then(|st| st.letter_spacing.clone()).unwrap_or_default();
    if tracking.is_empty() { tracking = "0pt".to_string(); }
    let justify = s.and_then(|st| st.justify).unwrap_or(false);

    let body = format!(
        "#set align({})\n#set par(leading: {}em, justify: {})\n#text(size: {}pt, weight: \"{}\", tracking: {})[{}]",
        align, leading, justify, size, weight, tracking, escape_typst(&content)
    );

    wrap_placement(&c.base, &body)
}

// ─── ADVANCED TABLE RENDERER ────────────────────────────────────────────────

fn render_fill_function(
    pattern: &str,
    header_bg: &str,
    color1: &str,
    color2: &str,
    header_end_y: u32,
) -> String {
    match pattern {
        "none" => "none".to_string(),
        "header-only" => format!(
            "(x, y) => if y < {} {{ {} }} else {{ none }}",
            header_end_y, format_color(header_bg)
        ),
        "striped-rows" => format!(
            "(x, y) => if y < {} {{ {} }} else if calc.even(y) {{ {} }} else {{ {} }}",
            header_end_y, format_color(header_bg), format_color(color1), format_color(color2)
        ),
        "striped-cols" => format!(
            "(x, y) => if y < {} {{ {} }} else if calc.even(x) {{ {} }} else {{ {} }}",
            header_end_y, format_color(header_bg), format_color(color1), format_color(color2)
        ),
        "checkerboard" => format!(
            "(x, y) => if y < {} {{ {} }} else if calc.even(x + y) {{ {} }} else {{ {} }}",
            header_end_y, format_color(header_bg), format_color(color1), format_color(color2)
        ),
        // default = header-only
        _ => format!(
            "(x, y) => if y < {} {{ {} }} else {{ none }}",
            header_end_y, format_color(header_bg)
        ),
    }
}

fn render_stroke(style_stroke: Option<&Value>, border_width: &str, border_color: &str) -> String {
    if let Some(stroke_val) = style_stroke {
        match stroke_val {
            Value::Object(map) => {
                // Per-side stroke dictionary
                let mut parts = Vec::new();
                if let Some(v) = map.get("top").and_then(|v| v.as_str()) {
                    parts.push(format!("top: {}", v));
                }
                if let Some(v) = map.get("bottom").and_then(|v| v.as_str()) {
                    parts.push(format!("bottom: {}", v));
                }
                if let Some(v) = map.get("left").and_then(|v| v.as_str()) {
                    parts.push(format!("left: {}", v));
                }
                if let Some(v) = map.get("right").and_then(|v| v.as_str()) {
                    parts.push(format!("right: {}", v));
                }
                if parts.is_empty() {
                    format!("{} + {}", border_width, format_color(border_color))
                } else {
                    format!("({})", parts.join(", "))
                }
            }
            Value::String(s) => s.clone(),
            _ => format!("{} + {}", border_width, format_color(border_color)),
        }
    } else {
        format!("{} + {}", border_width, format_color(border_color))
    }
}

fn render_table(c: &TableComponent, data: &Value) -> String {
    let style = c.style.as_ref();
    let cols = &c.columns;

    if cols.is_empty() {
        return "/* empty table */\n".to_string();
    }

    let mut t = String::from("#table(\n");

    // 1. columns:
    let col_defs = cols.iter()
        .map(|col| col.width.clone().replace("*", "fr"))
        .collect::<Vec<_>>()
        .join(", ");
    t.push_str(&format!("  columns: ({}),\n", col_defs));

    // 2. rows: (if row heights specified)
    if let Some(row_heights) = style.and_then(|s| s.row_heights.as_ref()) {
        if !row_heights.is_empty() {
            t.push_str(&format!("  rows: ({}),\n", row_heights.join(", ")));
        }
    }

    // 3. inset:
    let inset = style
        .and_then(|s| s.inset.as_deref().or(s.cell_padding.as_deref()))
        .unwrap_or("7pt");
    t.push_str(&format!("  inset: {},\n", inset));

    // 4. stroke:
    let border_width = style.and_then(|s| s.border_width.as_deref()).unwrap_or("0.5pt");
    let border_color = style.and_then(|s| s.border_color.as_deref()).unwrap_or("#cbd5e1");
    let stroke_str = render_stroke(
        style.and_then(|s| s.stroke.as_ref()),
        border_width,
        border_color,
    );
    t.push_str(&format!("  stroke: {},\n", stroke_str));

    // 5. gutter:
    if let Some(col_gap) = style.and_then(|s| s.column_gutter.as_deref()) {
        t.push_str(&format!("  column-gutter: {},\n", col_gap));
    }
    if let Some(row_gap) = style.and_then(|s| s.row_gutter.as_deref()) {
        t.push_str(&format!("  row-gutter: {},\n", row_gap));
    }
    if let Some(gap) = style.and_then(|s| s.gutter.as_deref()) {
        if style.and_then(|s| s.column_gutter.as_deref()).is_none() {
            t.push_str(&format!("  gutter: {},\n", gap));
        }
    }

    // 6. fill:
    let fill_pattern = style.and_then(|s| s.fill_pattern.as_deref()).unwrap_or("header-only");
    let header_bg = style.and_then(|s| s.header_background.as_deref()).unwrap_or("#e2e8f0");
    let color1 = style.and_then(|s| s.striped_color1.as_deref())
        .or_else(|| style.and_then(|s| s.alternate_row_background.as_deref()))
        .unwrap_or("#f8fafc");
    let color2 = style.and_then(|s| s.striped_color2.as_deref()).unwrap_or("#ffffff");

    // Determine header end y for fill function
    let header_end_y = if c.header_rows.as_ref().map_or(false, |h| !h.is_empty()) {
        c.header_rows.as_ref().map_or(1, |h| h.len() as u32)
    } else if c.show_header.unwrap_or(true) {
        1u32
    } else {
        0u32
    };

    if fill_pattern == "none" {
        t.push_str("  fill: none,\n");
    } else {
        let fill_fn = render_fill_function(fill_pattern, header_bg, color1, color2, header_end_y);
        t.push_str(&format!("  fill: {},\n", fill_fn));
    }

    // 7. align: (per-column array if varied)
    let aligns: Vec<&str> = cols.iter().map(|c| c.align.as_deref().unwrap_or("left")).collect();
    let has_varied = aligns.windows(2).any(|w| w[0] != w[1]);
    if has_varied {
        t.push_str(&format!("  align: ({}),\n", aligns.join(", ")));
    }

    // ── 8. HEADER ────────────────────────────────────────────────────────────

    let has_structured_headers = c.header_rows.as_ref().map_or(false, |h| !h.is_empty());

    if has_structured_headers {
        let header_rows = c.header_rows.as_ref().unwrap();
        let repeat = c.repeat_header_on_page.unwrap_or(true);
        t.push_str(&format!("  table.header(repeat: {},\n", repeat));

        for row in header_rows {
            for cell in &row.cells {
                let content = escape_typst(&cell.content);
                let cs = cell.colspan.unwrap_or(1);
                let rs = cell.rowspan.unwrap_or(1);
                let has_overrides = cs > 1 || rs > 1 || cell.fill.is_some() || cell.align.is_some() || cell.inset.is_some();

                if !has_overrides {
                    t.push_str(&format!("    [*{}*],\n", content));
                } else {
                    let mut args = Vec::new();
                    if cs > 1 { args.push(format!("colspan: {}", cs)); }
                    if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                    if let Some(f) = &cell.fill { args.push(format!("fill: {}", format_color(f))); }
                    if let Some(a) = &cell.align { args.push(format!("align: {}", a)); }
                    if let Some(i) = &cell.inset { args.push(format!("inset: {}", i)); }
                    t.push_str(&format!("    table.cell({})[*{}*],\n", args.join(", "), content));
                }
            }
        }
        t.push_str("  ),\n");
    } else if c.show_header.unwrap_or(true) {
        // Legacy: use column headers
        let repeat = c.repeat_header_on_page.unwrap_or(true);
        t.push_str(&format!("  table.header(repeat: {},\n", repeat));
        let mut covered = std::collections::HashSet::new();
        for (x, col) in cols.iter().enumerate() {
            if covered.contains(&x) { continue; }
            let cs = col.colspan.unwrap_or(1);
            let rs = col.rowspan.unwrap_or(1);
            let col_align = col.align.as_deref().unwrap_or("center");
            let header_text = escape_typst(&col.header);

            if cs == 1 && rs == 1 {
                t.push_str(&format!(
                    "    [#set align({}); *{}*],\n",
                    col_align, header_text
                ));
            } else {
                t.push_str(&format!(
                    "    table.cell(x: {}, y: 0, colspan: {}, rowspan: {})[#set align({}); *{}*],\n",
                    x, cs, rs, col_align, header_text
                ));
            }
            for i in 1..(cs as usize) { covered.insert(x + i); }
        }
        t.push_str("  ),\n");
    }

    // ── 9. HLINES before first data row ──────────────────────────────────────
    if let Some(hlines) = &c.hlines {
        for hl in hlines.iter().filter(|h| h.y <= header_end_y) {
            t.push_str(&render_hline(hl));
        }
    }

    // ── 10. DATA ROWS ─────────────────────────────────────────────────────────
    let path = c.data_source.replace("{{", "").replace("}}", "").trim().to_string();
    let mut current_y = header_end_y;

    if let Some(Value::Array(items)) = resolve_path(&path, data) {
        for item in items {
            let mut covered = std::collections::HashSet::new();
            for (x, col) in cols.iter().enumerate() {
                if covered.contains(&x) { continue; }
                let cs = col.colspan.unwrap_or(1);
                let rs = col.rowspan.unwrap_or(1);
                let val = resolve_path(&col.field, item).map(|v| match v {
                    Value::String(s) => s.clone(),
                    _ => v.to_string(),
                }).unwrap_or_default();
                let col_align = col.align.as_deref().unwrap_or("left");

                let has_overrides = cs > 1 || rs > 1 || col.background.is_some();

                if !has_overrides {
                    t.push_str(&format!(
                        "  [#set align({}); {}],\n",
                        col_align, escape_typst(&val)
                    ));
                } else {
                    let mut args = Vec::new();
                    if cs > 1 { args.push(format!("colspan: {}", cs)); }
                    if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                    if let Some(bg) = &col.background {
                        args.push(format!("fill: {}", format_color(bg)));
                    }
                    t.push_str(&format!(
                        "  table.cell({})[#set align({}); {}],\n",
                        args.join(", "), col_align, escape_typst(&val)
                    ));
                }
                for i in 1..(cs as usize) { covered.insert(x + i); }
            }
            current_y += 1;
        }
    }

    // ── 11. HLINES after data ─────────────────────────────────────────────────
    if let Some(hlines) = &c.hlines {
        for hl in hlines.iter().filter(|h| h.y > header_end_y) {
            t.push_str(&render_hline(hl));
        }
    }

    // ── 12. VLINES ────────────────────────────────────────────────────────────
    if let Some(vlines) = &c.vlines {
        for vl in vlines {
            t.push_str(&render_vline(vl));
        }
    }

    // ── 13. FOOTER ROWS ───────────────────────────────────────────────────────
    let has_footer_rows = c.footer_rows.as_ref().map_or(false, |f| !f.is_empty());
    if has_footer_rows {
        let footer_rows = c.footer_rows.as_ref().unwrap();
        let repeat = footer_rows.first().and_then(|r| r.repeat).unwrap_or(true);
        t.push_str(&format!("  table.footer(repeat: {},\n", repeat));

        for row in footer_rows {
            for cell in &row.cells {
                let val = resolve_binding(&cell.content, data);
                let content = escape_typst(&val);
                let cs = cell.colspan.unwrap_or(1);
                let rs = cell.rowspan.unwrap_or(1);
                let has_overrides = cs > 1 || rs > 1 || cell.fill.is_some() || cell.align.is_some();

                if !has_overrides {
                    t.push_str(&format!("    [*{}*],\n", content));
                } else {
                    let mut args = Vec::new();
                    if cs > 1 { args.push(format!("colspan: {}", cs)); }
                    if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                    if let Some(f) = &cell.fill { args.push(format!("fill: {}", format_color(f))); }
                    if let Some(a) = &cell.align { args.push(format!("align: {}", a)); }
                    t.push_str(&format!("    table.cell({})[*{}*],\n", args.join(", "), content));
                }
            }
        }
        t.push_str("  ),\n");
    }

    // ── 14. SUMMARY ROWS (legacy) ─────────────────────────────────────────────
    if let Some(summary_rows) = &c.summary_rows {
        for row in summary_rows {
            if row.separator.unwrap_or(false) {
                t.push_str("  table.hline(stroke: 1pt + black),\n");
            }
            let val = resolve_binding(&row.value, data);
            let escaped_label = escape_typst(&row.label);
            let escaped_val = escape_typst(&val);
            let weight = if row.style.as_deref() == Some("total") { "bold" } else { "regular" };
            let span = if cols.len() > 1 { cols.len() - 1 } else { 1 };
            t.push_str(&format!(
                "  table.cell(colspan: {}, align: right)[*{}*],\n  [#text(weight: \"{}\")[{}]],\n",
                span, escaped_label, weight, escaped_val
            ));
        }
    }

    t.push_str(")");
    let _ = current_y; // suppress unused warning
    wrap_placement(&c.base, &t)
}

fn render_hline(hl: &HLineConfig) -> String {
    let mut args = vec![format!("y: {}", hl.y)];
    if let Some(start) = hl.start { if start > 0 { args.push(format!("start: {}", start)); } }
    if let Some(end) = hl.end { args.push(format!("end: {}", end)); }
    if let Some(stroke) = &hl.stroke { args.push(format!("stroke: {}", stroke)); }
    if let Some(pos) = &hl.position { args.push(format!("position: {}", pos)); }
    format!("  table.hline({}),\n", args.join(", "))
}

fn render_vline(vl: &VLineConfig) -> String {
    let mut args = vec![format!("x: {}", vl.x)];
    if let Some(start) = vl.start { if start > 0 { args.push(format!("start: {}", start)); } }
    if let Some(end) = vl.end { args.push(format!("end: {}", end)); }
    if let Some(stroke) = &vl.stroke { args.push(format!("stroke: {}", stroke)); }
    if let Some(pos) = &vl.position { args.push(format!("position: {}", pos)); }
    format!("  table.vline({}),\n", args.join(", "))
}

// ─── OTHER COMPONENT RENDERERS ───────────────────────────────────────────────

fn render_line(c: &LineComponent) -> String {
    let color = c.color.as_deref().unwrap_or("black");
    let thickness = c.thickness.as_deref().unwrap_or("1pt");
    let body = format!("#line(length: 100%, stroke: {} + {})", thickness, format_color(color));
    wrap_placement(&c.base, &body)
}

fn render_image(c: &ImageComponent) -> String {
    let fit = c.fit.as_deref().unwrap_or("contain");
    let body = format!("#image(\"{}\", width: 100%, height: 100%, fit: \"{}\")", c.src, fit);
    wrap_placement(&c.base, &body)
}

fn render_spacer(c: &SpacerComponent) -> String {
    format!("#v({}mm, weak: true)\n", c.height)
}

fn render_summary_box(c: &SummaryBoxComponent, data: &Value) -> String {
    let mut rows_typst = String::new();
    for row in &c.rows {
        if row.separator.unwrap_or(false) {
            rows_typst.push_str("  table.hline(stroke: 0.5pt + black),\n");
        }
        let val = resolve_binding(&row.value, data);
        let weight = if row.style.as_deref() == Some("total") { "bold" } else { "regular" };
        rows_typst.push_str(&format!(
            "  [{}:], [#text(weight: \"{}\")[{}]],\n",
            escape_typst(&row.label), weight, escape_typst(&val)
        ));
    }
    let body = format!("#table(columns: (1fr, auto), stroke: none, inset: 4pt,\n{})", rows_typst);
    wrap_placement(&c.base, &body)
}

fn render_placeholder_box(label: &str, base: &BaseComponent, value: &str, data: &Value) -> String {
    let val = resolve_binding(value, data);
    let body = format!(
        "#rect(width: 100%, height: 100%, fill: gray.lighten(80%), stroke: 0.5pt + black)[\n    #set align(center + horizon)\n    #text(size: 8pt)[{}\\n{}]\n  ]",
        label, escape_typst(&val)
    );
    wrap_placement(base, &body)
}

fn wrap_placement(base: &BaseComponent, body: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);
    let h = base.height.unwrap_or(20.0);
    format!("#place(dx: {}mm, dy: {}mm)[#block(width: {}mm, height: {}mm, clip: false)[{}]]\n", x, y, w, h, body)
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

fn resolve_path<'a>(path: &str, data: &'a Value) -> Option<&'a Value> {
    if path.is_empty() { return Some(data); }
    let mut current = data;
    for part in path.split('.') {
        current = current.get(part)?;
    }
    Some(current)
}

fn resolve_binding(expr: &str, data: &Value) -> String {
    let mut result = expr.to_string();
    while let Some(start) = result.find("{{") {
        if let Some(end) = result[start..].find("}}") {
            let path = result[start + 2..start + end].trim().to_string();
            let value = resolve_path(&path, data)
                .map(|v| v.to_string().replace("\"", ""))
                .unwrap_or_else(|| format!("{{{{{}}}}}", path));
            result.replace_range(start..start + end + 2, &value);
        } else {
            break;
        }
    }
    result
}

fn escape_typst(s: &str) -> String {
    s.replace("#", "\\#")
     .replace("$", "\\$")
     .replace("*", "\\*")
     .replace("_", "\\_")
     .replace("[", "\\[")
     .replace("]", "\\]")
     .replace("(", "\\(")
     .replace(")", "\\)")
     .replace("{", "\\{")
     .replace("}", "\\}")
     .replace("<", "\\<")
     .replace(">", "\\>")
     .replace("@", "\\@")
     .replace("=", "\\=")
     .replace("/", "\\/")
}

fn format_color(color: &str) -> String {
    if color.starts_with('#') {
        format!("rgb(\"{}\")", color)
    } else {
        color.to_string()
    }
}
