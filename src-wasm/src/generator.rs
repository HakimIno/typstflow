use crate::schema::*;
use serde_json::Value;

pub fn generate_typst(schema: &LayoutSchema, data: &Value) -> String {
    let mut t = String::new();
    t.push_str("// PHOENIX ENGINE (RUST/WASM) v1.1\n");

    // Page Setup (Margins are set to 0 for absolute positioning parity)
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
    if zone.components.is_empty() {
        return;
    }
    t.push_str(&format!("\n// ZONE: {}\n", label));
    t.push_str("#block(width: 100%)[\n");
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

    // Advanced Props
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

fn render_table(c: &TableComponent, data: &Value) -> String {
    let mut t = String::from("#table(\n    columns: (");
    let col_defs = c.columns.iter().map(|col| col.width.clone().replace("*", "fr")).collect::<Vec<_>>().join(", ");
    t.push_str(&col_defs);
    t.push_str("),\n    inset: 7pt,\n");

    let style = c.style.as_ref();
    let header_rows = style.and_then(|s| s.header_rows).unwrap_or(1);
    
    // 1. DYNAMIC FILL LOGIC (Skip if covered)
    t.push_str("    fill: (x, y) => {\n");
    t.push_str("      let header_bg = ");
    t.push_str(&format_color(style.and_then(|s| s.header_background.as_deref()).unwrap_or("blue.lighten(92%)")));
    t.push_str(";\n      let alt_bg = ");
    t.push_str(&format_color(style.and_then(|s| s.alternate_row_background.as_deref()).unwrap_or("white")));
    t.push_str(";\n");
    t.push_str(&format!("      if y < {} {{ header_bg }} else if calc.even(y) {{ alt_bg }} else {{ white }}\n", header_rows));
    t.push_str("    },\n");

    // 2. STROKE LOGIC
    let border_color = style.and_then(|s| s.border_color.as_deref()).unwrap_or("gray.lighten(50%)");
    let border_width = style.and_then(|s| s.border_width.as_deref()).unwrap_or("0.5pt");
    t.push_str(&format!("    stroke: {} + {},\n", border_width, format_color(border_color)));

    let mut current_y = 0;

    // 3. HEADERS (Overlap & Skip)
    if c.show_header.unwrap_or(true) {
        let mut covered = std::collections::HashSet::new();
        for x in 0..c.columns.len() {
            if covered.contains(&x) { continue; }
            let col = &c.columns[x];
            let cs = col.colspan.unwrap_or(1);
            let rs = col.rowspan.unwrap_or(1);
            let align = col.align.as_deref().unwrap_or("center");
            
            if cs == 1 && rs == 1 {
                t.push_str(&format!(
                    "    [#set align({}); *{}*],\n",
                    align, escape_typst(&col.header)
                ));
            } else {
                t.push_str(&format!(
                    "    table.cell(x: {}, y: {}, colspan: {}, rowspan: {})[#set align({}); *{}*],\n",
                    x, current_y, cs, rs, align, escape_typst(&col.header)
                ));
            }
            
            for i in 1..cs { covered.insert(x + i as usize); }
        }
        current_y += 1;
    }

    // 4. DATA ROWS (Overlap & Skip)
    let path = c.data_source.replace("{{", "").replace("}}", "").trim().to_string();
    if let Some(serde_json::Value::Array(items)) = resolve_path(&path, data) {
        for item in items {
            let mut covered = std::collections::HashSet::new();
            for x in 0..c.columns.len() {
                if covered.contains(&x) { continue; }
                let col = &c.columns[x];
                let cs = col.colspan.unwrap_or(1);
                let rs = col.rowspan.unwrap_or(1);
                let val = resolve_path(&col.field, item).map(|v| {
                    match v {
                        serde_json::Value::String(s) => s.clone(),
                        _ => v.to_string(),
                    }
                }).unwrap_or_default();
                let align = col.align.as_deref().unwrap_or("left");

                if cs == 1 && rs == 1 {
                    t.push_str(&format!(
                        "    [#set align({}); {}],\n",
                        align, escape_typst(&val)
                    ));
                } else {
                    t.push_str(&format!(
                        "    table.cell(x: {}, y: {}, colspan: {}, rowspan: {})[#set align({}); {}],\n",
                        x, current_y, cs, rs, align, escape_typst(&val)
                    ));
                }
                
                for i in 1..cs { covered.insert(x + i as usize); }
            }
            current_y += 1;
        }
    }

    t.push_str("  )");
    wrap_placement(&c.base, &t)
}

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
        let val = resolve_binding(&row.value, data);
        let weight = if row.style.as_deref() == Some("total") { "bold" } else { "regular" };
        rows_typst.push_str(&format!(
            "  [{}::], [#text(weight: \"{}\")[{}]],\n",
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

fn resolve_path<'a>(path: &str, data: &'a Value) -> Option<&'a Value> {
    if path.is_empty() { return Some(data); }
    let mut current = data;
    for part in path.split('.') {
        current = current.get(part)?;
    }
    Some(current)
}

fn resolve_binding(expr: &str, data: &Value) -> String {
    // Basic regex-less binding resolution for WASM simplicity
    let mut result = expr.to_string();
    while let Some(start) = result.find("{{") {
        if let Some(end) = result[start..].find("}}") {
            let path = &result[start + 2..start + end].trim();
            let value = resolve_path(path, data)
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
