use crate::schema::*;
use serde_json::Value;

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
        _ => (210.0, 297.0), // Default A4
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

pub fn resolve_path<'a>(path: &str, data: &'a Value) -> Option<&'a Value> {
    let p = path.trim();
    if p.is_empty() { return None; }
    let mut current = data;
    for part in p.split('.') {
        if part.is_empty() { continue; }
        current = current.get(part)?;
    }
    Some(current)
}

pub fn resolve_binding(expr: &str, data: &Value) -> String {
    resolve_binding_scoped(expr, data, data)
}

pub fn resolve_binding_scoped(expr: &str, local_data: &Value, global_data: &Value) -> String {
    let mut result = String::new();
    let mut last_end = 0;
    let mut current = 0;
    while let Some(start_offset) = expr[current..].find("{{") {
        let start = current + start_offset;
        if let Some(end_offset) = expr[start..].find("}}") {
            let end = start + end_offset;
            result.push_str(&expr[last_end..start]);
            let path = expr[start + 2..end].trim().to_string();
            let mut val_opt = resolve_path(&path, local_data);
            if val_opt.is_none() {
                val_opt = resolve_path(&path, global_data);
            }
            let value = val_opt
                .map(|v| match v {
                    Value::String(s) => s.clone(),
                    _ => v.to_string()
                })
                .unwrap_or_else(|| format!("{{{{{}}}}}", path));
            result.push_str(&value);
            last_end = end + 2;
            current = last_end;
        } else { break; }
    }
    result.push_str(&expr[last_end..]);
    result
}

pub fn escape_typst(s: &str) -> String {
    s.replace("\\", "\\\\")
     .replace("#", "\\#")
     .replace("$", "\\$")
     .replace("*", "\\*")
     .replace("_", "\\_")
     .replace("[", "\\[")
     .replace("]", "\\]")
     .replace("(", "\\(")
     .replace(")", "\\)")
     .replace("{", "\\{")
     .replace("}", "\\}")
     .replace("\"", "\\\"")
     .replace("<", "\\<")
     .replace(">", "\\>")
     .replace("@", "\\@")
     .replace("=", "\\=")
}

pub fn escape_string_literal(s: &str) -> String {
    s.replace("\\", "\\\\").replace("\"", "\\\"")
}

pub fn format_color(color: &str) -> String {
    let c = color.trim();
    if c.is_empty() { return "none".to_string(); }
    if c.starts_with('#') {
        format!("rgb(\"{}\")", c)
    } else if c.starts_with("rgb(") || c.starts_with("rgba(") || c.contains('.') {
        c.to_string()
    } else {
        c.to_string()
    }
}

pub fn wrap_placement(base: &BaseComponent, body: &str, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);
    let h = base.height.unwrap_or(20.0);
    format!("{}place(dx: {} + {}mm, dy: {} + {}mm)[#block(width: {}mm, height: {}mm, clip: false)[{}]]\n", prefix, offset_x, x, offset_y, y, w, h, body)
}
