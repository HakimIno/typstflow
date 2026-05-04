pub mod utils;
pub mod preamble;
pub mod elements;
pub mod table;

use crate::schema::*;
use serde_json::Value;

use preamble::get_preamble;
use elements::*;
use table::render_table;
use utils::*;

pub fn generate_typst(schema: &LayoutSchema, data: &Value) -> String {
    let mut t = String::new();

    // ── 1. Preamble & helpers ───────────────────────────────────────────────
    t.push_str(&get_preamble());

    // ── 2. Page setup ───────────────────────────────────────────────────────
    let is_landscape = schema.page.orientation == "landscape";
    let (_page_width_mm, page_height_mm) = paper_dimensions(&schema.page.size, is_landscape);

    // margin: 0mm so #place() coordinates are from the physical page corner,
    // matching the designer canvas where zones are inset-0 (no margin offset).
    // The schema margin is a visual-only guide in the designer.
    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: 0mm,\n)\n\n",
        get_typst_paper_name(&schema.page.size),
        is_landscape,
    ));

    // ── 3. Global text style ────────────────────────────────────────────────
    if let Some(font) = schema.fonts.first() {
        t.push_str(&format!(
            "#set text(font: (\"{}\", \"Sarabun\", \"sans-serif\"), size: {}pt, lang: \"th\")\n",
            font.family, font.size
        ));
    }
    t.push_str("#set par(leading: 0.2em, justify: false)\n\n");

    // ── 4. Zone coordinate origins — from page corner, matching designer ────
    // Zones are stacked flex-col from page corner (0,0). margin is visual only.
    let h_height = parse_mm_value(
        schema.zones.header.min_height.as_deref().unwrap_or("0mm")
    );
    let f_height = parse_mm_value(
        schema.zones.footer.min_height.as_deref().unwrap_or("0mm")
    );

    let offset_x = "0mm".to_string();
    let header_offset_y = "0mm".to_string();
    let body_offset_y = format!("{}mm", h_height);
    let footer_offset_y = format!("{}mm", page_height_mm - f_height);

    // ── 5. Render pages ─────────────────────────────────────────────────────
    if !schema.groups.is_empty() {
        // Grouped rendering: iterates over data.items grouped by schema.groups
        let root_items = match data.get("items") {
            Some(Value::Array(arr)) => arr.clone(),
            _ => match data {
                Value::Array(arr) => arr.clone(),
                _ => vec![],
            },
        };
        t.push_str(&render_groups(
            &schema.groups, 0, &root_items, schema, data,
            &offset_x, &body_offset_y, &header_offset_y, &footer_offset_y,
        ));
    } else {
        // Standard page-by-page rendering
        let total_pages = schema.pages.len();
        for (i, page_def) in schema.pages.iter().enumerate() {
            if i > 0 {
                t.push_str("\n#pagebreak(weak: true)\n");
            }

            // Header
            let show_header = schema.zones.header.repeat_on_every_page.unwrap_or(false)
                || i == 0
                || !schema.zones.header.show_on_first_page_only.unwrap_or(false);
            let first_only = schema.zones.header.show_on_first_page_only.unwrap_or(false);
            let last_only = schema.zones.header.show_on_last_page_only.unwrap_or(false);
            let render_header = if first_only { i == 0 }
                else if last_only { i == total_pages - 1 }
                else { show_header };

            if render_header {
                t.push_str(&format!("// --- PAGE {} HEADER ---\n", i + 1));
                for comp in &schema.zones.header.components {
                    t.push_str(&render_component(comp, data, data, &offset_x, &header_offset_y, "#"));
                }
            }

            // Body
            t.push_str(&format!("// --- PAGE {} BODY ---\n", i + 1));
            for comp in &page_def.body.components {
                t.push_str(&render_component(comp, data, data, &offset_x, &body_offset_y, "#"));
            }

            // Footer
            let show_footer = schema.zones.footer.repeat_on_every_page.unwrap_or(false)
                || i == total_pages - 1;
            let f_first_only = schema.zones.footer.show_on_first_page_only.unwrap_or(false);
            let f_last_only = schema.zones.footer.show_on_last_page_only.unwrap_or(false);
            let render_footer = if f_first_only { i == 0 }
                else if f_last_only { i == total_pages - 1 }
                else { show_footer };

            if render_footer {
                t.push_str(&format!("// --- PAGE {} FOOTER ---\n", i + 1));
                for comp in &schema.zones.footer.components {
                    t.push_str(&render_component(comp, data, data, &offset_x, &footer_offset_y, "#"));
                }
            }
        }
    }

    t
}

