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

    // ── 4. Zone coordinate origins ────
    // Now that we use native page margins, the main flow container IS the Body zone.
    let h_height = parse_mm_value(
        schema.zones.header.min_height.as_deref().unwrap_or("0mm")
    );
    let f_height = parse_mm_value(
        schema.zones.footer.min_height.as_deref().unwrap_or("0mm")
    );

    let offset_x = "0mm".to_string();
    let header_offset_y = format!("-{}mm", h_height); // Manual header pushes UP into the top margin
    let body_offset_y = "0mm".to_string();            // Body is natively at the top of the flow container
    let body_height = page_height_mm - h_height - f_height;
    let footer_offset_y = format!("{}mm", body_height); // Manual footer pushes DOWN into the bottom margin

    // Set page margins so the main flow area is exactly the Body zone.
    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: (top: {}mm, bottom: {}mm, left: 0mm, right: 0mm),\n",
        get_typst_paper_name(&schema.page.size),
        is_landscape,
        h_height,
        f_height
    ));

    let is_global_h = schema.zones.header.repeat_on_every_page.unwrap_or(false);
    if is_global_h {
        let mut header_content = String::new();
        for comp in &schema.zones.header.components {
            header_content.push_str(&render_component(comp, data, data, "0mm", "0mm", "#", false));
        }
        t.push_str(&format!("  header: [{}],\n", header_content));
    }

    let is_global_f = schema.zones.footer.repeat_on_every_page.unwrap_or(false);
    if is_global_f {
        let mut footer_content = String::new();
        for comp in &schema.zones.footer.components {
            footer_content.push_str(&render_component(comp, data, data, "0mm", "0mm", "#", false));
        }
        t.push_str(&format!("  footer: [{}],\n", footer_content));
    }
    
    t.push_str(")\n\n");

    // ── 5. Render pages ─────────────────────────────────────────────────────
    if let Some(batch_path) = &schema.batch_data_source {
        let batch_items = resolve_path(batch_path, data)
            .and_then(|v| match v {
                Value::Array(arr) => Some(arr.clone()),
                _ => None,
            })
            .unwrap_or_else(|| vec![data.clone()]);
            
        for (idx, item) in batch_items.iter().enumerate() {
            if idx > 0 {
                t.push_str("\n#pagebreak(weak: true)\n#box()\n");
            }
            t.push_str(&render_document(schema, item, data, &offset_x, &body_offset_y, &header_offset_y, &footer_offset_y));
        }
    } else if !schema.groups.is_empty() {
        // Grouped rendering (Legacy)
        let root_items = match data.get(schema.group_data_source.as_deref().unwrap_or("items")) {
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
        // Standard single document
        t.push_str(&render_document(schema, data, data, &offset_x, &body_offset_y, &header_offset_y, &footer_offset_y));
    }

    t
}

