/// Escape characters that have special meaning in Typst markup.
/// Canonical set — matches the TS typst-utils.ts escaper.
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
    if c.is_empty() {
        return "none".to_string();
    }
    if c.starts_with('#') {
        format!("rgb(\"{}\")", c)
    } else {
        c.to_string()
    }
}

/// Format a font weight value for Typst emission.
/// Named weights are quoted ("bold"); numeric strings are unquoted (700).
/// CSS "normal" is mapped to Typst "regular" since Typst doesn't recognise "normal".
pub fn format_weight(weight: &str) -> String {
    let w = if weight == "normal" { "regular" } else { weight };
    // If the value is a pure integer string, emit it unquoted (e.g. 700 not "700")
    if w.parse::<u32>().is_ok() {
        w.to_string()
    } else {
        format!("\"{}\"", w)
    }
}

pub fn apply_number_format(val: &str, decimals: usize) -> String {
    let n = val.replace(",", "").parse::<f64>().unwrap_or(0.0);
    let s = format!("{:.1$}", n, decimals);
    let parts: Vec<&str> = s.split('.').collect();
    let integer_part = parts[0];

    let mut formatted = String::new();
    let mut count = 0;
    let is_negative = integer_part.starts_with('-');
    let abs_part = if is_negative { &integer_part[1..] } else { integer_part };

    for c in abs_part.chars().rev() {
        if count > 0 && count % 3 == 0 {
            formatted.push(',');
        }
        formatted.push(c);
        count += 1;
    }
    if is_negative {
        formatted.push('-');
    }

    let result = formatted.chars().rev().collect::<String>();
    if parts.len() > 1 {
        format!("{}.{}", result, parts[1])
    } else {
        result
    }
}

pub fn apply_currency_format(val: &str, symbol: &str, decimals: usize) -> String {
    format!("{}{}", symbol, apply_number_format(val, decimals))
}

pub fn apply_date_format(val: &str, format_str: &str) -> String {
    let clean = val.trim();
    if clean.len() < 10 {
        return val.to_string();
    }
    format_str
        .replace("YYYY", &clean[0..4])
        .replace("MM", &clean[5..7])
        .replace("DD", &clean[8..10])
}

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

pub fn apply_pipe(value: String, pipe_str: &str) -> String {
    let pipe_str = pipe_str.trim();
    if pipe_str.is_empty() {
        return value;
    }

    if let Some(open) = pipe_str.find('(') {
        let name = pipe_str[..open].trim().to_lowercase();
        let args_str = &pipe_str[open + 1..];
        if let Some(close) = args_str.rfind(')') {
            let args: Vec<&str> = args_str[..close]
                .split(',')
                .map(|s| s.trim().trim_matches('\'').trim_matches('\"'))
                .collect();

            return match name.as_str() {
                "number" => {
                    let decimals = args.first().and_then(|s| s.parse().ok()).unwrap_or(2);
                    apply_number_format(&value, decimals)
                }
                "currency" => {
                    let symbol = args.first().copied().unwrap_or("$");
                    let decimals = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(2);
                    apply_currency_format(&value, symbol, decimals)
                }
                "date" => {
                    let format = args.first().copied().unwrap_or("YYYY-MM-DD");
                    apply_date_format(&value, format)
                }
                _ => value,
            };
        }
    } else {
        return match pipe_str.to_lowercase().as_str() {
            "upper" | "uppercase" => value.to_uppercase(),
            "lower" | "lowercase" => value.to_lowercase(),
            "capitalize" => {
                let mut chars = value.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            }
            _ => value,
        };
    }
    value
}
