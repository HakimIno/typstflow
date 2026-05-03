pub mod utils;
pub mod preamble;
pub mod elements;
pub mod table;

use crate::schema::*;
use serde_json::Value;

use preamble::get_preamble;
use elements::*;
use table::render_table;

pub fn generate_typst(schema: &LayoutSchema, data: &Value) -> String {
    let mut t = String::new();
    
    // 1. Setup Preamble & Helpers
    t.push_str(&get_preamble());

    // 2. Page Dimensions & Configuration
    let h_height = schema.zones.header.min_height.clone().unwrap_or("0mm".to_string());
    let f_height = schema.zones.footer.min_height.clone().unwrap_or("0mm".to_string());
    let is_landscape = schema.page.orientation == "landscape";
    let (_page_width_mm, page_height_mm) = utils::paper_dimensions(&schema.page.size, is_landscape);

    t.push_str(&format!(
        "#set page(\n  paper: \"{}\",\n  flipped: {},\n  margin: 0mm,\n)\n\n",
        utils::get_typst_paper_name(&schema.page.size),
        is_landscape,
    ));

    // 3. Global Text Style
    if let Some(font) = schema.fonts.first() {
        t.push_str(&format!(
            "#set text(font: \"{}\", size: {}pt, lang: \"th\")\n",
            font.family, font.size
        ));
    }
    t.push_str("#set par(leading: 0.2em, justify: false)\n\n");

    // 4. Coordinates
    let offset_x = "0mm";
    let header_offset_y = "0mm";
    let body_offset_y = h_height.clone();
    let footer_pos = page_height_mm - utils::parse_mm_value(&f_height);
    let footer_offset_y = format!("{}mm", footer_pos);

    // 5. Multi-Page Render Loop
    for (i, page_def) in schema.pages.iter().enumerate() {
        if i > 0 {
            t.push_str("\n#pagebreak(weak: true)\n");
        }

        // --- RENDER HEADER (Conditional) ---
        let show_header = schema.zones.header.repeat_on_every_page.unwrap_or(false) || i == 0;
        if show_header {
            t.push_str(&format!("// --- PAGE {} HEADER ---\n", i + 1));
            for comp in &schema.zones.header.components {
                t.push_str(&render_component(comp, data, offset_x, header_offset_y, "#"));
            }
        }

        // --- RENDER BODY (Page-Specific) ---
        t.push_str(&format!("// --- PAGE {} BODY ---\n", i + 1));
        for comp in &page_def.body.components {
            t.push_str(&render_component(comp, data, offset_x, &body_offset_y, "#"));
        }

        // --- RENDER FOOTER (Conditional) ---
        let show_footer = schema.zones.footer.repeat_on_every_page.unwrap_or(false) || i == schema.pages.len() - 1;
        if show_footer {
            t.push_str(&format!("// --- PAGE {} FOOTER ---\n", i + 1));
            for comp in &schema.zones.footer.components {
                t.push_str(&render_component(comp, data, offset_x, &footer_offset_y, "#"));
            }
        }
    }

    t
}

fn render_component(node: &ComponentNode, data: &Value, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    match node {
        ComponentNode::Text(c) => render_text(c, data, offset_x, offset_y, prefix),
        ComponentNode::Line(c) => render_line(c, offset_x, offset_y, prefix),
        ComponentNode::Image(c) => render_image(c, offset_x, offset_y, prefix),
        ComponentNode::Table(c) => render_table(c, data, offset_x, offset_y, prefix),
        ComponentNode::Spacer(c) => render_spacer(c, offset_x, offset_y, prefix),
        ComponentNode::Barcode(c) => render_barcode(c, offset_x, offset_y, prefix),
        ComponentNode::Qr(c) => render_qr(c, offset_x, offset_y, prefix),
        ComponentNode::PageNumber(c) => render_page_number(c, offset_x, offset_y, prefix),
        ComponentNode::PageBreakIndicator(c) => render_page_break_indicator(c, offset_x, offset_y, prefix),
        ComponentNode::SummaryBox(c) => render_summary_box(c, data, offset_x, offset_y, prefix),
        ComponentNode::Repeater(c) => render_placeholder_box("REPEATER", &c.base, "", data, offset_x, offset_y, prefix),
        ComponentNode::Columns(c) => render_placeholder_box("COLUMNS", &c.base, "", data, offset_x, offset_y, prefix),
    }
}
