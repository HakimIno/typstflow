use crate::schema::*;
use serde_json::Value;

use super::bindings::{
    is_visible, resolve_binding_scoped, resolve_binding_with_aggregates, resolve_path,
};
use super::elements::{
    render_barcode, render_checklist, render_columns, render_image, render_line,
    render_page_break_indicator, render_page_number, render_qr, render_repeater, render_spacer,
    render_summary_box, render_text,
};
use super::paper::parse_mm_value;
use super::table::render_table;

pub fn render_document(
    schema: &LayoutSchema,
    local_data: &Value,
    global_data: &Value,
    offset_x: &str,
    body_offset_y: &str,
    header_offset_y: &str,
    footer_offset_y: &str,
) -> String {
    let mut t = String::new();
    let total_pages = schema.pages.len();

    for (i, page_def) in schema.pages.iter().enumerate() {
        if i > 0 {
            t.push_str("\n#pagebreak(weak: true)\n#box()\n");
        }

        let is_global_h = schema.zones.header.repeat_on_every_page.unwrap_or(false);
        let first_only_h = schema.zones.header.show_on_first_page_only.unwrap_or(false);
        let render_header = !is_global_h && (if first_only_h { i == 0 } else { i == 0 });

        if render_header {
            t.push_str(&format!("// --- PAGE {} HEADER ---\n", i + 1));
            t.push_str("#place(dx: 0mm, dy: 0mm)[\n");
            for comp in &schema.zones.header.components {
                t.push_str(&render_component(
                    comp, local_data, global_data, offset_x, header_offset_y, "  #", false, false,
                ));
            }
            t.push_str("]\n");
        }

        let is_global_f = schema.zones.footer.repeat_on_every_page.unwrap_or(false);
        let last_only_f = schema.zones.footer.show_on_last_page_only.unwrap_or(false);
        let render_footer =
            !is_global_f && (if last_only_f { i == total_pages - 1 } else { i == 0 });

        if render_footer {
            t.push_str(&format!("// --- PAGE {} FOOTER ---\n", i + 1));
            t.push_str("#place(dx: 0mm, dy: 0mm)[\n");
            for comp in &schema.zones.footer.components {
                t.push_str(&render_component(
                    comp, local_data, global_data, offset_x, footer_offset_y, "  #", false, false,
                ));
            }
            t.push_str("]\n");
        }

        t.push_str(&format!("// --- PAGE {} BODY ---\n", i + 1));
        let is_flow_body = page_def.body.layout_mode.as_deref() == Some("flow");

        if is_flow_body {
            // Default 0mm matches the designer's flex-col layout (no physical gap between rows).
            let flow_gap = page_def.body.flow_gap.as_deref().unwrap_or("0mm");
            let parts: Vec<String> = page_def
                .body
                .components
                .iter()
                .map(|comp| {
                    render_component(comp, local_data, global_data, offset_x, body_offset_y, "#", true, false)
                })
                .filter(|s| !s.is_empty())
                .collect();
            // Skip #v(0mm) — it's a no-op and adds noise to the Typst source.
            let separator = if flow_gap == "0mm" { String::new() } else { format!("#v({})\n", flow_gap) };
            t.push_str(&parts.join(&separator));
            if !parts.is_empty() {
                t.push('\n');
            }
        } else {
            for comp in &page_def.body.components {
                t.push_str(&render_component(
                    comp, local_data, global_data, offset_x, body_offset_y, "#", false, false,
                ));
            }
        }
    }
    t
}

