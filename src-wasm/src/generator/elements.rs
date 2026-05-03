use crate::schema::*;
use serde_json::Value;
use super::utils::*;

pub fn render_text(c: &TextComponent, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let content = resolve_binding(&c.content, data);
    let s = c.style.as_ref();
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

    let mut body = format!(
        "#set align({})\n#set par(leading: {}em, justify: {})\n#text(size: {}pt, font: (\"{}\", \"Sarabun\", \"sans-serif\"), weight: \"{}\", style: \"{}\", fill: {}, tracking: {})",
        align, leading, justify, size, font, weight, style, format_color(color), tracking
    );

    let format_func = c.base.format.as_deref().unwrap_or("text").to_lowercase();
    
    let content_block = if format_func != "text" {
        format!("[#fmt_{}(\"{}\")]", format_func.replace("-", "_"), escape_string_literal(&content))
    } else {
        format!("[{}]", escape_typst(&content))
    };

    if underline {
        body.push_str(&format!("[#underline{}]", content_block));
    } else {
        body.push_str(&content_block);
    }

    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_line(c: &LineComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let thickness = c.thickness.as_deref().unwrap_or("1pt");
    let color = c.color.as_deref().unwrap_or("#000000");
    let style = c.style.as_deref().unwrap_or("solid");

    let stroke = match style {
        "dotted" => format!("(paint: {}, thickness: {}, dash: \"dotted\")", format_color(color), thickness),
        "dashed" => format!("(paint: {}, thickness: {}, dash: \"dashed\")", format_color(color), thickness),
        _ => format!("{} + {}", thickness, format_color(color)),
    };

    let body = format!("#line(length: 100%, stroke: {})", stroke);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_image(c: &ImageComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let src = c.src.trim();
    let is_valid = src.starts_with("asset-") || src.starts_with("data:");
    
    let body = if !src.is_empty() && is_valid {
        format!("#image(\"{}\", width: 100%, height: 100%, fit: \"{}\")", src, c.fit.as_deref().unwrap_or("cover"))
    } else if !src.is_empty() {
        format!("#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)[#set align(center + horizon); #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND]]")
    } else {
        "#rect(width: 100%, height: 100%, fill: gray.lighten(80%))[#set align(center + horizon); No Image]".to_string()
    };
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_spacer(c: &SpacerComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    wrap_placement(&c.base, "", offset_x, offset_y, prefix)
}

pub fn render_barcode(c: &BarcodeComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let sym = &c.format;
    let body = match sym.to_lowercase().as_str() {
        "ean13" => format!("#ean13(\"{}\")", c.value),
        "ean8" => format!("#ean8(\"{}\")", c.value),
        _ => format!("#rect(width: 100%, height: 100%, fill: red.lighten(80%))[Unsupported: {}]", sym),
    };
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_qr(c: &QRComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let body = format!("#qrcode(\"{}\")", c.value);
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_summary_box(c: &SummaryBoxComponent, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let mut rows_typst = String::new();
    for row in &c.rows {
        if row.separator.unwrap_or(false) {
            rows_typst.push_str("    table.hline(stroke: 0.5pt + gray.lighten(50%)),\n");
        }
        let val = resolve_binding(&row.value, data);
        let style = row.style.as_deref().unwrap_or("normal");
        let is_total = style == "total";
        
        let mut label_text = escape_typst(&row.label);
        let mut value_text = escape_typst(&val);
        
        if is_total {
            label_text = format!("*{}*", label_text);
            value_text = format!("*{}*", value_text);
        }

        rows_typst.push_str(&format!(
            "    grid.cell()[{}], grid.cell(align: right)[{}],\n",
            label_text, value_text
        ));
    }
    let body = format!(
        "#rect(width: 100%, inset: 10pt, fill: white, stroke: 0.5pt + gray.lighten(50%))[\n  #grid(columns: (1fr, 1fr), gutter: 8pt,\n{})\n]", 
        rows_typst
    );
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_page_break_indicator(c: &PageBreakIndicatorComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let label = c.label.as_deref().unwrap_or("Continued on next page...");
    let body = format!("#align(center)[#line(length: 40%, stroke: gray + 0.5pt)\n#text(size: 8pt, fill: gray)[{}]\n#line(length: 40%, stroke: gray + 0.5pt)]", escape_typst(label));
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_page_number(c: &PageNumberComponent, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let display = c.format.replace("{{page}}", "#counter(page).display()")
                     .replace("{{pageTotal}}", "#context { counter(page).final().at(0) }");

    let mut body = String::new();
    if let Some(s) = &c.style {
        let size = s.font_size.unwrap_or(10.0);
        let weight = s.font_weight.as_deref().unwrap_or("regular");
        let font = s.font_family.as_deref().unwrap_or("Sarabun");
        let color = s.color.as_deref().unwrap_or("#000000");
        body.push_str(&format!(
            "#set text(font: \"{}\", size: {}pt, weight: \"{}\", fill: {})\n",
            font, size, weight, format_color(color)
        ));
    }
    
    body.push_str(&format!("#context [{}]", display));
    wrap_placement(&c.base, &body, offset_x, offset_y, prefix)
}

pub fn render_placeholder_box(label: &str, base: &BaseComponent, value: &str, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let val = resolve_binding(value, data);
    let body = format!(
        "#rect(width: 100%, height: 100%, fill: gray.lighten(80%), stroke: 0.5pt + black)[\n    #set align(center + horizon)\n    #text(size: 8pt)[{}\\n{}]\n  ]",
        label, escape_typst(&val)
    );
    wrap_placement(base, &body, offset_x, offset_y, prefix)
}
