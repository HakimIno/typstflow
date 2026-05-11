use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, AtomicU8, Ordering};
use std::sync::{Arc, RwLock};
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source, VirtualPath};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::Library;
use typst::LibraryExt;
use typst::World;
use wasm_bindgen::prelude::*;

mod schema;
mod generator;
pub mod layout_engine;
pub mod table_engine;

/// Shared image registry — maps virtual path (e.g. "asset-abc.png") → raw bytes
type ImageRegistry = Arc<RwLock<HashMap<String, Bytes>>>;

#[wasm_bindgen]
pub struct TypstBridge {
    library: LazyHash<Library>,
    font_book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    images: ImageRegistry,
    packages: HashMap<String, String>,
    /// Current date injected from JS — (year, month, day). 0 = not set.
    today_year: AtomicI32,
    today_month: AtomicU8,
    today_day: AtomicU8,
}

#[wasm_bindgen]
impl TypstBridge {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut fonts = Vec::new();

        let mut load_font = |data: &'static [u8]| {
            let bytes = Bytes::new(data);
            for i in 0.. {
                if let Some(font) = Font::new(bytes.clone(), i) {
                    fonts.push(font);
                } else {
                    break;
                }
            }
        };

        load_font(include_bytes!("../fonts/Sarabun-Regular.ttf"));
        load_font(include_bytes!("../fonts/Sarabun-Bold.ttf"));
        load_font(include_bytes!("../fonts/Geist-Regular.ttf"));
        load_font(include_bytes!("../fonts/Geist-Bold.ttf"));

        let font_book = FontBook::from_fonts(&fonts);
        let library = typst::Library::builder().build();
        web_sys::console::log_1(&"✅ Typst WASM Engine v0.14.2 Loaded".into());

        let mut packages = HashMap::new();
        let pkg_prefix = "@preview/codetastic:0.2.2/";
        packages.insert(format!("{}typst.toml", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/typst.toml").to_string());
        packages.insert(format!("{}codetastic.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/codetastic.typ").to_string());
        packages.insert(format!("{}bitfield.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/bitfield.typ").to_string());
        packages.insert(format!("{}bits.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/bits.typ").to_string());
        packages.insert(format!("{}checksum.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/checksum.typ").to_string());
        packages.insert(format!("{}ecc.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/ecc.typ").to_string());
        packages.insert(format!("{}qrluts.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/qrluts.typ").to_string());
        packages.insert(format!("{}qrutil.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/qrutil.typ").to_string());
        packages.insert(format!("{}util.typ", pkg_prefix), include_str!("../typst-packages/codetastic/0.2.2/util.typ").to_string());

        Self {
            library: LazyHash::new(library),
            font_book: LazyHash::new(font_book),
            fonts,
            images: Arc::new(RwLock::new(HashMap::new())),
            packages,
            today_year: AtomicI32::new(0),
            today_month: AtomicU8::new(1),
            today_day: AtomicU8::new(1),
        }
    }

    /// Set the current date so datetime.today() returns the correct value.
    /// Call this from JS before each render: bridge.set_today(year, month, day).
    pub fn set_today(&self, year: i32, month: u8, day: u8) {
        self.today_year.store(year, Ordering::Relaxed);
        self.today_month.store(month, Ordering::Relaxed);
        self.today_day.store(day, Ordering::Relaxed);
    }

    pub fn register_image(&self, virtual_path: &str, data: &[u8]) {
        let bytes = Bytes::new(data.to_vec());
        if let Ok(mut map) = self.images.write() {
            map.insert(virtual_path.to_string(), bytes);
        }
    }

    pub fn clear_images(&self) {
        if let Ok(mut map) = self.images.write() {
            map.clear();
        }
    }

    
    /// Register a font at runtime. Accepts raw TTF/OTF bytes.
    /// Returns true if at least one font face was loaded successfully.
    /// Requires &mut self — safe in single-threaded WASM context.
    pub fn register_font(&mut self, data: Vec<u8>) -> bool {
        let bytes = Bytes::new(data);
        let mut count = 0usize;
        for i in 0.. {
            if let Some(font) = Font::new(bytes.clone(), i) {
                self.fonts.push(font);
                count += 1;
            } else {
                break;
            }
        }
        if count > 0 {
            self.font_book = LazyHash::new(FontBook::from_fonts(&self.fonts));
            web_sys::console::log_1(&format!("✅ Font registered: {} face(s)", count).into());
            true
        } else {
            web_sys::console::warn_1(&"⚠️ register_font: no valid font faces in data".into());
            false
        }
    }

    /// Return sorted list of available font family names as a JS Array of strings.
    pub fn get_font_names(&self) -> JsValue {
        use std::collections::HashSet;
        let families: HashSet<String> = self.fonts.iter()
            .map(|f| f.info().family.to_string())
            .collect();
        let mut sorted: Vec<String> = families.into_iter().collect();
        sorted.sort();
        let array = js_sys::Array::new();
        for name in &sorted {
            array.push(&JsValue::from_str(name));
        }
        array.into()
    }

    pub fn render_svg(&self, source_code: &str) -> Result<String, JsValue> {
        let world = WasmWorld::new(source_code, self);
        let output = typst::compile(&world).output;
        let doc: typst::layout::PagedDocument = output.map_err(|err| {
            web_sys::console::error_1(&format!("❌ Typst Compilation Failed:\n{}", source_code).into());
            JsValue::from_str(&format!("Compilation failed: {:?}", err))
        })?;

        let mut all_svgs = String::new();
        for page in &doc.pages {
            all_svgs.push_str(&typst_svg::svg(page));
            all_svgs.push_str("<!-- PAGE_BREAK -->");
        }
        Ok(all_svgs)
    }

    pub fn render_pdf(&self, source_code: &str) -> Result<Vec<u8>, JsValue> {
        let world = WasmWorld::new(source_code, self);
        let output = typst::compile(&world).output;
        let doc: typst::layout::PagedDocument = output.map_err(|err| {
            web_sys::console::error_1(&format!("❌ Typst Compilation Failed:\n{}", source_code).into());
            JsValue::from_str(&format!("Compilation failed: {:?}", err))
        })?;

        let pdf = typst_pdf::pdf(&doc, &Default::default())
            .map_err(|err| JsValue::from_str(&format!("PDF generation failed: {:?}", err)))?;
        Ok(pdf)
    }

    pub fn render_report_svg(&self, schema_json: &str, data_json: &str) -> Result<String, JsValue> {
        let schema: schema::LayoutSchema = serde_json::from_str(schema_json)
            .map_err(|e| JsValue::from_str(&format!("Schema parse error: {} (line {}, col {})", e, e.line(), e.column())))?;
        let data: serde_json::Value = serde_json::from_str(data_json)
            .map_err(|e| JsValue::from_str(&format!("Data parse error: {} (line {}, col {})", e, e.line(), e.column())))?;

        let source_code = generator::generate_typst(&schema, &data);
        self.render_svg(&source_code)
    }

    pub fn render_report_pdf(&self, schema_json: &str, data_json: &str) -> Result<Vec<u8>, JsValue> {
        let schema: schema::LayoutSchema = serde_json::from_str(schema_json)
            .map_err(|e| JsValue::from_str(&format!("Schema parse error: {} (line {}, col {})", e, e.line(), e.column())))?;
        let data: serde_json::Value = serde_json::from_str(data_json)
            .map_err(|e| JsValue::from_str(&format!("Data parse error: {} (line {}, col {})", e, e.line(), e.column())))?;

        let source_code = generator::generate_typst(&schema, &data);
        self.render_pdf(&source_code)
    }

    pub fn generate_report_typst(&self, schema_json: &str, data_json: &str) -> Result<String, JsValue> {
        let schema: schema::LayoutSchema = serde_json::from_str(schema_json)
            .map_err(|e| JsValue::from_str(&format!("Schema parse error: {} (line {}, col {})", e, e.line(), e.column())))?;
        let data: serde_json::Value = serde_json::from_str(data_json)
            .map_err(|e| JsValue::from_str(&format!("Data parse error: {} (line {}, col {})", e, e.line(), e.column())))?;

        Ok(generator::generate_typst(&schema, &data))
    }

    /// Parse CSV string into JSON array of objects.
    /// High-performance parsing using Rust's csv crate with smart type inference.
    pub fn parse_csv(&self, csv_data: &str) -> Result<String, JsValue> {
        self.parse_csv_bytes(csv_data.as_bytes())
    }

    /// Parse CSV bytes into JSON array of objects.
    pub fn parse_csv_bytes(&self, data: &[u8]) -> Result<String, JsValue> {
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(true)
            .trim(csv::Trim::All)
            .from_reader(data);

        let headers = reader.headers()
            .map_err(|e| JsValue::from_str(&format!("CSV header error: {}", e)))?
            .clone();

        let mut results = Vec::new();
        for result in reader.records() {
            let record = result.map_err(|e| JsValue::from_str(&format!("CSV record error: {}", e)))?;
            let mut map = serde_json::Map::new();
            for (header, field) in headers.iter().zip(record.iter()) {
                // Try to parse as number or boolean, otherwise keep as string
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

    /// Parse Excel bytes (XLSX, XLS, ODS, XLSB) into JSON array of objects from the first sheet.
    /// Uses high-performance calamine reader.
    pub fn parse_xlsx(&self, data: &[u8]) -> Result<String, JsValue> {
        use calamine::{Reader, open_workbook_auto_from_rs, Data};
        use std::io::Cursor;

        let mut workbook = open_workbook_auto_from_rs(Cursor::new(data))
            .map_err(|e| JsValue::from_str(&format!("Excel open error: {}", e)))?;

        // Get the first sheet name
        let sheet_name = workbook.sheet_names()
            .get(0)
            .ok_or_else(|| JsValue::from_str("No sheets found in workbook"))?
            .clone();

        let range = workbook.worksheet_range(&sheet_name)
            .map_err(|e| JsValue::from_str(&format!("Worksheet range error: {}", e)))?;

        let mut results = Vec::new();
        let mut rows = range.rows();
        
        // Get headers from first row
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
                    },
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
}

struct WasmWorld<'a> {
    source: Source,
    bridge: &'a TypstBridge,
}

impl<'a> WasmWorld<'a> {
    fn new(source_code: &str, bridge: &'a TypstBridge) -> Self {
        Self {
            source: Source::new(FileId::new(None, VirtualPath::new("main.typ")), source_code.to_string()),
            bridge,
        }
    }
}

impl World for WasmWorld<'_> {
    fn library(&self) -> &LazyHash<Library> {
        &self.bridge.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.bridge.font_book
    }

    fn main(&self) -> FileId {
        FileId::new(None, VirtualPath::new("main.typ"))
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main() {
            return Ok(self.source.clone());
        }
        let bytes = self.file(id)?;
        let text = std::str::from_utf8(&bytes).map_err(|_| FileError::InvalidUtf8)?;
        Ok(Source::new(id, text.to_string()))
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        let path_str = if let Some(pkg) = id.package() {
            format!("{}/{}", pkg, id.vpath().as_rootless_path().to_string_lossy())
        } else {
            id.vpath().as_rootless_path().to_string_lossy().to_string()
        };

        if let Ok(map) = self.bridge.images.read() {
            if let Some(bytes) = map.get(&path_str) {
                return Ok(bytes.clone());
            }
        }

        if let Some(content) = self.bridge.packages.get(&path_str) {
            return Ok(Bytes::new(content.as_bytes().to_vec()));
        }

        Err(FileError::NotFound(id.vpath().as_rootless_path().to_path_buf()))
    }

    fn font(&self, id: usize) -> Option<Font> {
        self.bridge.fonts.get(id).cloned()
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        let year = self.bridge.today_year.load(Ordering::Relaxed);
        if year > 0 {
            Datetime::from_ymd(year, self.bridge.today_month.load(Ordering::Relaxed), self.bridge.today_day.load(Ordering::Relaxed))
        } else {
            // Fallback: read from JS Date if not explicitly set
            let js_now = js_sys::Date::new_0();
            let y = js_now.get_full_year() as i32;
            let m = (js_now.get_month() + 1) as u8;
            let d = js_now.get_date() as u8;
            Datetime::from_ymd(y, m, d)
        }
    }
}
