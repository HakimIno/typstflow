use crate::schema::Zone;

pub fn get_typst_paper_name(size: &str) -> String {
    match size.to_lowercase().as_str() {
        "letter" => "us-letter".to_string(),
        "legal" => "us-legal".to_string(),
        "tabloid" => "us-tabloid".to_string(),
        "b4" => "iso-b4".to_string(),
        "b5" => "iso-b5".to_string(),
        other => other.to_string(),
    }
}

pub fn paper_dimensions(size: &str, landscape: bool) -> (f64, f64) {
    let (w, h) = match size.to_lowercase().as_str() {
        "a4" => (210.0, 297.0),
        "a5" => (148.0, 210.0),
        "a6" => (105.0, 148.0),
        "letter" => (215.9, 279.4),
        "legal" => (215.9, 355.6),
        "b4" => (250.0, 353.0),
        "b5" => (176.0, 250.0),
        _ => (210.0, 297.0),
    };
    if landscape { (h, w) } else { (w, h) }
}

pub fn parse_mm_value(val: &str) -> f64 {
    val.replace("mm", "").trim().parse().unwrap_or(0.0)
}

#[allow(dead_code)]
pub fn is_zone_empty(zone: &Zone) -> bool {
    zone.components.is_empty() && zone.min_height.is_none()
}
