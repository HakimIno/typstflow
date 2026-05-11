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
        _ => (210.0, 297.0),
    };
    if landscape { (h, w) } else { (w, h) }
}

pub fn parse_mm_value(val: &str) -> f64 {
    let parsed: f64 = val.replace("mm", "").trim().parse().unwrap_or(0.0);
    if parsed.is_finite() {
        parsed
    } else {
        0.0
    }
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

/// Resolve aggregate function: SUM, COUNT, AVG, MIN, MAX over a slice of items.
pub fn resolve_aggregate(func: &str, path: &str, items: &[Value]) -> String {
    let values: Vec<f64> = items.iter()
        .filter_map(|item| resolve_path(path, item))
        .filter_map(|v| match v {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.parse::<f64>().ok(),
            _ => None,
        })
        .collect();

    match func.to_uppercase().as_str() {
        "SUM" => {
            let sum: f64 = values.iter().sum();
            format!("{:.2}", sum)
        }
        "COUNT" => items.len().to_string(),
        "AVG" => {
            if values.is_empty() { return "0".to_string(); }
            format!("{:.2}", values.iter().sum::<f64>() / values.len() as f64)
        }
        "MIN" => values.iter().cloned().fold(f64::INFINITY, f64::min).to_string(),
        "MAX" => values.iter().cloned().fold(f64::NEG_INFINITY, f64::max).to_string(),
        _ => "0".to_string(),
    }
}

/// Resolve a binding expression, supporting:
/// - Normal paths: {{field.path}}
/// - Aggregates: {{SUM(field)}}, {{COUNT(field)}}, {{AVG(field)}}, {{MIN(field)}}, {{MAX(field)}}
/// - Scoped lookup: tries local_data first, then global_data
pub fn resolve_binding_with_aggregates(
    expr: &str,
    local: &Value,
    global: &Value,
    items: &[Value],
) -> String {
    if !expr.contains("{{") { return expr.to_string(); }

    let mut result = String::new();
    let mut remaining = expr;

    while let Some(open) = remaining.find("{{") {
        result.push_str(&remaining[..open]);
        let after_open = &remaining[open + 2..];

        if let Some(close) = after_open.find("}}") {
            let inner = after_open[..close].trim();

            let resolved = if let Some(paren_pos) = inner.find('(') {
                let func = &inner[..paren_pos];
                let rest = &inner[paren_pos + 1..];
                if let Some(close_paren) = rest.rfind(')') {
                    let path = rest[..close_paren].trim();
                    match func.to_uppercase().as_str() {
                        "SUM" | "COUNT" | "AVG" | "MIN" | "MAX" => {
                            resolve_aggregate(func, path, items)
                        }
                        _ => format!("{{{{{}}}}}", inner),
                    }
                } else {
                    format!("{{{{{}}}}}", inner)
                }
            } else {
                // Normal binding — try local then global
                let val_opt = resolve_path(inner, local)
                    .or_else(|| resolve_path(inner, global));

                if let Some(v) = val_opt {
                    match v {
                        Value::String(s) => s.clone(),
                        _ => v.to_string(),
                    }
                } else if inner.ends_with(".length") {
                    // Special case for .length property on arrays
                    let path = &inner[..inner.len() - 7];
                    let array_opt = resolve_path(path, local)
                        .or_else(|| resolve_path(path, global));
                    
                    if let Some(Value::Array(arr)) = array_opt {
                        arr.len().to_string()
                    } else {
                        format!("{{{{{}}}}}", inner)
                    }
                } else {
                    format!("{{{{{}}}}}", inner)
                }
            };

            result.push_str(&resolved);
            remaining = &after_open[close + 2..];
        } else {
            result.push_str("{{");
            remaining = after_open;
        }
    }

    result.push_str(remaining);
    result
}

#[allow(dead_code)]
pub fn resolve_binding(expr: &str, data: &Value) -> String {
    resolve_binding_scoped(expr, data, data)
}

pub fn resolve_binding_scoped(expr: &str, local_data: &Value, global_data: &Value) -> String {
    resolve_binding_with_aggregates(expr, local_data, global_data, &[])
}

/// Escape characters that have special meaning in Typst markup.
/// Canonical set used across the entire Rust generator — matches the TS typst-utils.ts escaper.
pub fn escape_typst(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('#', "\\#")
        .replace('$', "\\$")
        .replace('*', "\\*")
        .replace('_', "\\_")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace('(', "\\(")
        .replace(')', "\\)")
        .replace('{', "\\{")
        .replace('}', "\\}")
        .replace('"', "\\\"")
        .replace('<', "\\<")
        .replace('>', "\\>")
        .replace('@', "\\@")
        .replace('=', "\\=")
        .replace('~', "\\~")
}

/// Escape only characters that are special inside Typst string literals ("...").
pub fn escape_string_literal(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn format_color(color: &str) -> String {
    let c = color.trim();
    if c.is_empty() { return "none".to_string(); }
    if c.starts_with('#') {
        format!("rgb(\"{}\")", c)
    } else {
        c.to_string()
    }
}

/// Apply CSS-like text transform to a string.
pub fn apply_text_transform(s: &str, transform: &str) -> String {
    match transform {
        "upper" | "uppercase" => s.to_uppercase(),
        "lower" | "lowercase" => s.to_lowercase(),
        "capitalize" | "title" => {
            let mut chars = s.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
        _ => s.to_string(),
    }
}

pub fn format_dimension(val: &Option<Value>, default_mm: f64) -> String {
    match val {
        Some(Value::Number(n)) => format!("{}mm", n.as_f64().unwrap_or(default_mm)),
        Some(Value::String(s)) => {
            let s = s.trim();
            if s == "auto" {
                "auto".to_string()
            } else if s.ends_with("mm") || s.ends_with("pt") || s.ends_with("cm") || s.ends_with('%') || s.ends_with("fr") {
                s.to_string()
            } else {
                format!("{}mm", s)
            }
        }
        _ => format!("{}mm", default_mm),
    }
}

/// Emit a #place() + #block() wrapper for a component.
/// offset_x/offset_y are zone origins (from page corner); x/y are component coords within the zone.
pub fn wrap_placement(base: &BaseComponent, body: &str, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);
    let h_typst = format_dimension(&base.height, 20.0);

    // Compute absolute mm positions, combining zone offset + component coord.
    let offset_x_mm: f64 = offset_x.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let offset_y_mm: f64 = offset_y.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let abs_x = offset_x_mm + x;
    let abs_y = offset_y_mm + y;

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        // Use weak: true so it doesn't create a blank first page if the document just started.
        // The #box() anchors the page so subsequent weak pagebreaks WILL trigger.
        out.push_str("#pagebreak(weak: true)\n#box()\n");
    }
    // Explicitly set alignment to top + left so it doesn't inherit alignment from parent (e.g. page header defaults to bottom)
    out.push_str(&format!(
        "{}place(top + left, dx: {}mm, dy: {}mm)[#block(width: {}mm, height: {}, clip: false)[{}]]\n",
        prefix, abs_x, abs_y, w, h_typst, body
    ));
    out
}

/// Emit a #pad() + #block() wrapper for a component to keep it in the normal flow.
/// This allows long components (like Tables) to natively break across pages.
pub fn wrap_flow(base: &BaseComponent, body: &str, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);

    let y = base.y.unwrap_or(0.0);
    let offset_x_mm: f64 = offset_x.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let offset_y_mm: f64 = offset_y.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let abs_x = offset_x_mm + x;
    let abs_y = offset_y_mm + y;

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n");
    }
    
    // In flow layout, we use 'y' as top padding for the component.
    // Note: If multiple components are in a flow, their 'y' values in an absolute schema
    // would normally be cumulative. For now, we assume 'y' is the desired offset from the previous element or top.
    out.push_str(&format!(
        "{}pad(left: {}mm, top: {}mm)[#block(width: {}mm, clip: false)[{}]]\n",
        prefix, abs_x, abs_y, w, body
    ));
    out
}

/// Check if a component should be rendered (respects `visible` binding).
pub fn is_visible(base: &BaseComponent, local: &Value, global: &Value) -> bool {
    match &base.visible {
        None => true,
        Some(expr) => {
            let resolved = resolve_binding_scoped(expr, local, global);
            !matches!(resolved.to_lowercase().trim(), "false" | "0" | "")
        }
    }
}
