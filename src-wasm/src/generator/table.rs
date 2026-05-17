use crate::schema::*;
use serde_json::Value;
use std::collections::HashSet;

use super::bindings::{resolve_binding_scoped, resolve_binding_with_aggregates, resolve_path};
use super::formatting::{escape_string_literal, escape_typst, format_color};
use super::placement::wrap_flow;

pub fn render_table(c: &TableComponent, local: &Value, global: &Value, offset_x: &str, offset_y: &str, prefix: &str, _flow_mode: bool) -> String {
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
    let color1 = style.and_then(|s| s.striped_color1.as_deref().or(s.alternate_row_background.as_deref())).unwrap_or("#ffffff");
    let color2 = style.and_then(|s| s.striped_color2.as_deref()).unwrap_or("#f8fafc");
    
    let header_rows_count = if let Some(h_rows) = &c.header_rows {
        h_rows.len() as u32
    } else if c.show_header.unwrap_or(true) {
        1u32
    } else {
        0u32
    };

    // Header specific
    let h_border_width = style.and_then(|s| s.header_border_width.as_deref()).unwrap_or(border_width);
    let h_border_color = style.and_then(|s| s.header_border_color.as_deref()).unwrap_or(border_color);
    
    // Inner Body specific
    let inner_h_width = style.and_then(|s| s.inner_h_border_width.as_deref()).unwrap_or(border_width);
    let inner_h_color = style.and_then(|s| s.inner_h_border_color.as_deref()).unwrap_or(border_color);
    let inner_v_width = style.and_then(|s| s.inner_v_border_width.as_deref()).unwrap_or(border_width);
    let inner_v_color = style.and_then(|s| s.inner_v_border_color.as_deref()).unwrap_or(border_color);

    let h_dash = style.and_then(|s| s.horizontal_dash.as_deref()).filter(|&d| d != "solid").map(|d| format!(", dash: \"{}\"", d)).unwrap_or_default();
    let v_dash = style.and_then(|s| s.vertical_dash.as_deref()).filter(|&d| d != "solid").map(|d| format!(", dash: \"{}\"", d)).unwrap_or_default();
    
    let hh_dash = style.and_then(|s| s.header_horizontal_dash.as_deref()).filter(|&d| d != "solid").map(|d| format!(", dash: \"{}\"", d)).unwrap_or_default();
    let vh_dash = style.and_then(|s| s.header_vertical_dash.as_deref()).filter(|&d| d != "solid").map(|d| format!(", dash: \"{}\"", d)).unwrap_or_default();
    
    let sides = style.and_then(|s| s.border_sides.as_ref());
    let s_top = sides.map(|s| s.top).unwrap_or(true);
    let s_bottom = sides.map(|s| s.bottom).unwrap_or(true);
    let s_left = sides.map(|s| s.left).unwrap_or(true);
    let s_right = sides.map(|s| s.right).unwrap_or(true);
    let s_inner_h = sides.map(|s| s.inner_h).unwrap_or(true);
    let s_inner_v = sides.map(|s| s.inner_v).unwrap_or(true);

    let stroke_str = format!(
        "(x, y) => (\n    \
          top: if y == 0 {{ if {} {{ (paint: {}, thickness: {}) }} else {{ none }} }} \n         \
               else if y == {} {{ (paint: {}, thickness: {}) }} \n \
               else if y < {} {{ (paint: {}, thickness: {}{}) }} \n \
               else {{ if {} {{ (paint: {}, thickness: {}{}) }} else {{ none }} }},\n    \
          left: if x == 0 {{ if {} {{ (paint: {}, thickness: {}) }} else {{ none }} }} \n          \
                else if y < {} {{ (paint: {}, thickness: {}{}) }} \n \
                else {{ if {} {{ (paint: {}, thickness: {}{}) }} else {{ none }} }},\n    \
          bottom: none,\n    \
          right: none,\n  \
        )",
        s_top, format_color(border_color), border_width,
        header_rows_count, format_color(h_border_color), h_border_width,
        header_rows_count, format_color(border_color), border_width, hh_dash,
        s_inner_h, format_color(inner_h_color), inner_h_width, h_dash,
        s_left, format_color(border_color), border_width,
        header_rows_count, format_color(inner_v_color), inner_v_width, vh_dash,
        s_inner_v, format_color(inner_v_color), inner_v_width, v_dash
    );
    table_args.push(format!("stroke: {}", stroke_str));

    // Fill
    let fill_pattern = style.and_then(|s| s.fill_pattern.as_deref()).unwrap_or("header-only");
    let header_bg = style.and_then(|s| s.header_background.as_deref()).unwrap_or("#f1f5f9");

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

    // ── Text Defaults ──────────────────────────────────────────────────────────
    let header_font_size = style.and_then(|s| s.header_font_size).unwrap_or(10.0);
    let header_color = style.and_then(|s| s.header_color.as_deref().or(s.header_text_color.as_deref())).unwrap_or("#000000");
    let header_font_weight = style.and_then(|s| s.header_font_weight.as_deref()).unwrap_or("700");
    let body_font_size = style.and_then(|s| s.body_font_size).unwrap_or(10.0);
    let body_color = style.and_then(|s| s.body_color.as_deref()).unwrap_or("#334155");

    let mut prefix_text = String::new();
    if let Some(s) = style {
        let mut t_args = Vec::new();
        if let Some(fs) = s.font_size { t_args.push(format!("size: {}pt", fs)); }
        if let Some(fw) = &s.font_weight { t_args.push(format!("weight: {}", format_weight(fw))); }
        if let Some(ff) = &s.font_family { t_args.push(format!("font: \"{}\"", ff)); }
        if !t_args.is_empty() {
            prefix_text.push_str(&format!("#set text({})\n", t_args.join(", ")));
        }
        
        if let Some(lh) = s.line_height {
            prefix_text.push_str(&format!("#set par(leading: {}em)\n", lh - 1.0));
        }
    }
    
    t.push_str(&prefix_text);
    t.push_str(&format!("#table(\n  {},\n", table_args.join(",\n  ")));

    // ── 2. HEADERS ────────────────────────────────────────────────────────────
    let mut repeat = true;
    if let Some(repeat_val) = &c.repeat_header_on_page {
        match repeat_val {
            Value::Bool(b) => repeat = b.clone(),
            Value::String(s) => {
                let resolved = resolve_binding_scoped(s.as_str(), local, global);
                repeat = resolved != "false" && resolved != "0" && !resolved.is_empty();
            },
            _ => {}
        }
    }

    let global_header_bg = style.and_then(|s| s.header_background.as_deref());

    if let Some(header_rows) = &c.header_rows {
        t.push_str(&format!("  table.header(repeat: {},\n", repeat));
        for (y, row) in header_rows.iter().enumerate() {
            for (x, cell) in row.cells.iter().enumerate() {
                // Resolve bindings in header (manual headers might contain variables)
                let val = resolve_binding_scoped(&cell.content, local, global);
                
                // --- Formatting ---
                let format_func = cell.format.as_deref().unwrap_or("text").to_lowercase();
                let inner_content = if format_func != "text" {
                    format!("#fmt_{}(\"{}\")", format_func.replace("-", "_"), escape_string_literal(&val))
                } else {
                    escape_typst(&val)
                };

                // Check cell_styles for header:row:col or header:col
                let cell_key = format!("header:{}", x); // Simple column-based key
                let specific_key = format!("header:{}:{}", y, x); // Row-specific key
                
                let mut cell_style = cell.style.clone();
                if let Some(s) = style {
                    if let Some(cs_map) = &s.cell_styles {
                        if let Some(cs) = cs_map.get(&specific_key).or(cs_map.get(&cell_key)) {
                            let mut merged = cell_style.unwrap_or(TextStyle {
                                font_size: None, font_family: None, font_weight: None, color: None,
                                italic: None, underline: None, line_height: None, letter_spacing: None,
                                justify: None, text_transform: None, align: None,
                            });
                            if let Some(sz) = cs.size { merged.font_size = Some(sz); }
                            if let Some(wt) = &cs.weight { merged.font_weight = Some(wt.clone()); }
                            if let Some(cl) = &cs.color { merged.color = Some(cl.clone()); }
                            cell_style = Some(merged);
                        }
                    }
                }

                let inner = render_cell_text_with_style(
                    &inner_content,
                    cell_style.as_ref(),
                    header_font_size, 
                    header_color, 
                    header_font_weight
                );
                
                // Also check for fill/align overrides in cell_styles
                let mut cell_fill = cell.fill.clone().or_else(|| global_header_bg.map(|s| s.to_string()));
                let mut cell_align = cell.align.clone();
                if let Some(s) = style {
                    if let Some(cs_map) = &s.cell_styles {
                        if let Some(cs) = cs_map.get(&specific_key).or(cs_map.get(&cell_key)) {
                            if cs.fill.is_some() { cell_fill = cs.fill.clone(); }
                            if cs.align.is_some() { cell_align = cs.align.clone(); }
                        }
                    }
                }

                t.push_str(&format!("    {},\n", render_cell_container_v2(cell, &inner, cell_fill, cell_align)));
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
            
            // Check cell_styles for header:col
            let cell_key = format!("header:{}", x);
            let mut col_style = col.style.clone();
            let mut col_fill = col.background.clone().or_else(|| global_header_bg.map(|s| s.to_string()));
            let mut col_align = col.align.clone();

            if let Some(s) = style {
                if let Some(cs_map) = &s.cell_styles {
                    if let Some(cs) = cs_map.get(&cell_key) {
                        let mut merged = col_style.unwrap_or(TextStyle {
                            font_size: None, font_family: None, font_weight: None, color: None,
                            italic: None, underline: None, line_height: None, letter_spacing: None,
                            justify: None, text_transform: None, align: None,
                        });
                        if let Some(sz) = cs.size { merged.font_size = Some(sz); }
                        if let Some(wt) = &cs.weight { merged.font_weight = Some(wt.clone()); }
                        if let Some(cl) = &cs.color { merged.color = Some(cl.clone()); }
                        col_style = Some(merged);
                        if cs.fill.is_some() { col_fill = cs.fill.clone(); }
                        if cs.align.is_some() { col_align = cs.align.clone(); }
                    }
                }
            }

            let final_align = col_align.unwrap_or_else(|| "center".to_string());
            let header_text = escape_typst(col.header.as_deref().unwrap_or(""));

            let mut args = Vec::new();
            if cs > 1 { args.push(format!("colspan: {}", cs)); }
            if rs > 1 { args.push(format!("rowspan: {}", rs)); }
            args.push(format!("align: {}", final_align));
            if let Some(f) = col_fill { args.push(format!("fill: {}", format_color(&f))); }
            
            let inner = render_cell_text_with_style(
                &header_text,
                col_style.as_ref(),
                header_font_size, 
                header_color, 
                header_font_weight
            );

            t.push_str(&format!("    table.cell({})[{}],\n", args.join(", "), inner));

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

    let render_item = |item: &Value, t_out: &mut String, _row_idx: usize| {
        if let Some(detail_rows) = &c.detail_rows {
            for (y, row) in detail_rows.iter().enumerate() {
                for (x, cell) in row.cells.iter().enumerate() {
                    let val = resolve_binding_scoped(&cell.content, item, global);
                    let format_func = cell.format.as_deref().unwrap_or("text").to_lowercase();
                    let inner_content = if format_func != "text" {
                        format!("#fmt_{}(\"{}\")", format_func.replace("-", "_"), escape_string_literal(&val))
                    } else {
                        escape_typst(&val)
                    };

                    // Check cell_styles for data:x or data:y:x
                    let cell_key = format!("data:{}", x);
                    let specific_key = format!("data:{}:{}", y, x);
                    
                    let mut cell_style = cell.style.clone();
                    let mut cell_fill = cell.fill.clone();
                    let mut cell_align = cell.align.clone();

                    if let Some(s) = style {
                        if let Some(cs_map) = &s.cell_styles {
                            if let Some(cs) = cs_map.get(&specific_key).or(cs_map.get(&cell_key)) {
                                let mut merged = cell_style.unwrap_or(TextStyle {
                                    font_size: None, font_family: None, font_weight: None, color: None,
                                    italic: None, underline: None, line_height: None, letter_spacing: None,
                                    justify: None, text_transform: None, align: None,
                                });
                                if let Some(sz) = cs.size { merged.font_size = Some(sz); }
                                if let Some(wt) = &cs.weight { merged.font_weight = Some(wt.clone()); }
                                if let Some(cl) = &cs.color { merged.color = Some(cl.clone()); }
                                cell_style = Some(merged);
                                if cs.fill.is_some() { cell_fill = cs.fill.clone(); }
                                if cs.align.is_some() { cell_align = cs.align.clone(); }
                            }
                        }
                    }

                    let inner = render_cell_text_with_style(
                        &inner_content, 
                        cell_style.as_ref(), 
                        body_font_size, 
                        body_color, 
                        "400"
                    );
                    t_out.push_str(&format!("  {},\n", render_cell_container_v2(cell, &inner, cell_fill, cell_align)));
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

                // Check cell_styles for data:x
                let cell_key = format!("data:{}", x);
                let mut col_style = col.style.clone();
                let mut col_fill = col.background.clone();
                let mut col_align = col.align.clone();

                if let Some(s) = style {
                    if let Some(cs_map) = &s.cell_styles {
                        if let Some(cs) = cs_map.get(&cell_key) {
                            let mut merged = col_style.unwrap_or(TextStyle {
                                font_size: None, font_family: None, font_weight: None, color: None,
                                italic: None, underline: None, line_height: None, letter_spacing: None,
                                justify: None, text_transform: None, align: None,
                            });
                            if let Some(sz) = cs.size { merged.font_size = Some(sz); }
                            if let Some(wt) = &cs.weight { merged.font_weight = Some(wt.clone()); }
                            if let Some(cl) = &cs.color { merged.color = Some(cl.clone()); }
                            col_style = Some(merged);
                            if cs.fill.is_some() { col_fill = cs.fill.clone(); }
                            if cs.align.is_some() { col_align = cs.align.clone(); }
                        }
                    }
                }

                let final_align = col_align.as_deref().unwrap_or_else(|| col.align.as_deref().unwrap_or("left"));
                
                let mut args = Vec::new();
                args.push(format!("align: {}", final_align));
                if let Some(f) = col_fill { args.push(format!("fill: {}", format_color(&f))); }
                if cs > 1 { args.push(format!("colspan: {}", cs)); }
                if rs > 1 { args.push(format!("rowspan: {}", rs)); }
                
                let inner = render_cell_text_with_style(
                    &inner_content, 
                    col_style.as_ref(), 
                    body_font_size, 
                    body_color, 
                    "400"
                );

                t_out.push_str(&format!("  table.cell({})[{}],\n", args.join(", "), inner));

                for i in 1..(cs as usize) { covered.insert(x + i); }
            }
        }
    };

    if is_static {
        render_item(local, &mut t, 0);
    } else {
        let path = c.data_source.replace("{{", "").replace("}}", "").trim().to_string();
        let arr_opt = resolve_path(&path, local)
            .or_else(|| resolve_path(&path, global));
        if let Some(Value::Array(arr)) = arr_opt {
            let arr = arr.clone();
            if let Some(group_field) = &c.group_by {
                let mut group_map: Vec<(String, Vec<Value>)> = Vec::new();
                for item in &arr {
                    let key = resolve_path(group_field, item)
                        .map(|v| match v {
                            Value::String(s) => s.clone(),
                            _ => v.to_string(),
                        })
                        .unwrap_or_default();
                    
                    if let Some(entry) = group_map.iter_mut().find(|(k, _)| k == &key) {
                        entry.1.push((*item).clone());
                    } else {
                        group_map.push((key, vec![(*item).clone()]));
                    }
                }
                
                let total_cols = if let Some(dr) = &c.detail_rows {
                    dr.first().map(|r| r.cells.len()).unwrap_or(cols.len())
                } else {
                    cols.len()
                };
                
                for (_, group_items) in &group_map {
                    if group_items.is_empty() { continue; }
                    let first_item = &group_items[0];
                    let default_format = format!("{{{{{}}}}}", group_field);
                    let format_str = c.group_header_format.as_deref().unwrap_or(&default_format);
                    let header_text = resolve_binding_scoped(format_str, first_item, global);
                    
                    let mut cell_args = format!("colspan: {}", total_cols);
                    let mut inner_content = escape_typst(&header_text);
                    
                    if let Some(Value::Object(s)) = &c.group_header_style {
                        let mut text_args = Vec::new();
                        let fs = s.get("fontSize").and_then(|v| v.as_f64()).unwrap_or(9.0);
                        let fw = s.get("fontWeight").and_then(|v| v.as_str()).unwrap_or("bold");
                        let color = s.get("color").and_then(|v| v.as_str()).unwrap_or("#000000");
                        
                        text_args.push(format!("size: {}pt", fs));
                        text_args.push(format!("weight: {}", format_weight(fw)));
                        text_args.push(format!("fill: {}", format_color(color)));
                        
                        if s.get("italic").and_then(|v| v.as_bool()).unwrap_or(false) {
                            text_args.push("style: \"italic\"".to_string());
                        }

                        inner_content = format!("#set text({}); {}", text_args.join(", "), inner_content);
                        
                        if s.get("underline").and_then(|v| v.as_bool()).unwrap_or(false) {
                            inner_content = format!("#underline[{}]", inner_content);
                        }
                        
                        if let Some(Value::String(bg)) = s.get("background") {
                            cell_args.push_str(&format!(", fill: {}", format_color(bg)));
                        }
                        if let Some(Value::String(align)) = s.get("align") {
                            cell_args.push_str(&format!(", align: {}", align));
                        }
                    } else {
                        cell_args.push_str(&format!(", fill: {}, align: left", format_color("#f1f5f9")));
                        inner_content = format!("#set text(weight: 700); {}", inner_content);
                    }
                    
                    t.push_str(&format!("  table.cell({})[{}],\n", cell_args, inner_content));
                    
                    for (item_idx, item) in group_items.iter().enumerate() {
                        render_item(item, &mut t, item_idx);
                    }

                    // --- Auto Group Footer (Rust Implementation) ---
                    if c.auto_group_footer.unwrap_or(false) {
                        for (x, col) in cols.iter().enumerate() {
                            let mut cell_content = String::new();
                            
                            if let Some(expr) = &col.footer_expr {
                                cell_content = expr.clone();
                            } else if x == 0 {
                                cell_content = c.auto_group_footer_label.clone().unwrap_or_else(|| "Subtotal".to_string());
                            } else if !col.field.is_empty() {
                                cell_content = format!("{{{{SUM({})}}}}", col.field);
                            }

                            if cell_content.is_empty() {
                                let mut cell_fill = "white.darken(3%)".to_string();
                                if let Some(Value::Object(s)) = &c.group_footer_style {
                                    if let Some(bg) = s.get("background").and_then(|v| v.as_str()) {
                                        cell_fill = format_color(bg);
                                    }
                                }
                                t.push_str(&format!("  table.cell(fill: {})[],\n", cell_fill));
                                continue;
                            }

                            let val = resolve_binding_with_aggregates(&cell_content, first_item, global, group_items);
                            let align = col.align.as_deref().unwrap_or("left");
                            let fmt = col.format.as_deref().unwrap_or("text").to_lowercase();
                            let is_sum = cell_content.contains("SUM");
                            
                            let display_val = if fmt != "text" && is_sum {
                                format!("#fmt_{}(\"{}\")", fmt.replace("-", "_"), escape_string_literal(&val))
                            } else {
                                escape_typst(&val)
                            };

                            let mut cell_fill = "white.darken(3%)".to_string();
                            let mut text_size = body_font_size;
                            let mut text_weight = "bold";
                            let mut text_color = "#000000".to_string();

                            if let Some(Value::Object(s)) = &c.group_footer_style {
                                if let Some(bg) = s.get("background").and_then(|v| v.as_str()) {
                                    cell_fill = format_color(bg);
                                }
                                text_size = s.get("fontSize").and_then(|v| v.as_f64()).unwrap_or(body_font_size);
                                text_weight = s.get("fontWeight").and_then(|v| v.as_str()).unwrap_or("bold");
                                if let Some(c) = s.get("color").and_then(|v| v.as_str()) {
                                    text_color = c.to_string();
                                }
                            }

                            t.push_str(&format!(
                                "  table.cell(fill: {}, align: {})[#text(size: {}pt, weight: {}, fill: {})[{}]],\n",
                                cell_fill, align, text_size, format_weight(text_weight), format_color(&text_color), display_val
                            ));
                        }
                    }

                    // Render group summary rows (if any and repeat is on)
                    if c.repeat_summary_on_group.unwrap_or(false) {
                        if let Some(summary_rows) = &c.summary_rows {
                            for row in summary_rows {
                                if row.separator.unwrap_or(false) {
                                    t.push_str("  table.hline(stroke: 1pt + black),\n");
                                }
                                let val = resolve_binding_with_aggregates(&row.value, first_item, global, group_items);
                                let escaped_label = escape_typst(&row.label);
                                let escaped_val = escape_typst(&val);
                                let weight = if row.style.as_deref() == Some("total") { "700" } else { "400" };
                                let span = if cols.len() > 1 { cols.len() - 1 } else { 1 };
                                t.push_str(&format!(
                                    "  table.cell(colspan: {}, align: right)[*{}*],\n  [#text(weight: {})[{}]],\n",
                                    span, escaped_label, weight, escaped_val
                                ));
                            }
                        }
                    }
                }
            } else {
                for (item_idx, item) in arr.iter().enumerate() {
                    render_item(item, &mut t, item_idx);
                }
                
                // Render table summary rows (if not grouped)
                if let Some(summary_rows) = &c.summary_rows {
                    for row in summary_rows {
                        if row.separator.unwrap_or(false) {
                            t.push_str("  table.hline(stroke: 1pt + black),\n");
                        }
                        // Use full array for aggregates if not grouped
                        let val = resolve_binding_with_aggregates(&row.value, local, global, &arr);
                        let escaped_label = escape_typst(&row.label);
                        let escaped_val = escape_typst(&val);
                        let weight = if row.style.as_deref() == Some("total") { "700" } else { "400" };
                        let span = if cols.len() > 1 { cols.len() - 1 } else { 1 };
                        t.push_str(&format!(
                            "  table.cell(colspan: {}, align: right)[*{}*],\n  [#text(weight: {})[{}]],\n",
                            span, escaped_label, weight, escaped_val
                        ));
                    }
                }
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

    // ── 7. LEGACY SUMMARY ROWS (Removed because they are now handled inside group/data loops) ──

    // ── 8. FOOTER ROWS ───────────────────────────────────────────────────────
    if let Some(footer_rows) = &c.footer_rows {
        let repeat = footer_rows.first().and_then(|r| r.repeat).unwrap_or(true);
        t.push_str(&format!("  table.footer(repeat: {},\n", repeat));
        for row in footer_rows {
            for (x, cell) in row.cells.iter().enumerate() {
                // Resolve bindings in footer with full array context
                let arr_val = if let Some(Value::Array(a)) = resolve_path(&c.data_source.replace("{{", "").replace("}}", ""), local).or_else(|| resolve_path(&c.data_source.replace("{{", "").replace("}}", ""), global)) {
                    a.clone()
                } else {
                    Vec::new()
                };
                let val = resolve_binding_with_aggregates(&cell.content, local, global, &arr_val);
                
                // --- Formatting ---
                let format_func = cell.format.as_deref().unwrap_or("text").to_lowercase();
                let inner_content = if format_func != "text" {
                    format!("#fmt_{}(\"{}\")", format_func.replace("-", "_"), escape_string_literal(&val))
                } else {
                    escape_typst(&val)
                };

                // --- Styling ---
                let mut cell_style = cell.style.clone();
                let mut cell_fill = cell.fill.clone();
                let mut cell_align = cell.align.clone();

                // Check global cell_styles override
                if let Some(s) = style {
                    if let Some(cs_map) = &s.cell_styles {
                        let cell_key = format!("footer:{}", x);
                        if let Some(cs) = cs_map.get(&cell_key) {
                            let mut merged = cell_style.unwrap_or(TextStyle {
                                font_size: None, font_family: None, font_weight: None, color: None,
                                italic: None, underline: None, line_height: None, letter_spacing: None,
                                justify: None, text_transform: None, align: None,
                            });
                            if let Some(sz) = cs.size { merged.font_size = Some(sz); }
                            if let Some(wt) = &cs.weight { merged.font_weight = Some(wt.clone()); }
                            if let Some(cl) = &cs.color { merged.color = Some(cl.clone()); }
                            cell_style = Some(merged);
                            if cs.fill.is_some() { cell_fill = cs.fill.clone(); }
                            if cs.align.is_some() { cell_align = cs.align.clone(); }
                        }
                    }
                }
                
                let inner = render_cell_text_with_style(
                    &inner_content,
                    cell_style.as_ref(),
                    body_font_size,
                    body_color,
                    "700" // default for footer
                );

                t.push_str(&format!("    {},\n", render_cell_container_v2(cell, &inner, cell_fill, cell_align)));
            }
        }
        t.push_str("  ),\n");
    }

    // ── Outermost Bottom/Right Borders ────────────────────────────────────────
    if s_bottom {
        // Need to calculate total rows for hline
        let mut total_rows = header_rows_count + c.footer_rows.as_ref().map(|f| f.len() as u32).unwrap_or(0);
        let path = c.data_source.replace("{{", "").replace("}}", "").trim().to_string();
        if let Some(Value::Array(arr)) = resolve_path(&path, local).or_else(|| resolve_path(&path, global)) {
            if let Some(group_field) = &c.group_by {
                let mut groups = HashSet::new();
                for item in arr {
                    let key = resolve_path(group_field, item).map(|v| v.to_string()).unwrap_or_default();
                    groups.insert(key);
                }
                total_rows += (arr.len() as u32) + (groups.len() as u32);
                if c.auto_group_footer.unwrap_or(false) {
                    total_rows += groups.len() as u32;
                }
            } else {
                total_rows += arr.len() as u32;
            }
        } else if is_static {
            let static_data_rows = c.detail_rows.as_ref().map(|dr| dr.len() as u32).unwrap_or(1);
            total_rows += static_data_rows;
        }
        t.push_str(&format!("  table.hline(y: {}, stroke: {} + {}),\n", total_rows, border_width, format_color(border_color)));
    }
    if s_right {
        t.push_str(&format!("  table.vline(x: {}, stroke: {} + {}),\n", cols.len(), border_width, format_color(border_color)));
    }

    t.push_str(")\n");
    wrap_flow(&c.base, &t, offset_x, offset_y, prefix)
}


fn render_cell_text_with_style(content: &str, style: Option<&TextStyle>, default_size: f64, default_color: &str, default_weight: &str) -> String {
    let size = style.and_then(|s| s.font_size).unwrap_or(default_size);
    let color = style.and_then(|s| s.color.as_deref()).unwrap_or(default_color);
    let weight = style.and_then(|s| s.font_weight.as_deref()).unwrap_or(default_weight);
    let leading = style.and_then(|s| s.line_height).map(|v| v - 1.0).unwrap_or(0.2);
    
    format!(
        "#set par(leading: {}em)\n#set text(size: {}pt, fill: {}, weight: {})\n{}", 
        leading, size, format_color(color), format_weight(weight), content
    )
}

fn format_weight(w: &str) -> String {
    // CSS "normal" is not a valid Typst weight — map to "regular"
    let w = if w == "normal" { "regular" } else { w };
    if w.chars().all(char::is_numeric) {
        w.to_string()
    } else {
        format!("\"{}\"", w)
    }
}

fn render_cell_container_v2(cell: &TableCell, inner: &str, fill_override: Option<String>, align_override: Option<String>) -> String {
    let mut args = Vec::new();
    if let Some(cs) = cell.colspan { if cs > 1 { args.push(format!("colspan: {}", cs)); } }
    if let Some(rs) = cell.rowspan { if rs > 1 { args.push(format!("rowspan: {}", rs)); } }
    
    let fill = fill_override.or_else(|| cell.fill.clone());
    if let Some(f) = fill { args.push(format!("fill: {}", format_color(&f))); }
    
    // Handle alignment: combine horizontal + vertical
    let h_align = align_override.or_else(|| cell.align.clone());
    let v_align = cell.vertical_align.as_deref().unwrap_or("horizon");
    let v_align_typst = match v_align {
        "top" => "top",
        "bottom" => "bottom",
        _ => "horizon",
    };
    if let Some(a) = h_align {
        args.push(format!("align: {} + {}", a, v_align_typst));
    } else if v_align_typst != "horizon" {
        args.push(format!("align: {}", v_align_typst));
    }
    
    if let Some(i) = &cell.inset { args.push(format!("inset: {}", i)); }
    
    // Handle vertical text direction
    let is_vertical = cell.text_direction.as_deref() == Some("vertical");
    let content = if is_vertical {
        format!("#rotate(-90deg, reflow: true)[{}]", inner)
    } else {
        inner.to_string()
    };
    
    if args.is_empty() {
        format!("[{}]", content)
    } else {
        format!("table.cell({})[{}]", args.join(", "), content)
    }
}

fn render_hline(hl: &HLineConfig) -> String {
    let mut args = vec![format!("y: {}", hl.y)];
    if let Some(start) = hl.start { if start > 0 { args.push(format!("start: {}", start)); } }
    if let Some(end) = hl.end { args.push(format!("end: {}", end)); }
    
    let stroke = if let Some(dash) = &hl.dash {
        if dash != "solid" {
            format!("(paint: {}, thickness: 0.5pt, dash: \"{}\")", hl.stroke.as_ref().map(|s| format_color(s)).unwrap_or_else(|| "#000000".to_string()), dash)
        } else {
            hl.stroke.as_ref().map(|s| format_color(s)).unwrap_or_else(|| "0.5pt + black".to_string())
        }
    } else {
        hl.stroke.as_ref().map(|s| format_color(s)).unwrap_or_else(|| "0.5pt + black".to_string())
    };
    args.push(format!("stroke: {}", stroke));

    if let Some(pos) = &hl.position { args.push(format!("position: {}", pos)); }
    format!("  table.hline({}),\n", args.join(", "))
}

fn render_vline(vl: &VLineConfig) -> String {
    let mut args = vec![format!("x: {}", vl.x)];
    if let Some(start) = vl.start { if start > 0 { args.push(format!("start: {}", start)); } }
    if let Some(end) = vl.end { args.push(format!("end: {}", end)); }
    
    let stroke = if let Some(dash) = &vl.dash {
        if dash != "solid" {
            format!("(paint: {}, thickness: 0.5pt, dash: \"{}\")", vl.stroke.as_ref().map(|s| format_color(s)).unwrap_or_else(|| "#000000".to_string()), dash)
        } else {
            vl.stroke.as_ref().map(|s| format_color(s)).unwrap_or_else(|| "0.5pt + black".to_string())
        }
    } else {
        vl.stroke.as_ref().map(|s| format_color(s)).unwrap_or_else(|| "0.5pt + black".to_string())
    };
    args.push(format!("stroke: {}", stroke));

    if let Some(pos) = &vl.position { args.push(format!("position: {}", pos)); }
    format!("  table.vline({}),\n", args.join(", "))
}
