use crate::schema::*;
use serde_json::Value;

/// Maps internal paper names to Typst-recognized paper names.
fn get_typst_paper_name(size: &str) -> String {
    match size.to_lowercase().as_str() {
        "letter" => "us-letter".to_string(),
        "legal" => "us-legal".to_string(),
        "tabloid" => "us-tabloid".to_string(),
        "b4" => "iso-b4".to_string(),
        "b5" => "iso-b5".to_string(),
        other => other.to_string(),
    }
}

pub fn generate_typst(schema: &LayoutSchema, data: &Value) -> String {
    let mut t = String::new();
    t.push_str("// PHOENIX ENGINE (RUST/WASM) v3.0 — UNIFIED ABSOLUTE PLACEMENT\n");
    t.push_str("#import \"@preview/codetastic:0.2.2\": qrcode, ean13, ean8\n\n");

    // Page dimensions
    let margin = &schema.page.margin;
    let h_height = schema.zones.header.min_height.clone().unwrap_or("0mm".to_string());
    let _b_height = schema.zones.body.min_height.clone().unwrap_or("0mm".to_string());
    let f_height = schema.zones.footer.min_height.clone().unwrap_or("0mm".to_string());

    let is_landscape = schema.page.orientation == "landscape";
    // page_dimensions is still needed for paper_dimensions call but we can prefix unused with _
    let (_page_width_mm, page_height_mm) = paper_dimensions(&schema.page.size, is_landscape);

    // Page setup — NO header/footer callbacks, pure absolute placement
    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: 0mm,\n)\n\n",
        get_typst_paper_name(&schema.page.size),
        is_landscape,
    ));

    // Fonts
    if let Some(font) = schema.fonts.first() {
        t.push_str(&format!(
            "#set text(font: \"{}\", size: {}pt, lang: \"th\")\n",
            font.family, font.size
        ));
    }
    t.push_str("#set par(leading: 0.2em, justify: false)\n\n");



    // ── UNIFIED ABSOLUTE PLACEMENT FOR ALL ZONES ────────────────────────────
    // All zones are rendered with #place() using absolute Y offsets from page top.
    // This ensures consistent 1:1 mapping between designer canvas and PDF output.
    
    let offset_x = "0mm";

    // 1. HEADER starts at 0mm (absolute from top)
    let header_offset_y = "0mm";
    if !is_zone_empty(&schema.zones.header) {
        render_zone(&mut t, &schema.zones.header, "HEADER", data, offset_x, header_offset_y);
    }

    // 2. BODY starts after header
    // We use the min_height or 0mm as the base offset for body
    let body_offset_y = h_height.clone();
    if !is_zone_empty(&schema.zones.body) {
        render_zone(&mut t, &schema.zones.body, "BODY", data, offset_x, &body_offset_y);
    }

    // 3. FOOTER anchored to the bottom of the page
    // Position = Page Height - Footer Height
    let footer_pos = page_height_mm - parse_mm_value(&f_height);
    let footer_offset_y = format!("{}mm", footer_pos);
    if !is_zone_empty(&schema.zones.footer) {
        render_zone(&mut t, &schema.zones.footer, "FOOTER", data, offset_x, &footer_offset_y);
    }

    // 4. Empty content block to establish page flow (prevents blank page issues)
    t.push_str(&format!(
        "\n#pad(top: {} + {} + 2mm, bottom: {} + {} + 2mm, left: {}, right: {})[]\n",
        margin.top, h_height, margin.bottom, f_height, margin.left, margin.right
    ));

    t
}

/// Parses a Typst unit string like "15mm" or "2cm" into millimeters.
fn parse_mm_value(s: &str) -> f64 {
    let s = s.trim();
    if s.ends_with("mm") {
        s.trim_end_matches("mm").trim().parse::<f64>().unwrap_or(0.0)
    } else if s.ends_with("cm") {
        s.trim_end_matches("cm").trim().parse::<f64>().unwrap_or(0.0) * 10.0
    } else if s.ends_with("in") {
        s.trim_end_matches("in").trim().parse::<f64>().unwrap_or(0.0) * 25.4
    } else if s.ends_with("pt") {
        s.trim_end_matches("pt").trim().parse::<f64>().unwrap_or(0.0) * 0.3528
    } else {
        s.parse::<f64>().unwrap_or(0.0)
    }
}

