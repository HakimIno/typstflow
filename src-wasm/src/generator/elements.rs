use crate::schema::*;
use serde_json::Value;
use super::utils::*;

pub fn render_text(c: &TextComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let raw_content = resolve_binding_scoped(&c.content, local, global);
    let s = c.style.as_ref();

    let transform = s.and_then(|st| st.text_transform.as_deref()).unwrap_or("none");
    let content = apply_text_transform(&raw_content, transform);

    let size = s.and_then(|st| st.font_size).unwrap_or(10.0);
    let weight = s.and_then(|st| st.font_weight.clone()).unwrap_or("regular".to_string());
    let align = c.base.align.as_deref().unwrap_or("left");

    let leading = s.and_then(|st| st.line_height).map(|v| v - 1.0).unwrap_or(0.2);
    let mut tracking = s.and_then(|st| st.letter_spacing.clone()).unwrap_or_default();
    if tracking.is_empty() { tracking = "0pt".to_string(); }
    let justify = s.and_then(|st| st.justify).unwrap_or(false);

    let color = s.and_then(|st| st.color.as_deref()).unwrap_or("#000000");
    let font = s.and_then(|st| st.font_family.as_deref()).unwrap_or("Sarabun");
    let style = if s.and_then(|st| st.italic).unwrap_or(false) { "italic" } else { "normal" };
    let underline = s.and_then(|st| st.underline).unwrap_or(false);

    let format_func = c.base.format.as_deref().unwrap_or("text").to_lowercase();

    let content_block = if format_func != "text" {
        format!("[#fmt_{}(\"{}\")]", format_func.replace('-', "_"), escape_string_literal(&content))
    } else {
        format!("[{}]", escape_typst(&content))
    };

    let mut body = format!(
        "#set align({})\n#set par(leading: {}em, justify: {})\n#text(size: {}pt, font: (\"{}\", \"Sarabun\", \"sans-serif\"), weight: \"{}\", style: \"{}\", fill: {}, tracking: {})",
        align, leading, justify, size, font, weight, style, format_color(color), tracking
    );

    if underline {
        body.push_str(&format!("[#underline{}]", content_block));
    } else {
        body.push_str(&content_block);
    }

    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_line(c: &LineComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let orientation = c.orientation.as_deref().unwrap_or("horizontal");
    let (start, end) = if orientation == "vertical" {
        ("(50%, 0%)", "(50%, 100%)")
    } else {
        ("(0%, 50%)", "(100%, 50%)")
    };

    // Advanced manual override
    if let Some(stroke_override) = &c.stroke {
        let body = format!("#line(start: {}, end: {}, stroke: {})", start, end, stroke_override);
        return wrap_placement(&c.base, &body, offset_x, offset_y, prefix);
    }

    let thickness = c.thickness.as_deref().unwrap_or("1pt");
    let color = c.color.as_deref().unwrap_or("#000000");
    let style = c.style.as_deref().unwrap_or("solid");
    let cap = c.cap.as_deref().unwrap_or("butt");

    let mut stroke_parts = vec![
        format!("paint: {}", format_color(color)),
        format!("thickness: {}", thickness),
        format!("cap: \"{}\"", cap),
    ];

    if let Some(dash_raw) = &c.dash_array {
        let trimmed = dash_raw.trim();
        if !trimmed.is_empty() {
            // Replace spaces with commas for Typst array syntax
            let formatted_dash = trimmed.replace(' ', ", ");
            stroke_parts.push(format!("dash: ({})", formatted_dash));
        }
    } else if style == "dotted" {
        stroke_parts.push("dash: \"dotted\"".to_string());
    } else if style == "dashed" {
        stroke_parts.push("dash: \"dashed\"".to_string());
    }

    let stroke = format!("({})", stroke_parts.join(", "));
    let body = format!("#line(start: {}, end: {}, stroke: {})", start, end, stroke);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}



pub fn render_image(c: &ImageComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let src = c.src.trim();
    let is_valid = src.starts_with("asset-") || src.starts_with("data:");

    let body = if !src.is_empty() && is_valid {
        format!(
            "#image(\"{}\", width: 100%, height: 100%, fit: \"{}\")",
            src,
            c.fit.as_deref().unwrap_or("contain")
        )
    } else if !src.is_empty() {
        "#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)[#set align(center + horizon); #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND]]".to_string()
    } else {
        "#rect(width: 100%, height: 100%, fill: gray.lighten(80%))[#set align(center + horizon); No Image]".to_string()
    };
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_spacer(c: &SpacerComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }
    wrap_placement(&c.base, "", offset_x, offset_y, prefix)
}

pub fn render_barcode(c: &BarcodeComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let sym = &c.format;
    let w = c.base.width.unwrap_or(40.0);

    let body = match sym.to_lowercase().as_str() {
        "ean13" => format!("#ean13(\"{}\")", c.value),
        "ean8" => format!("#ean8(\"{}\")", c.value),
        "qrcode" | "qr" => format!("#qrcode(\"{}\", width: {}mm)", c.value, w),
        _ => format!(
            "#rect(width: 100%, height: 100%, fill: red.lighten(90%), stroke: 0.5pt + red)[#set align(center + horizon); #text(size: 7pt, fill: red.darken(30%), weight: \"bold\")[Unsupported: {}]]",
            sym
        ),
    };
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_qr(c: &QRComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let w = c.base.width.unwrap_or(20.0);
    let val = resolve_binding_scoped(&c.value, local, global);
    let body = format!("#qrcode(\"{}\", width: {}mm)", escape_string_literal(&val), w);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_summary_box(c: &SummaryBoxComponent, local: &Value, global: &Value, items: &[Value], offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let mut rows_typst = String::new();
    for row in &c.rows {
        if row.separator.unwrap_or(false) {
            rows_typst.push_str("    table.hline(stroke: 0.5pt + gray.lighten(50%)),\n");
        }
        let val = resolve_binding_with_aggregates(&row.value, local, global, items);
        let style = row.style.as_deref().unwrap_or("normal");
        let is_total = style == "total";
        let is_highlight = style == "highlight";

        let label_text = escape_typst(&row.label);
        let value_text = escape_typst(&val);

        let fill_attr = if is_highlight { " fill: yellow.lighten(80%)," } else { "" };

        let (label_out, value_out) = if is_total {
            (format!("*{}*", label_text), format!("*{}*", value_text))
        } else {
            (label_text, value_text)
        };

        rows_typst.push_str(&format!(
            "    grid.cell({fill_attr})[{label_out}], grid.cell({fill_attr} align: right)[{value_out}],\n"
        ));
    }

    let body = format!(
        "#rect(width: 100%, inset: 10pt, fill: white, stroke: 0.5pt + gray.lighten(50%))[\n  #grid(columns: (1fr, 1fr), gutter: 8pt,\n{})\n]",
        rows_typst
    );
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_page_break_indicator(c: &PageBreakIndicatorComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let label = c.label.as_deref().unwrap_or("Continued on next page...");
    let body = format!(
        "#align(center)[#line(length: 40%, stroke: gray + 0.5pt)\n#text(size: 8pt, fill: gray)[{}]\n#line(length: 40%, stroke: gray + 0.5pt)]",
        escape_typst(label)
    );
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_page_number(c: &PageNumberComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let display = c.format
        .replace("{{page}}", "#counter(page).display()")
        .replace("{{pageTotal}}", "#context { counter(page).final().at(0) }");

    let mut body = String::new();
    if let Some(s) = &c.style {
        let size = s.font_size.unwrap_or(10.0);
        let weight = s.font_weight.as_deref().unwrap_or("regular");
        let font = s.font_family.as_deref().unwrap_or("Sarabun");
        let color = s.color.as_deref().unwrap_or("#000000");
        let align = c.base.align.as_deref().unwrap_or("left");
        body.push_str(&format!(
            "#set align({})\n#set text(font: \"{}\", size: {}pt, weight: \"{}\", fill: {})\n",
            align, font, size, weight, format_color(color)
        ));
    }

    body.push_str(&format!("#context [{}]", display));
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

/// Render a Repeater: iterate over data source items, render children for each.
pub fn render_repeater(
    c: &RepeaterComponent,
    local: &Value,
    global: &Value,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
    render_fn: &dyn Fn(&ComponentNode, &Value, &Value, &str, &str, &str) -> String,
) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let path = c.data_source.replace("{{", "").replace("}}", "");
    let path = path.trim();

    // Try local context first, then global
    let items_opt = resolve_path(path, local)
        .or_else(|| resolve_path(path, global));

    let items = match items_opt {
        Some(Value::Array(arr)) => arr.clone(),
        _ => vec![],
    };

    let mut out = String::new();
    for item in &items {
        for child in &c.children {
            out.push_str(&render_fn(child, item, global, offset_x, offset_y, prefix));
        }
    }
    out
}

/// Render a Columns layout: side-by-side grid of component groups.
pub fn render_columns(
    c: &ColumnsComponent,
    local: &Value,
    global: &Value,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
    render_fn: &dyn Fn(&ComponentNode, &Value, &Value, &str, &str, &str) -> String,
) -> String {
    if !is_visible(&c.base, local, global) { return String::new(); }

    let gutter = c.gap.as_deref().unwrap_or("10pt");
    let widths: Vec<String> = c.columns.iter()
        .map(|col| col.width.replace('*', "fr"))
        .collect();

    let col_contents: Vec<String> = c.columns.iter()
        .map(|col| {
            let children: Vec<String> = col.components.iter()
                .map(|child| render_fn(child, local, global, "0mm", "0mm", ""))
                .collect();
            format!("[{}]", children.join(""))
        })
        .collect();

    let body = format!(
        "#grid(columns: ({}), gutter: {}, {})",
        widths.join(", "),
        gutter,
        col_contents.join(", ")
    );
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}
