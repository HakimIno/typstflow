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
                val_opt
                    .map(|v| match v {
                        Value::String(s) => s.clone(),
                        _ => v.to_string(),
                    })
                    .unwrap_or_else(|| format!("{{{{{}}}}}", inner))
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

/// Emit a #place() + #block() wrapper for a component.
/// offset_x/offset_y are zone origins (from page corner); x/y are component coords within the zone.
pub fn wrap_placement(base: &BaseComponent, body: &str, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);
    let h = base.height.unwrap_or(20.0);

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
        "{}place(top + left, dx: {}mm, dy: {}mm)[#block(width: {}mm, height: {}mm, clip: false)[{}]]\n",
        prefix, abs_x, abs_y, w, h, body
    ));
    out
}

/// Emit a flow wrapper for a component — no #place(), so content stays in document flow.
/// Respects the component's x coordinate as left padding and width for sizing,
/// so moving x in the JSON shifts the element visually without touching page margins.
///
/// Uses #block(width:100%)[#pad(left:Xmm)[#block(width:Wmm)]] to create the left
/// indent. This avoids #align() which triggers a Typst parser error ("# not valid
/// in code") when the body contains #set rules nested inside deep content brackets.
pub fn wrap_flow_block(base: &BaseComponent, body: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let w = base.width.unwrap_or(190.0);
    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n");
    }
    if !body.is_empty() {
        if x > 0.0 {
            // Outer full-width block keeps content in flow; inner pad creates the
            // 15 mm left indent; innermost block constrains the content width.
            out.push_str(&format!(
                "{}block(width: 100%)[#pad(left: {}mm)[#block(width: {}mm, clip: false)[{}]]]\n",
                prefix, x, w, body
            ));
        } else {
            out.push_str(&format!("{}block(width: {}mm, clip: false)[{}]\n", prefix, w, body));
        }
    }
    out
}

/// Emit a #pad() + #block() wrapper for a component to keep it in the normal flow.
/// This allows long components (like Tables) to natively break across pages.
pub fn wrap_flow(base: &BaseComponent, body: &str, offset_x: &str, offset_y: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);

    let offset_x_mm: f64 = offset_x.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let offset_y_mm: f64 = offset_y.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let abs_x = offset_x_mm + x;
    let abs_y = offset_y_mm + y;

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n");
    }
    
    // Using pad instead of place keeps the element in the document flow,
    // which is required for native page breaking in Typst.
    // Wrap in align(top + left) to ensure it starts exactly from the top-left of the flow container.
    out.push_str(&format!(
        "{}align(top + left)[#pad(top: {}mm, left: {}mm)[#block(width: {}mm, clip: false)[{}]]]\n",
        prefix, abs_y, abs_x, w, body
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
