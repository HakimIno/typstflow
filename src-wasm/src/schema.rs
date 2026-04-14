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
    pub variables: Vec<VariableDefinition>,
    pub data_schema: Vec<DataFieldDefinition>,
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
    pub body: Zone,
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
    pub font_weight: Option<String>,
    pub color: Option<String>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub line_height: Option<f64>,
    pub letter_spacing: Option<String>,
    pub justify: Option<bool>,
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
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellStyle {
    pub fill: Option<String>,
    pub stroke: Option<serde_json::Value>, // string or {top, bottom, left, right}
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
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BarcodeComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub value: String,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QRComponent {
    #[serde(flatten)]
    pub base: BaseComponent,
    pub value: String,
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
