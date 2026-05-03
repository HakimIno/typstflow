use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutSchema {
    pub id: String,
    pub name: String,
    pub version: String,
    pub page: PageConfig,
    pub fonts: Vec<FontConfig>,
    pub zones: Zones,
    pub pages: Vec<PageDefinition>,
    pub variables: Vec<VariableDefinition>,
    pub data_schema: Vec<DataFieldDefinition>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageDefinition {
    pub id: String,
    pub name: Option<String>,
    pub body: Zone,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageConfig {
    pub size: String,
    pub orientation: String,
    pub margin: Margin,
    pub background: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Margin {
    pub top: String,
    pub bottom: String,
    pub left: String,
    pub right: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontConfig {
    pub family: String,
    pub role: String,
    pub size: f64,
    pub embedded: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Zones {
    pub header: Zone,
    pub footer: Zone,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Zone {
    pub id: String,
    pub components: Vec<ComponentNode>,
    pub min_height: Option<String>,
    pub background: Option<String>,
    pub padding: Option<String>,
    pub show_on_first_page_only: Option<bool>,
    pub show_on_last_page_only: Option<bool>,
    pub repeat_on_every_page: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ComponentNode {
    Text(TextComponent),
    Table(TableComponent),
    Image(ImageComponent),
    Line(LineComponent),
    Spacer(SpacerComponent),
    #[serde(rename = "summary-box")]
    SummaryBox(SummaryBoxComponent),
    Barcode(BarcodeComponent),
    Qr(QRComponent),
    Repeater(RepeaterComponent),
    Columns(ColumnsComponent),
    #[serde(rename = "page-break-indicator")]
    PageBreakIndicator(PageBreakIndicatorComponent),
    #[serde(rename = "page-number")]
    PageNumber(PageNumberComponent),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseComponent {
    pub id: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub align: Option<String>,
    pub visible: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub content: String,
    pub style: Option<TextStyle>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStyle {
    pub font_size: Option<f64>,
    pub font_family: Option<String>,
    pub font_weight: Option<String>,
    pub color: Option<String>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub line_height: Option<f64>,
    pub letter_spacing: Option<String>,
    pub justify: Option<bool>,
}


// --- Individual table cell (maps to Typst table.cell) ---
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableCell {
    pub id: String,
    pub content: String,
    pub colspan: Option<u32>,
    pub rowspan: Option<u32>,
    pub align: Option<String>,
    pub fill: Option<String>,
    pub inset: Option<String>,
    pub stroke: Option<serde_json::Value>, // string or StrokeConfig object
    pub style: Option<TextStyle>,
    pub format: Option<String>,
}

// --- Structured table row (maps to table.header / table.footer / data row) ---
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableRow {
    pub id: String,
    pub r#type: String, // "header" | "data" | "footer"
    pub cells: Vec<TableCell>,
    pub height: Option<String>,
    pub repeat: Option<bool>,
}

// --- Manual horizontal line (maps to table.hline) ---
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HLineConfig {
    pub id: String,
    pub y: u32,
    pub start: Option<u32>,
    pub end: Option<u32>,
    pub stroke: Option<String>,
    pub position: Option<String>, // "top" | "bottom"
}

// --- Manual vertical line (maps to table.vline) ---
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VLineConfig {
    pub id: String,
    pub x: u32,
    pub start: Option<u32>,
    pub end: Option<u32>,
    pub stroke: Option<String>,
    pub position: Option<String>, // "start" | "end"
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub data_source: String,
    pub columns: Vec<TableColumn>,
    pub style: Option<TableStyle>,
    pub show_header: Option<bool>,
    pub repeat_header_on_page: Option<bool>,
    pub is_static: Option<bool>,
    pub summary_rows: Option<Vec<SummaryRow>>,
    // --- New: Structured header/footer rows ---
    pub header_rows: Option<Vec<TableRow>>,
    pub detail_rows: Option<Vec<TableRow>>,
    pub footer_rows: Option<Vec<TableRow>>,
    // --- New: Manual lines ---
    pub hlines: Option<Vec<HLineConfig>>,
    pub vlines: Option<Vec<VLineConfig>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableColumn {
    pub id: String,
    pub header: String,
    pub field: String,
    pub width: String,
    pub align: Option<String>,
    pub border_width: Option<String>,
    pub border_color: Option<String>,
    pub background: Option<String>,
    pub colspan: Option<u32>,
    pub rowspan: Option<u32>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableStyle {
    pub header_background: Option<String>,
    pub alternate_row_background: Option<String>,
    pub border_color: Option<String>,
    pub border_width: Option<String>,
    pub line_height: Option<f64>,
    pub letter_spacing: Option<String>,
    pub justify: Option<bool>,
    pub cell_styles: Option<HashMap<String, CellStyle>>,
    pub header_rows: Option<u32>,
    pub footer_rows: Option<u32>,
    pub row_heights: Option<Vec<String>>,
    // --- New fields from TypeScript schema ---
    pub inset: Option<String>,
    pub fill_pattern: Option<String>, // "none"|"striped-rows"|"striped-cols"|"checkerboard"|"header-only"
    pub striped_color1: Option<String>,
    pub striped_color2: Option<String>,
    pub stroke: Option<serde_json::Value>, // string or StrokeConfig object
    pub column_gutter: Option<String>,
    pub row_gutter: Option<String>,
    pub gutter: Option<String>,
    pub font_size: Option<f64>,
    pub font_weight: Option<String>,
    pub cell_padding: Option<String>,
    pub header_text_color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellStyle {
    pub fill: Option<String>,
    pub stroke: Option<serde_json::Value>,
    pub align: Option<String>,
    pub weight: Option<String>,
    pub size: Option<f64>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub src: String,
    /// Base64 data URL (data:image/png;base64,...) — pre-registered in WASM image registry
    pub src_data: Option<String>,
    pub mime_type: Option<String>,
    pub fit: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub color: Option<String>,
    pub thickness: Option<String>,
    pub style: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpacerComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryBoxComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub rows: Vec<SummaryRow>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryRow {
    pub label: String,
    pub value: String,
    pub style: Option<String>,
    pub separator: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarcodeComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub value: String,
    pub format: String,
    pub src: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QRComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub value: String,
    pub src: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableDefinition {
    pub name: String,
    pub r#type: String,
    pub default_value: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFieldDefinition {
    pub path: String,
    pub r#type: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepeaterComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub data_source: String,
    pub children: Vec<ComponentNode>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnsComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub columns: Vec<ColumnDef>,
    pub gap: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDef {
    pub width: String,
    pub components: Vec<ComponentNode>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageBreakIndicatorComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub label: Option<String>,
    pub style: Option<String>,
    pub show_page_number: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageNumberComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub format: String,
    pub style: Option<TextStyle>,
}
