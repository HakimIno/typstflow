use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use std::collections::HashMap;

// Definitions for Input
#[derive(Deserialize, Clone)]
pub struct TableComponentInput {
    #[serde(default)]
    pub id: Option<String>,
    pub x: Option<f32>,
    pub y: Option<f32>,
    pub width: Option<f32>,
    pub columns: Vec<TableColumnInput>,
    #[serde(rename = "headerRows")]
    pub header_rows: Option<Vec<TableRowInput>>,
    #[serde(rename = "detailRows")]
    pub detail_rows: Option<Vec<TableRowInput>>,
    #[serde(rename = "footerRows")]
    pub footer_rows: Option<Vec<TableRowInput>>,
    #[serde(rename = "repeatHeaderOnPage")]
    pub repeat_header: Option<bool>,
    pub style: Option<TableStyleInput>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TableStyleInput {
    pub font_size: Option<f32>,
    pub header_font_size: Option<f32>,
    pub header_font_weight: Option<String>,
    pub header_background: Option<String>,
    pub header_color: Option<String>,
    pub body_font_size: Option<f32>,
    pub body_color: Option<String>,
    pub cell_styles: Option<HashMap<String, CellStyleInput>>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CellStyleInput {
    pub fill: Option<String>,
    pub align: Option<String>,
    pub weight: Option<String>,
    pub size: Option<f32>,
    pub color: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct TableColumnInput {
    #[serde(default)]
    pub id: Option<String>,
    pub width: String, // "auto", "1fr", "30mm"
}

#[derive(Deserialize, Clone)]
pub struct TableRowInput {
    #[serde(default)]
    pub id: Option<String>,
    pub cells: Vec<TableCellInput>,
    pub height: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct TableCellInput {
    #[serde(default)]
    pub id: Option<String>,
    pub content: Option<String>,
    pub colspan: Option<usize>,
    pub rowspan: Option<usize>,
    pub align: Option<String>,
    pub fill: Option<String>,
    pub style: Option<TextStyleInput>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextStyleInput {
    pub font_size: Option<f32>,
}

#[derive(Deserialize, Clone)]
pub struct PageConfigInput {
    pub height: f32,
    pub margin_top: f32,
    pub margin_bottom: f32,
}

// Definitions for Output
#[derive(Serialize)]
pub struct ResolvedCell {
    pub id: String,
    pub section: String,
    pub row_id: String,
    pub col_idx: usize,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub page_index: u32,
    pub content: String,
    pub fill: Option<String>,
    pub align: String,
    pub rowspan: usize,
    pub colspan: usize,
}

#[derive(Serialize)]
pub struct TableResolutionResult {
    pub cells: Vec<ResolvedCell>,
    pub total_height: f32,
    pub pages_used: u32,
}

#[wasm_bindgen]
pub struct TableEngine {}

#[wasm_bindgen]
impl TableEngine {
    pub fn resolve(table_json: &str, page_height_mm: f32, start_y_mm: f32) -> Result<JsValue, JsValue> {
        let table: TableComponentInput = serde_json::from_str(table_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse table JSON: {}", e)))?;

        let mut resolved_cells = Vec::new();

        // 1. Resolve Column Widths
        let table_width = table.width.unwrap_or(190.0); // Fallback to A4 width minus margins
        let mut col_widths = vec![0.0; table.columns.len()];
        let mut fr_count = 0.0;
        let mut fixed_width_sum = 0.0;

        for (i, col) in table.columns.iter().enumerate() {
            if col.width.ends_with("mm") {
                if let Ok(w) = col.width.replace("mm", "").parse::<f32>() {
                    col_widths[i] = w;
                    fixed_width_sum += w;
                }
            } else if col.width.ends_with("cm") {
                if let Ok(w) = col.width.replace("cm", "").parse::<f32>() {
                    col_widths[i] = w * 10.0;
                    fixed_width_sum += w * 10.0;
                }
            } else if col.width.contains("fr") {
                if let Ok(f) = col.width.replace("fr", "").parse::<f32>() {
                    fr_count += f;
                } else {
                    fr_count += 1.0;
                }
            } else if col.width == "auto" {
                // Approximate auto to 1fr for now
                fr_count += 1.0;
            } else {
                fr_count += 1.0;
            }
        }

        let remaining_width = (table_width - fixed_width_sum).max(0.0);
        let fr_unit = if fr_count > 0.0 { remaining_width / fr_count } else { 0.0 };

        for (i, col) in table.columns.iter().enumerate() {
            if col_widths[i] == 0.0 {
                let f = col.width.replace("fr", "").parse::<f32>().unwrap_or(1.0);
                col_widths[i] = f * fr_unit;
            }
        }

        // 2. Traversal State
        let mut current_y = start_y_mm;
        let mut page_index = 0;
        let mut span_matrix: HashMap<(usize, usize), usize> = HashMap::new(); // (row_idx, col_idx) -> rowspan_remaining

        let mut process_rows = |rows: &Vec<TableRowInput>, section: &str, _is_header: bool| {
            for (row_idx, row) in rows.iter().enumerate() {
                let _cell_idx = 0;
                let mut row_height = 8.0; // Base default height in mm (approx 22.6pt)
                
                if let Some(h) = &row.height {
                    if h.ends_with("mm") {
                        if let Ok(parsed) = h.replace("mm", "").parse::<f32>() {
                            row_height = parsed;
                        }
                    }
                }

                let mut current_x = table.x.unwrap_or(0.0);
                let mut col_ptr = 0;
                
                let mut row_cells_to_add = Vec::new();

                for cell in &row.cells {
                    // Skip columns that are covered by a previous rowspan
                    while let Some(&remaining) = span_matrix.get(&(row_idx, col_ptr)) {
                        if remaining > 0 {
                            for _c in 0..1 { // We don't know the exact colspan of the spanning cell easily here without tracking it better, simple skip for now.
                                let skip_w = col_widths.get(col_ptr).unwrap_or(&0.0);
                                current_x += skip_w;
                                col_ptr += 1;
                            }
                        } else {
                            break;
                        }
                    }

                    if col_ptr >= col_widths.len() { break; }

                    let colspan = cell.colspan.unwrap_or(1).max(1);
                    let rowspan = cell.rowspan.unwrap_or(1).max(1);

                    let mut cell_w = 0.0;
                    for c in 0..colspan {
                        if col_ptr + c < col_widths.len() {
                            cell_w += col_widths[col_ptr + c];
                        }
                    }

                    // Estimate Text Wrapping Height (if row height isn't fixed large enough)
                    let text = cell.content.clone().unwrap_or_default();
                    
                    let mut font_size_pt = 10.0;
                    let mut is_bold = false;

                    if let Some(s) = &cell.style {
                        if let Some(fs) = s.font_size { font_size_pt = fs; }
                    } else if let Some(s) = &table.style {
                        // 1. Check cell_styles map first
                        let cell_key = format!("{}:{}", section, col_ptr);
                        if let Some(cs) = s.cell_styles.as_ref().and_then(|m| m.get(&cell_key)) {
                            if let Some(size) = cs.size { font_size_pt = size; }
                            if let Some(weight) = &cs.weight { is_bold = weight == "bold"; }
                        } else {
                            // 2. Fallback to section defaults
                            if section == "header" {
                                if let Some(fs) = s.header_font_size { font_size_pt = fs; }
                                if let Some(fw) = &s.header_font_weight { is_bold = fw == "bold"; }
                            } else {
                                if let Some(fs) = s.body_font_size { font_size_pt = fs; }
                            }
                        }
                    }
                    
                    let font_size_mm = font_size_pt * 0.3528; // pt to mm
                    // Bold text is generally wider, adjust char_width estimate
                    let char_width_factor = if is_bold { 0.6 } else { 0.5 };
                    let char_width = font_size_mm * char_width_factor;
                    let chars_per_line = (cell_w / char_width).max(1.0);
                    let estimated_lines = (text.chars().count() as f32 / chars_per_line).ceil().max(1.0);
                    let content_height = estimated_lines * (font_size_mm * 1.2) + 2.0; // + padding

                    if content_height > row_height && row.height.is_none() {
                        row_height = content_height;
                    }

                    // Record rowspan in matrix for future rows
                    if rowspan > 1 {
                        for r in 1..rowspan {
                            for c in 0..colspan {
                                span_matrix.insert((row_idx + r, col_ptr + c), rowspan - r);
                            }
                        }
                    }

                    row_cells_to_add.push(ResolvedCell {
                        id: cell.id.clone().unwrap_or_default(),
                        section: section.to_string(),
                        row_id: row.id.clone().unwrap_or_default(),
                        col_idx: col_ptr,
                        x: current_x,
                        y: 0.0, // placeholder, will be set after row_height is finalized
                        width: cell_w,
                        height: 0.0, // placeholder
                        page_index: 0,
                        content: text,
                        fill: cell.fill.clone(),
                        align: cell.align.clone().unwrap_or_else(|| "left".to_string()),
                        rowspan,
                        colspan,
                    });

                    current_x += cell_w;
                    col_ptr += colspan;
                }

                // Check Page Break
                if current_y + row_height > page_height_mm && current_y > start_y_mm {
                    page_index += 1;
                    current_y = start_y_mm; // or margin_top
                    // (Repeating header logic could go here, omitting for brevity in MVP)
                }

                // Assign finalized Y and Height
                for rc in &mut row_cells_to_add {
                    rc.y = current_y;
                    rc.height = row_height; // Wait, actually rowspan height should sum up subsequent rows, but for MVP we use basic row_height.
                    rc.page_index = page_index;
                }

                resolved_cells.extend(row_cells_to_add);
                current_y += row_height;
            }
        };

        if let Some(h) = &table.header_rows { process_rows(h, "header", true); }
        if let Some(d) = &table.detail_rows { process_rows(d, "data", false); }
        if let Some(f) = &table.footer_rows { process_rows(f, "footer", false); }

        let result = TableResolutionResult {
            cells: resolved_cells,
            total_height: current_y - start_y_mm,
            pages_used: page_index + 1,
        };

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
    }
}
