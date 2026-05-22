use im::Vector;
use serde::{Deserialize, Serialize};

/// Mirrors TS LayoutSchema — components stored as JSON values for flexibility.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutSchemaDoc {
    pub id: String,
    pub name: String,
    pub version: String,
    pub page: PageConfig,
    #[serde(default)]
    pub fonts: Vec<FontConfig>,
    pub zones: Zones,
    #[serde(deserialize_with = "deserialize_pages")]
    #[serde(serialize_with = "serialize_pages")]
    pub pages: Vector<PageDefinition>,
    #[serde(default, deserialize_with = "deserialize_groups")]
    #[serde(serialize_with = "serialize_groups")]
    pub groups: Vector<GroupDefinition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_data_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_data_source: Option<String>,
    #[serde(default)]
    pub variables: Vec<serde_json::Value>,
    #[serde(default)]
    pub data_schema: Vec<serde_json::Value>,
    pub metadata: SchemaMetadata,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageConfig {
    pub size: String,
    pub orientation: String,
    pub margin: PageMargin,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PageMargin {
    pub top: String,
    pub bottom: String,
    pub left: String,
    pub right: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct FontConfig {
    pub family: String,
    pub role: String,
    pub size: f64,
    pub embedded: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Zones {
    pub header: Zone,
    pub footer: Zone,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Zone {
    pub id: String,
    #[serde(default)]
    pub components: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_height: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub padding: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_on_first_page_only: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_on_last_page_only: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repeat_on_every_page: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flow_gap: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageDefinition {
    pub id: String,
    pub name: String,
    pub body: Zone,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_source: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupDefinition {
    pub id: String,
    pub name: String,
    pub field: String,
    pub header: Zone,
    pub footer: Zone,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repeat_header_on_page: Option<bool>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaMetadata {
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub author: String,
}

fn deserialize_pages<'de, D>(deserializer: D) -> Result<Vector<PageDefinition>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let vec = Vec::<PageDefinition>::deserialize(deserializer)?;
    Ok(Vector::from(vec))
}

fn serialize_pages<S>(pages: &Vector<PageDefinition>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let vec: Vec<&PageDefinition> = pages.iter().collect();
    vec.serialize(serializer)
}

fn deserialize_groups<'de, D>(deserializer: D) -> Result<Vector<GroupDefinition>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let vec = Vec::<GroupDefinition>::deserialize(deserializer)?;
    Ok(Vector::from(vec))
}

fn serialize_groups<S>(groups: &Vector<GroupDefinition>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let vec: Vec<&GroupDefinition> = groups.iter().collect();
    vec.serialize(serializer)
}

impl LayoutSchemaDoc {
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}
