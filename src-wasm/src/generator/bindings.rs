use crate::schema::BaseComponent;
use serde_json::Value;

use super::formatting::apply_pipe;

pub fn resolve_path<'a>(path: &str, data: &'a Value) -> Option<&'a Value> {
    let p = path.trim();
    if p.is_empty() {
        return None;
    }
    let mut current = data;
    for part in p.split('.') {
        if part.is_empty() {
            continue;
        }
        current = current.get(part)?;
    }
    Some(current)
}

pub fn resolve_aggregate(func: &str, path: &str, items: &[Value]) -> String {
    let clean_path = path
        .trim()
        .replace("items.", "")
        .replace("items,", "")
        .replace('\'', "")
        .replace('\"', "")
        .trim()
        .to_string();

    let values: Vec<f64> = items
        .iter()
        .filter_map(|item| resolve_path(&clean_path, item))
        .filter_map(|v| match v {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.replace(",", "").parse::<f64>().ok(),
            _ => None,
        })
        .collect();

    match func.to_uppercase().as_str() {
        "SUM" => {
            let sum: f64 = values.iter().sum();
            let display = if sum.abs() < 0.00001 { 0.0 } else { sum };
            format!("{:.2}", display)
        }
        "COUNT" => items.len().to_string(),
        "AVG" => {
            if values.is_empty() {
                return "0".to_string();
            }
            format!("{:.2}", values.iter().sum::<f64>() / values.len() as f64)
        }
        "MIN" => values.iter().cloned().fold(f64::INFINITY, f64::min).to_string(),
        "MAX" => values.iter().cloned().fold(f64::NEG_INFINITY, f64::max).to_string(),
        _ => "0".to_string(),
    }
}

pub fn resolve_binding_with_aggregates(
    expr: &str,
    local: &Value,
    global: &Value,
    items: &[Value],
) -> String {
    if !expr.contains("{{") {
        return expr.to_string();
    }

    let mut result = String::new();
    let mut remaining = expr;

    while let Some(open) = remaining.find("{{") {
        result.push_str(&remaining[..open]);
        let after_open = &remaining[open + 2..];

        if let Some(close) = after_open.find("}}") {
            let full_inner = after_open[..close].trim();

            let mut pipe_parts = full_inner.split('|');
            let inner = pipe_parts.next().unwrap_or("").trim();
            let pipes: Vec<&str> = pipe_parts.collect();

            let mut resolved = if let Some(paren_pos) = inner.find('(') {
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
                let val_opt = resolve_path(inner, local).or_else(|| resolve_path(inner, global));
                match val_opt {
                    Some(v) => match v {
                        Value::String(s) => s.clone(),
                        _ => v.to_string(),
                    },
                    None => {
                        if !inner.is_empty()
                            && inner.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-')
                        {
                            inner.to_string()
                        } else {
                            format!("{{{{{}}}}}", inner)
                        }
                    }
                }
            };

            for pipe in pipes {
                resolved = apply_pipe(resolved, pipe);
            }

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

pub fn is_visible(base: &BaseComponent, local: &Value, global: &Value) -> bool {
    match &base.visible {
        None => true,
        Some(expr) => {
            let resolved = resolve_binding_scoped(expr, local, global);
            !matches!(resolved.to_lowercase().trim(), "false" | "0" | "")
        }
    }
}
