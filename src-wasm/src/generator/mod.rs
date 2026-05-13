mod bindings;
mod document;
mod formatting;
mod paper;
mod placement;
pub mod elements;
pub mod preamble;
pub mod table;

use crate::schema::*;
use serde_json::Value;

use bindings::resolve_path;
use document::{render_component, render_document, render_groups};
use paper::{get_typst_paper_name, paper_dimensions, parse_mm_value};
use preamble::get_preamble;

pub fn generate_typst(schema: &LayoutSchema, data: &Value) -> String {
    let mut t = String::new();

    // ── 1. Preamble & helpers ────────────────────────────────────────────────
    t.push_str(&get_preamble());

    // ── 2. Initial page setup (margin: 0mm placeholder) ──────────────────────
    let is_landscape = schema.page.orientation == "landscape";
    let (_page_width_mm, page_height_mm) = paper_dimensions(&schema.page.size, is_landscape);

    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: 0mm,\n)\n\n",
        get_typst_paper_name(&schema.page.size),
        is_landscape,
    ));

    // ── 3. Global text style ─────────────────────────────────────────────────
    if let Some(font) = schema.fonts.first() {
        t.push_str(&format!(
            "#set text(font: (\"{}\", \"Sarabun\", \"sans-serif\"), size: {}pt, lang: \"th\")\n",
            font.family, font.size
        ));
    }
    t.push_str("#set par(leading: 0.2em, justify: false)\n\n");

    // ── 4. Zone geometry ─────────────────────────────────────────────────────
    // margin: 0mm so #place() coordinates are from the physical page corner.
    // The schema margin is a visual-only guide in the designer.
    let h_height = parse_mm_value(schema.zones.header.min_height.as_deref().unwrap_or("0mm"));
    let f_height = parse_mm_value(schema.zones.footer.min_height.as_deref().unwrap_or("0mm"));

    let offset_x = "0mm".to_string();
    let header_offset_y = format!("-{}mm", h_height);
    let body_offset_y = "0mm".to_string();
    let footer_offset_y = format!("{}mm", page_height_mm - h_height - f_height);

    // ── 5. Final page setup with real margins ────────────────────────────────
    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: (top: {}mm, bottom: {}mm, left: 0mm, right: 0mm),\n",
        get_typst_paper_name(&schema.page.size),
        is_landscape,
        h_height,
        f_height,
    ));

    let is_global_h = schema.zones.header.repeat_on_every_page.unwrap_or(false);
    if is_global_h {
        let header_content: String = schema
            .zones
            .header
            .components
            .iter()
            .map(|comp| render_component(comp, data, data, "0mm", "0mm", "#", false))
            .collect();
        t.push_str(&format!("  header: [{}],\n", header_content));
    }

    let is_global_f = schema.zones.footer.repeat_on_every_page.unwrap_or(false);
    if is_global_f {
        let footer_content: String = schema
            .zones
            .footer
            .components
            .iter()
            .map(|comp| render_component(comp, data, data, "0mm", "0mm", "#", false))
            .collect();
        t.push_str(&format!("  footer: [{}],\n", footer_content));
    }

    t.push_str(")\n\n");

    // ── 6. Render pages ──────────────────────────────────────────────────────
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
            t.push_str(&render_document(
                schema, item, data, &offset_x, &body_offset_y, &header_offset_y, &footer_offset_y,
            ));
        }
    } else if !schema.groups.is_empty() {
        let root_items = match data.get(schema.group_data_source.as_deref().unwrap_or("items")) {
            Some(Value::Array(arr)) => arr.clone(),
            _ => match data {
                Value::Array(arr) => arr.clone(),
                _ => vec![],
            },
        };
        t.push_str(&render_groups(
            &schema.groups,
            0,
            &root_items,
            schema,
            data,
            &offset_x,
            &body_offset_y,
            &header_offset_y,
            &footer_offset_y,
        ));
    } else {
        t.push_str(&render_document(
            schema, data, data, &offset_x, &body_offset_y, &header_offset_y, &footer_offset_y,
        ));
    }

    t
}