fn render_document(
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

        // Header
        let is_global_h = schema.zones.header.repeat_on_every_page.unwrap_or(false);
        let first_only_h = schema.zones.header.show_on_first_page_only.unwrap_or(false);
        let render_header = if is_global_h { false } // Handled natively by #set page(header: ...)
            else if first_only_h { i == 0 }
            else { i == 0 }; // Default: show on first page

        if render_header {
            t.push_str(&format!("// --- PAGE {} HEADER ---\n", i + 1));
            // Ensure manual header is pulled out of flow so it doesn't push the body down
            t.push_str("#place(dx: 0mm, dy: 0mm)[\n");
            for comp in &schema.zones.header.components {
                t.push_str(&render_component(comp, local_data, global_data, offset_x, header_offset_y, "  #", false));
            }
            t.push_str("]\n");
        }

        // Footer
        let is_global_f = schema.zones.footer.repeat_on_every_page.unwrap_or(false);
        let last_only_f = schema.zones.footer.show_on_last_page_only.unwrap_or(false);
        let render_footer = if is_global_f { false } // Handled natively by #set page(footer: ...)
            else if last_only_f { i == total_pages - 1 }
            else { i == 0 }; // Default: show on first page (Report Footer)

        if render_footer {
            t.push_str(&format!("// --- PAGE {} FOOTER ---\n", i + 1));
            t.push_str("#place(dx: 0mm, dy: 0mm)[\n");
            for comp in &schema.zones.footer.components {
                t.push_str(&render_component(comp, local_data, global_data, offset_x, footer_offset_y, "  #", false));
            }
            t.push_str("]\n");
        }

        // Body
        t.push_str(&format!("// --- PAGE {} BODY ---\n", i + 1));
        let is_flow_body = page_def.body.layout_mode.as_deref() == Some("flow");
        if is_flow_body {
            let flow_gap = page_def.body.flow_gap.as_deref().unwrap_or("2mm");
            let parts: Vec<String> = page_def.body.components.iter()
                .map(|comp| render_component(comp, local_data, global_data, offset_x, body_offset_y, "#", true))
                .filter(|s| !s.is_empty())
                .collect();
            t.push_str(&parts.join(&format!("#v({})\n", flow_gap)));
            if !parts.is_empty() { t.push('\n'); }
        } else {
            for comp in &page_def.body.components {
                t.push_str(&render_component(comp, local_data, global_data, offset_x, body_offset_y, "#", false));
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
                    out.push_str(&render_component(comp, item, global_data, offset_x, body_offset_y, "#", false));
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

        let mut current_y_mm = parse_mm_value(body_offset_y);

        // Group header
        if let Some(header) = &group.header {
            out.push_str(&format!("// GROUP [{}] HEADER\n", group.id));
            let header_offset = format!("{}mm", current_y_mm);
            for comp in &header.components {
                out.push_str(&render_component_with_items(
                    comp, first_item, global_data, group_items,
                    offset_x, &header_offset, "#",
                ));
            }
            let h_height = parse_mm_value(header.min_height.as_deref().unwrap_or("0mm"));
            current_y_mm += h_height;
        }

        // Nested groups or detail band
        let nested_body_offset = format!("{}mm", current_y_mm);
        out.push_str(&render_groups(
            groups, group_index + 1, group_items,
            schema, global_data,
            offset_x, &nested_body_offset, header_offset_y, footer_offset_y,
        ));


        // Note: For simplicity in this engine, we add the innermost body's height 
        // to push the group footer down. We'll use the schema's body minHeight.
        let body_h = parse_mm_value(schema.pages[0].body.min_height.as_deref().unwrap_or("0mm"));
        current_y_mm += body_h;

        // Group footer
        if let Some(footer) = &group.footer {
            out.push_str(&format!("// GROUP [{}] FOOTER\n", group.id));
            let footer_offset = format!("{}mm", current_y_mm);
            for comp in &footer.components {
                out.push_str(&render_component_with_items(
                    comp, first_item, global_data, group_items,
                    offset_x, &footer_offset, "#",
                ));
            }
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
            let raw = resolve_binding_with_aggregates(&c.content, local, global, items);
            let mut c2 = TextComponent {
                base: BaseComponent { ..c.base.clone() },
                content: raw,
                style: c.style.clone(),
            };
            c2.content = c2.content.clone();
            render_text(&c2, local, global, offset_x, offset_y, prefix, false)
        }
        ComponentNode::SummaryBox(c) => {
            render_summary_box(c, local, global, items, offset_x, offset_y, prefix, false)
        }
        _ => render_component(node, local, global, offset_x, offset_y, prefix, false),
    }
}

fn render_component(
    node: &ComponentNode,
    local: &Value,
    global: &Value,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
    flow_mode: bool,
) -> String {
    match node {
        ComponentNode::Text(c) => render_text(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Line(c) => render_line(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Image(c) => render_image(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Table(c) => render_table(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Spacer(c) => render_spacer(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Barcode(c) => render_barcode(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Qr(c) => render_qr(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::PageNumber(c) => render_page_number(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::PageBreakIndicator(c) => render_page_break_indicator(c, local, global, offset_x, offset_y, prefix, flow_mode),
        ComponentNode::SummaryBox(c) => render_summary_box(c, local, global, &[], offset_x, offset_y, prefix, flow_mode),
        ComponentNode::Repeater(c) => render_repeater(c, local, global, offset_x, offset_y, prefix, flow_mode,
            &|child, l, g, ox, oy, px, fm| render_component(child, l, g, ox, oy, px, fm)
        ),
        ComponentNode::Columns(c) => render_columns(c, local, global, offset_x, offset_y, prefix, flow_mode,
            &|child, l, g, ox, oy, px, fm| render_component(child, l, g, ox, oy, px, fm)
        ),
    }
}