/// Returns (width_mm, height_mm) for a given paper size and orientation.
/// Supports all standard Typst paper sizes. Falls back to A4 for unknown sizes.
fn paper_dimensions(size: &str, landscape: bool) -> (f64, f64) {
    let (w, h) = match size.to_lowercase().as_str() {
        // ISO A Series
        "a0" => (841.0, 1189.0),
        "a1" => (594.0, 841.0),
        "a2" => (420.0, 594.0),
        "a3" => (297.0, 420.0),
        "a4" => (210.0, 297.0),
        "a5" => (148.0, 210.0),
        "a6" => (105.0, 148.0),
        // ISO B Series
        "b4" => (250.0, 353.0),
        "b5" => (176.0, 250.0),
        // North American
        "letter" => (215.9, 279.4),
        "legal" => (215.9, 355.6),
        "tabloid" => (279.4, 431.8),
        // JIS (Japan)
        "jis-b4" => (257.0, 364.0),
        "jis-b5" => (182.0, 257.0),
        // Fallback
        _ => (210.0, 297.0), // A4
    };
    if landscape { (h, w) } else { (w, h) }
}


fn render_zone(t: &mut String, zone: &Zone, _label: &str, data: &Value, offset_x: &str, offset_y: &str) {
    if is_zone_empty(zone) {
        return;
    }
    
    for comp in &zone.components {
        t.push_str("    ");
        t.push_str(&render_component(comp, data, offset_x, offset_y, "#"));
    }
}

fn render_component(comp: &ComponentNode, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    match comp {
        ComponentNode::Text(c) => render_text(c, data, offset_x, offset_y, prefix),
        ComponentNode::Table(c) => render_table(c, data, offset_x, offset_y, prefix),
        ComponentNode::Line(c) => render_line(c, offset_x, offset_y, prefix),
        ComponentNode::Image(c) => render_image(c, offset_x, offset_y, prefix),
        ComponentNode::Spacer(c) => render_spacer(c, offset_x, offset_y, prefix),
        ComponentNode::SummaryBox(c) => render_summary_box(c, data, offset_x, offset_y, prefix),
        ComponentNode::Barcode(c) => render_barcode(c, offset_x, offset_y, prefix),
        ComponentNode::Qr(c) => render_qr(c, offset_x, offset_y, prefix),
        ComponentNode::PageBreakIndicator(c) => render_page_break_indicator(c, offset_x, offset_y, prefix),
        ComponentNode::Repeater(c) => render_placeholder_box("REPEATER (NESTED)", &c.base, "", data, offset_x, offset_y, prefix),
        ComponentNode::Columns(c) => render_placeholder_box("COLUMNS (LAYOUT)", &c.base, "", data, offset_x, offset_y, prefix),
    }
}



fn render_text(c: &TextComponent, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let content = resolve_binding(&c.content, data);
    let s = c.style.as_ref();
    let size = s.and_then(|st| st.font_size).unwrap_or(10.0);
    let weight = s.and_then(|st| st.font_weight.clone()).unwrap_or("regular".to_string());
    let align = c.base.align.as_deref().unwrap_or("left");

    let leading = s.and_then(|st| st.line_height).map(|v| v - 1.0).unwrap_or(0.2);
    let mut tracking = s.and_then(|st| st.letter_spacing.clone()).unwrap_or_default();
    if tracking.is_empty() { tracking = "0pt".to_string(); }
    let justify = s.and_then(|st| st.justify).unwrap_or(false);

    let body = if content.contains('#') && !content.contains("\\#") {
        content
    } else {
        format!(
            "#set align({})\n#set par(leading: {}em, justify: {})\n#text(size: {}pt, weight: \"{}\", tracking: {})[{}]",
            align, leading, justify, size, weight, tracking, escape_typst(&content)
        )
    };

    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
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
                    parts.push(format!("top: {}", format_color(v)));
                }
                if let Some(v) = map.get("bottom").and_then(|v| v.as_str()) {
                    parts.push(format!("bottom: {}", format_color(v)));
                }
                if let Some(v) = map.get("left").and_then(|v| v.as_str()) {
                    parts.push(format!("left: {}", format_color(v)));
                }
                if let Some(v) = map.get("right").and_then(|v| v.as_str()) {
                    parts.push(format!("right: {}", format_color(v)));
                }
                if parts.is_empty() {
                    format!("{} + {}", border_width, format_color(border_color))
                } else {
                    format!("({})", parts.join(", "))
                }
            }
            Value::String(s) => {
                // For string strokes, we try to format any hex color inside
                if s.starts_with('#') {
                    format_color(s)
                } else {
                    s.clone()
                }
            },
            _ => format!("{} + {}", border_width, format_color(border_color)),
        }
    } else {
        format!("{} + {}", border_width, format_color(border_color))
    }
}

fn render_table(c: &TableComponent, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
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
    wrap_placement(&c.base, &t, offset_x, offset_y, prefix)
}

