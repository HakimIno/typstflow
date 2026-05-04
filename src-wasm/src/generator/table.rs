use crate::schema::*;
use serde_json::Value;
use super::utils::*;
use std::collections::HashSet;

pub fn render_table(c: &TableComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let mut t = String::new();
    let cols = &c.columns;
    let style = c.style.as_ref();

    // ── 1. TABLE DEFINITION ──────────────────────────────────────────────────
    let mut table_args = Vec::new();
    table_args.push(format!("columns: ({})", cols.iter().map(|col| col.width.clone().replace("*", "fr")).collect::<Vec<_>>().join(", ")));
    
    // Inset
    let inset = style.and_then(|s| s.inset.as_deref().or(s.cell_padding.as_deref())).unwrap_or("7pt");
    table_args.push(format!("inset: {}", inset));

    // Stroke
    let border_width = style.and_then(|s| s.border_width.as_deref()).unwrap_or("0.5pt");
    let border_color = style.and_then(|s| s.border_color.as_deref()).unwrap_or("#cbd5e1");
    let stroke_val = style.and_then(|s| s.stroke.as_ref());
    
    let mut stroke_str = format!("{} + {}", border_width, format_color(border_color));
    if let Some(sv) = stroke_val {
        if let Value::String(s) = sv {
            if s.starts_with('#') { stroke_str = format_color(s); }
            else { stroke_str = s.clone(); }
        } else if let Value::Object(map) = sv {
            let mut parts = Vec::new();
            if let Some(v) = map.get("top").and_then(|v| v.as_str()) { parts.push(format!("top: {}", format_color(v))); }
            if let Some(v) = map.get("bottom").and_then(|v| v.as_str()) { parts.push(format!("bottom: {}", format_color(v))); }
            if let Some(v) = map.get("left").and_then(|v| v.as_str()) { parts.push(format!("left: {}", format_color(v))); }
            if let Some(v) = map.get("right").and_then(|v| v.as_str()) { parts.push(format!("right: {}", format_color(v))); }
            if !parts.is_empty() { stroke_str = format!("({})", parts.join(", ")); }
        }
    }
    table_args.push(format!("stroke: {}", stroke_str));

    // Fill
    let fill_pattern = style.and_then(|s| s.fill_pattern.as_deref()).unwrap_or("header-only");
    let header_bg = style.and_then(|s| s.header_background.as_deref()).unwrap_or("#e2e8f0");
    let color1 = style.and_then(|s| s.striped_color1.as_deref().or(s.alternate_row_background.as_deref())).unwrap_or("#f8fafc");
    let color2 = style.and_then(|s| s.striped_color2.as_deref()).unwrap_or("#ffffff");

    let header_rows_count = if let Some(h_rows) = &c.header_rows {
        h_rows.len() as u32
    } else if c.show_header.unwrap_or(true) {
        1u32
    } else {
        0u32
    };

    if fill_pattern != "none" {
        let fill_fn = match fill_pattern {
            "header-only" => format!("(x, y) => if y < {} {{ {} }} else {{ none }}", header_rows_count, format_color(header_bg)),
            "striped-rows" => format!("(x, y) => if y < {} {{ {} }} else if calc.even(y) {{ {} }} else {{ {} }}", header_rows_count, format_color(header_bg), format_color(color1), format_color(color2)),
            "striped-cols" => format!("(x, y) => if y < {} {{ {} }} else if calc.even(x) {{ {} }} else {{ {} }}", header_rows_count, format_color(header_bg), format_color(color1), format_color(color2)),
            "checkerboard" => format!("(x, y) => if y < {} {{ {} }} else if calc.even(x + y) {{ {} }} else {{ {} }}", header_rows_count, format_color(header_bg), format_color(color1), format_color(color2)),
            _ => format!("(x, y) => if y < {} {{ {} }} else {{ none }}", header_rows_count, format_color(header_bg)),
        };
        table_args.push(format!("fill: {}", fill_fn));
    }

    t.push_str(&format!("#table(\n  {},\n", table_args.join(",\n  ")));

    // ── 2. HEADERS ────────────────────────────────────────────────────────────
    let repeat = c.repeat_header_on_page.unwrap_or(true);
    if let Some(header_rows) = &c.header_rows {
        t.push_str(&format!("  table.header(repeat: {},\n", repeat));
        for row in header_rows {
            for cell in &row.cells {
                let content = escape_typst(&cell.content);
                let cs = cell.colspan.unwrap_or(1);
                let rs = cell.rowspan.unwrap_or(1);
                let mut args = Vec::new();
                if cs > 1 { args.push(format!("colspan: {}", cs)); }
                if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                if let Some(f) = &cell.fill { args.push(format!("fill: {}", format_color(f))); }
                if let Some(a) = &cell.align { args.push(format!("align: {}", a)); }
                if let Some(i) = &cell.inset { args.push(format!("inset: {}", i)); }
                
                if args.is_empty() {
                    t.push_str(&format!("    [*{}*],\n", content));
                } else {
                    t.push_str(&format!("    table.cell({})[*{}*],\n", args.join(", "), content));
                }
            }
        }
        t.push_str("  ),\n");
    } else if c.show_header.unwrap_or(true) {
        t.push_str(&format!("  table.header(repeat: {},\n", repeat));
        let mut covered = HashSet::new();
        for (x, col) in cols.iter().enumerate() {
            if covered.contains(&x) { continue; }
            let cs = col.colspan.unwrap_or(1);
            let rs = col.rowspan.unwrap_or(1);
            let col_align = col.align.as_deref().unwrap_or("center");
            let header_text = escape_typst(&col.header);

            if cs == 1 && rs == 1 {
                t.push_str(&format!("    [#set align({}); *{}*],\n", col_align, header_text));
            } else {
                t.push_str(&format!("    table.cell(x: {}, y: 0, colspan: {}, rowspan: {})[#set align({}); *{}*],\n", x, cs, rs, col_align, header_text));
            }
            for i in 1..(cs as usize) { covered.insert(x + i); }
        }
        t.push_str("  ),\n");
    }

    // ── 3. HLINES before data ────────────────────────────────────────────────
    if let Some(hlines) = &c.hlines {
        for hl in hlines.iter().filter(|h| h.y <= header_rows_count) {
            t.push_str(&render_hline(hl));
        }
    }

    // ── 4. DATA ROWS ─────────────────────────────────────────────────────────
    let is_static = c.is_static.unwrap_or(false);

    let render_item = |item: &Value, t_out: &mut String| {
        if let Some(detail_rows) = &c.detail_rows {
            for row in detail_rows {
                for cell in &row.cells {
                    let val = resolve_binding_scoped(&cell.content, item, global);
                    let format_func = cell.format.as_deref().unwrap_or("text").to_lowercase();
                    let inner_content = if format_func != "text" {
                        format!("#fmt_{}(\"{}\")", format_func.replace("-", "_"), escape_string_literal(&val))
                    } else {
                        escape_typst(&val)
                    };

                    let cs = cell.colspan.unwrap_or(1);
                    let rs = cell.rowspan.unwrap_or(1);
                    let mut args = Vec::new();
                    if cs > 1 { args.push(format!("colspan: {}", cs)); }
                    if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                    if let Some(f) = &cell.fill { args.push(format!("fill: {}", format_color(f))); }
                    if let Some(a) = &cell.align { args.push(format!("align: {}", a)); }
                    if let Some(i) = &cell.inset { args.push(format!("inset: {}", i)); }
                    
                    t_out.push_str(&format!("  table.cell({})[{}],\n", args.join(", "), inner_content));
                }
            }
        } else {
            let mut covered = HashSet::new();
            for (x, col) in cols.iter().enumerate() {
                if covered.contains(&x) { continue; }
                let cs = col.colspan.unwrap_or(1);
                let rs = col.rowspan.unwrap_or(1);
                let val = resolve_path(&col.field, item).map(|v| match v {
                    Value::String(s) => s.clone(),
                    _ => v.to_string(),
                }).unwrap_or_default();
                
                let format_func = col.format.as_deref().unwrap_or("text").to_lowercase();
                let inner_content = if format_func != "text" {
                    format!("#fmt_{}(\"{}\")", format_func.replace("-", "_"), escape_string_literal(&val))
                } else {
                    escape_typst(&val)
                };

                let col_align = col.align.as_deref().unwrap_or("left");
                let bg = col.background.as_deref();
                
                let mut args = Vec::new();
                args.push(format!("align: {}", col_align));
                if let Some(b) = bg { args.push(format!("fill: {}", format_color(b))); }
                if cs > 1 { args.push(format!("colspan: {}", cs)); }
                if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                
                t_out.push_str(&format!("  table.cell({})[{}],\n", args.join(", "), inner_content));

                for i in 1..(cs as usize) { covered.insert(x + i); }
            }
        }
    };

    if is_static {
        render_item(local, &mut t);
    } else {
        let path = c.data_source.replace("{{", "").replace("}}", "").trim().to_string();
        let arr_opt = resolve_path(&path, local)
            .or_else(|| resolve_path(&path, global));
        if let Some(Value::Array(arr)) = arr_opt {
            let arr = arr.clone();
            for item in &arr {
                render_item(item, &mut t);
            }
        }
    }

    // ── 5. HLINES after data ─────────────────────────────────────────────────
    if let Some(hlines) = &c.hlines {
        for hl in hlines.iter().filter(|h| h.y > header_rows_count) {
            t.push_str(&render_hline(hl));
        }
    }

    // ── 6. VLINES ────────────────────────────────────────────────────────────
    if let Some(vlines) = &c.vlines {
        for vl in vlines {
            t.push_str(&render_vline(vl));
        }
    }

    // ── 7. FOOTER ROWS ───────────────────────────────────────────────────────
    if let Some(footer_rows) = &c.footer_rows {
        let repeat = footer_rows.first().and_then(|r| r.repeat).unwrap_or(true);
        t.push_str(&format!("  table.footer(repeat: {},\n", repeat));
        for row in footer_rows {
            for cell in &row.cells {
                let val = resolve_binding_scoped(&cell.content, local, global);
                let content = escape_typst(&val);
                let cs = cell.colspan.unwrap_or(1);
                let rs = cell.rowspan.unwrap_or(1);
                let mut args = Vec::new();
                if cs > 1 { args.push(format!("colspan: {}", cs)); }
                if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                if let Some(f) = &cell.fill { args.push(format!("fill: {}", format_color(f))); }
                if let Some(a) = &cell.align { args.push(format!("align: {}", a)); }
                
                if args.is_empty() {
                    t.push_str(&format!("    [*{}*],\n", content));
                } else {
                    t.push_str(&format!("    table.cell({})[*{}*],\n", args.join(", "), content));
                }
            }
        }
        t.push_str("  ),\n");
    }

    // ── 8. LEGACY SUMMARY ROWS ───────────────────────────────────────────────
    if let Some(summary_rows) = &c.summary_rows {
        for row in summary_rows {
            if row.separator.unwrap_or(false) {
                t.push_str("  table.hline(stroke: 1pt + black),\n");
            }
            let val = resolve_binding_scoped(&row.value, local, global);
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

    t.push_str(")\n");
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