pub fn render_groups(
    groups: &[GroupDefinition],
    group_index: usize,
    items: &[Value],
    schema: &LayoutSchema,
    global_data: &Value,
    offset_x: &str,
    body_offset_y: &str,
    header_offset_y: &str,
    footer_offset_y: &str,
) -> String {
    let group = match groups.get(group_index) {
        Some(g) => g,
        None => {
            let mut out = String::new();
            for item in items {
                for comp in &schema.pages[0].body.components {
                    out.push_str(&render_component(
                        comp, item, global_data, offset_x, body_offset_y, "#", false, false,
                    ));
                }
            }
            return out;
        }
    };

    let filtered: Vec<&Value> = if let Some(filter_expr) = &group.filter_by {
        items
            .iter()
            .filter(|item| {
                let r = resolve_binding_scoped(filter_expr, item, global_data);
                r != "false" && r != "0" && !r.is_empty()
            })
            .collect()
    } else {
        items.iter().collect()
    };

    let mut group_map: Vec<(String, Vec<Value>)> = Vec::new();
    for item in &filtered {
        let key = resolve_path(&group.field, item)
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

    if let Some(sort_dir) = &group.sort_by {
        group_map.sort_by(|(a, _), (b, _)| {
            let ord = a.cmp(b);
            if sort_dir == "desc" { ord.reverse() } else { ord }
        });
    }

    let mut out = String::new();
    for (_, group_items) in &group_map {
        let first_item = group_items.first().unwrap_or(global_data);
        let mut current_y_mm = parse_mm_value(body_offset_y);

        if let Some(header) = &group.header {
            out.push_str(&format!("// GROUP [{}] HEADER\n", group.id));
            let header_offset = format!("{}mm", current_y_mm);
            for comp in &header.components {
                out.push_str(&render_component_with_items(
                    comp,
                    first_item,
                    global_data,
                    group_items,
                    offset_x,
                    &header_offset,
                    "#",
                ));
            }
            current_y_mm +=
                parse_mm_value(header.min_height.as_deref().unwrap_or("0mm"));
        }

        let nested_offset = format!("{}mm", current_y_mm);
        out.push_str(&render_groups(
            groups,
            group_index + 1,
            group_items,
            schema,
            global_data,
            offset_x,
            &nested_offset,
            header_offset_y,
            footer_offset_y,
        ));

        current_y_mm +=
            parse_mm_value(schema.pages[0].body.min_height.as_deref().unwrap_or("0mm"));

        if let Some(footer) = &group.footer {
            out.push_str(&format!("// GROUP [{}] FOOTER\n", group.id));
            let footer_offset = format!("{}mm", current_y_mm);
            for comp in &footer.components {
                out.push_str(&render_component_with_items(
                    comp,
                    first_item,
                    global_data,
                    group_items,
                    offset_x,
                    &footer_offset,
                    "#",
                ));
            }
        }
    }
    out
}

fn render_component_with_items(
    node: &ComponentNode,
    local: &Value,
    global: &Value,
    items: &[Value],
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
) -> String {
    match node {
        ComponentNode::Text(c) => {
            if !is_visible(&c.base, local, global) {
                return String::new();
            }
            let raw = resolve_binding_with_aggregates(&c.content, local, global, items);
            let c2 = TextComponent { base: c.base.clone(), content: raw, style: c.style.clone() };
            render_text(&c2, local, global, offset_x, offset_y, prefix, false, false)
        }
        ComponentNode::SummaryBox(c) => {
            render_summary_box(c, local, global, items, offset_x, offset_y, prefix, false, false)
        }
        _ => render_component(node, local, global, offset_x, offset_y, prefix, false, false),
    }
}

pub fn render_component(
    node: &ComponentNode,
    local: &Value,
    global: &Value,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
    flow_mode: bool,
    fill_width: bool,
) -> String {
    match node {
        ComponentNode::Text(c) => {
            render_text(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::Line(c) => {
            render_line(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::Image(c) => {
            render_image(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::Table(c) => {
            render_table(c, local, global, offset_x, offset_y, prefix, flow_mode)
        }
        ComponentNode::Spacer(c) => {
            render_spacer(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::Barcode(c) => {
            render_barcode(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::Qr(c) => {
            render_qr(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::PageNumber(c) => {
            render_page_number(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::PageBreakIndicator(c) => {
            render_page_break_indicator(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::SummaryBox(c) => {
            render_summary_box(c, local, global, &[], offset_x, offset_y, prefix, flow_mode, fill_width)
        }
        ComponentNode::Repeater(c) => render_repeater(
            c,
            local,
            global,
            offset_x,
            offset_y,
            prefix,
            flow_mode,
            fill_width,
            &|child, l, g, ox, oy, px, fm, fw| render_component(child, l, g, ox, oy, px, fm, fw),
        ),
        ComponentNode::Columns(c) => render_columns(
            c,
            local,
            global,
            offset_x,
            offset_y,
            prefix,
            flow_mode,
            fill_width,
            &|child, l, g, ox, oy, px, fm, fw| render_component(child, l, g, ox, oy, px, fm, fw),
        ),
        ComponentNode::Checklist(c) => {
            render_checklist(c, local, global, offset_x, offset_y, prefix, flow_mode, fill_width)
        }
    }
}