fn render_hline(hl: &HLineConfig) -> String {
    let mut args = vec![format!("y: {}", hl.y)];
    if let Some(start) = hl.start { if start > 0 { args.push(format!("start: {}", start)); } }
    if let Some(end) = hl.end { args.push(format!("end: {}", end)); }
    if let Some(stroke) = &hl.stroke { args.push(format!("stroke: {}", format_color(stroke))); }
    if let Some(pos) = &hl.position { args.push(format!("position: {}", pos)); }
    format!("  table.hline({}),\n", args.join(", "))
}

fn render_vline(vl: &VLineConfig) -> String {
    let mut args = vec![format!("x: {}", vl.x)];
    if let Some(start) = vl.start { if start > 0 { args.push(format!("start: {}", start)); } }
    if let Some(end) = vl.end { args.push(format!("end: {}", end)); }
    if let Some(stroke) = &vl.stroke { args.push(format!("stroke: {}", format_color(stroke))); }
    if let Some(pos) = &vl.position { args.push(format!("position: {}", pos)); }
    format!("  table.vline({}),\n", args.join(", "))
}

// ─── OTHER COMPONENT RENDERERS ───────────────────────────────────────────────

fn render_line(c: &LineComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let color = c.color.as_deref().unwrap_or("black");
    let thickness = c.thickness.as_deref().unwrap_or("1pt");
    
    // If thickness is > 2pt (likely a background bar), use a rectangle for better alignment
    // Lines in Typst grow from center, while Rects grow from top-left.
    let is_heavy = thickness.ends_with("mm") || thickness.ends_with("pt") && thickness.trim_end_matches("pt").parse::<f32>().unwrap_or(0.0) > 2.0;

    let body = if is_heavy {
        format!("#rect(width: 100%, height: 100%, fill: {}, stroke: none)", format_color(color))
    } else {
        format!("#line(length: 100%, stroke: {} + {})", thickness, format_color(color))
    };
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_image(c: &ImageComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let fit = c.fit.as_deref().unwrap_or("contain");
    let path = c.src.trim();

    // Check if the image is actually available/uploaded
    // In our system, uploaded images have virtual paths starting with "img-"
    // or they have src_data present.
    let is_placeholder = path.is_empty() || (c.src_data.is_none() && !path.starts_with("img-") && !path.starts_with("http"));

    let body = if !is_placeholder {
        format!("#image(\"{}\", width: 100%, height: 100%, fit: \"{}\")", path, fit)
    } else {
        format!(
            "#rect(width: 100%, height: 100%, fill: gray.lighten(90%), stroke: 0.5pt + gray.lighten(50%), radius: 2pt)[\n    #set align(center + horizon)\n    #text(size: 8pt, fill: gray.darken(20%))[No Image]\n  ]"
        )
    };
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_spacer(c: &SpacerComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let body = format!("#v({}mm, weak: true)", c.height);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_summary_box(c: &SummaryBoxComponent, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let mut rows_typst = String::new();
    for row in &c.rows {
        if row.separator.unwrap_or(false) {
            rows_typst.push_str("  table.hline(stroke: 0.5pt + gray),\n");
        }
        let val = resolve_binding(&row.value, data);
        let style = row.style.as_deref().unwrap_or("normal");
        let is_total = style == "total";
        let is_highlight = style == "highlight";
        
        let weight = if is_total || is_highlight { "bold" } else { "regular" };
        let size = if is_total { "12" } else { "10" };
        let color = if is_total { format_color("#2563eb") } else if is_highlight { format_color("#3b82f6") } else { format_color("#1e293b") };
        let bg = if is_total { format_color("#eff6ff") } else { "none".to_string() };

        rows_typst.push_str(&format!(
            "  table.cell(inset: 5pt, fill: {})[#text(size: 9pt, fill: gray.darken(20%))[{} :]],\n",
            bg, escape_typst(&row.label)
        ));
        rows_typst.push_str(&format!(
            "  table.cell(inset: 5pt, align: right, fill: {})[#text(weight: \"{}\", size: {}pt, fill: {})[{}]],\n",
            bg, weight, size, color, escape_typst(&val)
        ));
    }
    let body = format!("#table(columns: (1fr, auto), stroke: none, inset: 1pt,\n{})", rows_typst);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_barcode(c: &BarcodeComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let val = resolve_binding(&c.value, &serde_json::Value::Null); // dummy resolve if static
    // Use codetastic native function based on format
    let func = match c.format.as_str() {
        "ean13" => "ean13",
        "ean8" => "ean8",
        _ => "ean13", // v0.2.2 doesn't have code128/pdf417, fallback to ean13
    };
    
    // EAN barcodes in codetastic have a default baseline size. 
    // ean13 width is roughly 25.08mm, height is roughly 18.28mm (excluding text).
    // To allow the user to stretch the barcode in the UI, we use Typst's #scale.
    let base_w = c.base.width.unwrap_or(30.0);
    let base_h = c.base.height.unwrap_or(15.0);
    
    let scale_x = (base_w / 25.08) * 100.0;
    let scale_y = (base_h / 18.28) * 100.0;
    
    let body = format!("#scale(x: {:.2}%, y: {:.2}%, reflow: true)[#{}(\"{}\")]", scale_x, scale_y, func, escape_typst(&val));
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_qr(c: &QRComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let val = resolve_binding(&c.value, &serde_json::Value::Null);
    let width = c.base.width.unwrap_or(30.0);
    // qrcode in codetastic expects a length for width, not a ratio
    let body = format!("#qrcode(\"{}\", width: {}mm)", escape_typst(&val), width);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_page_break_indicator(c: &PageBreakIndicatorComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let label = c.label.as_ref().map(|s| s.as_str()).unwrap_or("Continued on next page...");
    let show_page_num = c.show_page_number.unwrap_or(true);
    let stroke_style = c.style.as_deref().unwrap_or("dashed");

    // Use proper Typst stroke syntax for dashed/dotted lines
    let stroke = match stroke_style {
        "dashed" => "stroke: (paint: gray, dash: \"dashed\", thickness: 0.5pt)",
        "dotted" => "stroke: (paint: gray, dash: \"dotted\", thickness: 0.5pt)",
        _ => "stroke: 0.5pt + gray",
    };

    let body = if show_page_num {
        format!(
            "#align(center)[#line(length: 40%, {})\n#text(size: 8pt, fill: gray)[{}\n— Page #context counter(page).display()]\n#line(length: 40%, {})]",
            stroke, escape_typst(label), stroke
        )
    } else {
        format!(
            "#align(center)[#line(length: 40%, {})\n#text(size: 8pt, fill: gray)[{}]\n#line(length: 40%, {})]",
            stroke, escape_typst(label), stroke
        )
    };

    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

fn render_placeholder_box(label: &str, base: &BaseComponent, value: &str, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let val = resolve_binding(value, data);
    let body = format!(
        "#rect(width: 100%, height: 100%, fill: gray.lighten(80%), stroke: 0.5pt + black)[\n    #set align(center + horizon)\n    #text(size: 8pt)[{}\\n{}]\n  ]",
        label, escape_typst(&val)
    );
    wrap_placement(base, &body, offset_x, offset_y, prefix)
}

fn wrap_placement(base: &BaseComponent, body: &str, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);
    let h = base.height.unwrap_or(20.0);
    format!("{}place(dx: {} + {}mm, dy: {} + {}mm)[#block(width: {}mm, height: {}mm, clip: false)[{}]]\n", prefix, offset_x, x, offset_y, y, w, h, body)
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

fn is_zone_empty(zone: &Zone) -> bool {
    zone.components.is_empty() && zone.min_height.is_none()
}

fn resolve_path<'a>(path: &str, data: &'a Value) -> Option<&'a Value> {
    let p = path.trim();
    if p.is_empty() { return None; }
    let mut current = data;
    for part in p.split('.') {
        if part.is_empty() { continue; }
        current = current.get(part)?;
    }
    Some(current)
}

fn resolve_binding(expr: &str, data: &Value) -> String {
    let mut result = String::new();
    let mut last_end = 0;
    
    let mut current = 0;
    while let Some(start_offset) = expr[current..].find("{{") {
        let start = current + start_offset;
        if let Some(end_offset) = expr[start..].find("}}") {
            let end = start + end_offset;
            
            // Add static text before the placeholder
            result.push_str(&expr[last_end..start]);
            
            let path = expr[start + 2..end].trim().to_string();
            let value = resolve_path(&path, data)
                .map(|v| {
                    match v {
                        Value::String(s) => s.clone(),
                        _ => v.to_string()
                    }
                })
                .unwrap_or_else(|| format!("{{{{{}}}}}", path));
            
            result.push_str(&value);
            
            last_end = end + 2;
            current = last_end;
        } else {
            break;
        }
    }
    
    // Add remaining static text
    result.push_str(&expr[last_end..]);
    result
}

fn escape_typst(s: &str) -> String {
    // If the content starts with '#' it might be Typst code. 
    // For now, we still escape to be safe, but we'll stop escaping slashes
    // as they are rarely needed to be escaped in markup and cause issues with paths.
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
}

fn format_color(color: &str) -> String {
    let c = color.trim();
    if c.is_empty() { return "none".to_string(); }
    if c.starts_with('#') {
        format!("rgb(\"{}\")", c)
    } else if c.starts_with("rgb(") || c.starts_with("rgba(") || c.contains('.') {
        // Already formatted or is a variable (e.g. gray.darken(20%))
        c.to_string()
    } else {
        c.to_string()
    }
}