/// Recursive group renderer.
/// `group_index` points to the current group in schema.groups.
/// `items` is the slice of data items at this nesting level.
fn render_groups(
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
            // Innermost level: render the detail band (page 0 body) for each item
            let mut out = String::new();
            for item in items {
                for comp in &schema.pages[0].body.components {
                    out.push_str(&render_component(comp, item, global_data, offset_x, body_offset_y, "#"));
                }
            }
            return out;
        }
    };

    // Filter items if a filterBy expression is set
    let filtered: Vec<&Value> = if let Some(filter_expr) = &group.filter_by {
        items.iter().filter(|item| {
            let resolved = resolve_binding_scoped(filter_expr, item, global_data);
            resolved != "false" && resolved != "0" && !resolved.is_empty()
        }).collect()
    } else {
        items.iter().collect()
    };

    // Group items by group.field
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

    // Sort groups
    if let Some(sort_dir) = &group.sort_by {
        group_map.sort_by(|(a, _), (b, _)| {
            let ord = a.cmp(b);
            if sort_dir == "desc" { ord.reverse() } else { ord }
        });
    }

    let mut out = String::new();
    for (_, group_items) in &group_map {
        let first_item = group_items.first().map(|v| v).unwrap_or(global_data);

        // Group header
        out.push_str(&format!("// GROUP [{}] HEADER\n", group.id));
        for comp in &group.header.components {
            out.push_str(&render_component_with_items(
                comp, first_item, global_data, group_items,
                offset_x, body_offset_y, "#"
            ));
        }

        // Nested groups or detail band
        out.push_str(&render_groups(
            groups, group_index + 1, group_items,
            schema, global_data,
            offset_x, body_offset_y, header_offset_y, footer_offset_y,
        ));

        // Group footer
        out.push_str(&format!("// GROUP [{}] FOOTER\n", group.id));
        for comp in &group.footer.components {
            out.push_str(&render_component_with_items(
                comp, first_item, global_data, group_items,
                offset_x, body_offset_y, "#"
            ));
        }
    }
    out
}

/// Render a component with a group item list available for aggregate functions.
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
            if !is_visible(&c.base, local, global) { return String::new(); }
            // Resolve binding with aggregate support
            let raw = resolve_binding_with_aggregates(&c.content, local, global, items);
            // Re-use render_text but with already-resolved content
            let mut c2 = TextComponent {
                base: BaseComponent { ..c.base.clone() },
                content: raw,
                style: c.style.clone(),
            };
            // Disable further binding resolution in render_text by clearing binding markers
            c2.content = c2.content.clone();
            render_text(&c2, local, global, offset_x, offset_y, prefix)
        }
        ComponentNode::SummaryBox(c) => {
            render_summary_box(c, local, global, items, offset_x, offset_y, prefix)
        }
        _ => render_component(node, local, global, offset_x, offset_y, prefix),
    }
}

fn render_component(
    node: &ComponentNode,
    local: &Value,
    global: &Value,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
) -> String {
    match node {
        ComponentNode::Text(c) => render_text(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::Line(c) => render_line(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::Image(c) => render_image(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::Table(c) => render_table(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::Spacer(c) => render_spacer(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::Barcode(c) => render_barcode(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::Qr(c) => render_qr(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::PageNumber(c) => render_page_number(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::PageBreakIndicator(c) => render_page_break_indicator(c, local, global, offset_x, offset_y, prefix),
        ComponentNode::SummaryBox(c) => render_summary_box(c, local, global, &[], offset_x, offset_y, prefix),
        ComponentNode::Repeater(c) => render_repeater(c, local, global, offset_x, offset_y, prefix,
            &|child, l, g, ox, oy, px| render_component(child, l, g, ox, oy, px)
        ),
        ComponentNode::Columns(c) => render_columns(c, local, global, offset_x, offset_y, prefix,
            &|child, l, g, ox, oy, px| render_component(child, l, g, ox, oy, px)
        ),
    }
}
