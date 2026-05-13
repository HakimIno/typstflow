use wasm_bindgen::prelude::*;

pub fn parse_csv_bytes(data: &[u8]) -> Result<String, JsValue> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .trim(csv::Trim::All)
        .from_reader(data);

    let headers = reader
        .headers()
        .map_err(|e| JsValue::from_str(&format!("CSV header error: {}", e)))?
        .clone();

    let mut results = Vec::new();
    for result in reader.records() {
        let record =
            result.map_err(|e| JsValue::from_str(&format!("CSV record error: {}", e)))?;
        let mut map = serde_json::Map::new();
        for (header, field) in headers.iter().zip(record.iter()) {
            let value = if field.is_empty() {
                serde_json::Value::Null
            } else if let Ok(n) = field.parse::<f64>() {
                if let Some(num) = serde_json::Number::from_f64(n) {
                    serde_json::Value::Number(num)
                } else {
                    serde_json::Value::String(field.to_string())
                }
            } else if let Ok(b) = field.parse::<bool>() {
                serde_json::Value::Bool(b)
            } else {
                serde_json::Value::String(field.to_string())
            };
            map.insert(header.to_string(), value);
        }
        results.push(serde_json::Value::Object(map));
    }

    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("JSON serialization error: {}", e)))
}

pub fn parse_xlsx_bytes(data: &[u8]) -> Result<String, JsValue> {
    use calamine::{open_workbook_auto_from_rs, Data, Reader};
    use std::io::Cursor;

    let mut workbook = open_workbook_auto_from_rs(Cursor::new(data))
        .map_err(|e| JsValue::from_str(&format!("Excel open error: {}", e)))?;

    let sheet_name = workbook
        .sheet_names()
        .get(0)
        .ok_or_else(|| JsValue::from_str("No sheets found in workbook"))?
        .clone();

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| JsValue::from_str(&format!("Worksheet range error: {}", e)))?;

    let mut results = Vec::new();
    let mut rows = range.rows();

    let headers: Vec<String> = if let Some(first_row) = rows.next() {
        first_row.iter().map(|c| c.to_string()).collect()
    } else {
        return Ok("[]".to_string());
    };

    for row in rows {
        let mut map = serde_json::Map::new();
        for (header, cell) in headers.iter().zip(row.iter()) {
            let value = match cell {
                Data::String(s) => serde_json::Value::String(s.clone()),
                Data::Float(f) => {
                    if let Some(num) = serde_json::Number::from_f64(*f) {
                        serde_json::Value::Number(num)
                    } else {
                        serde_json::Value::String(f.to_string())
                    }
                }
                Data::Int(i) => serde_json::Value::Number(serde_json::Number::from(*i)),
                Data::Bool(b) => serde_json::Value::Bool(*b),
                Data::Empty => serde_json::Value::Null,
                _ => serde_json::Value::String(cell.to_string()),
            };
            map.insert(header.to_string(), value);
        }
        results.push(serde_json::Value::Object(map));
    }

    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("JSON serialization error: {}", e)))
}
