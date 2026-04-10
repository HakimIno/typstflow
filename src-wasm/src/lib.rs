use comemo::Prehashed;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source};
use typst::text::{Font, FontBook};
use typst::Library;
use typst::World;
use wasm_bindgen::prelude::*;

mod schema;
mod generator;

#[wasm_bindgen]
pub struct TypstBridge {
    library: Prehashed<Library>,
    font_book: Prehashed<FontBook>,
    fonts: Vec<Font>,
}

#[wasm_bindgen]
impl TypstBridge {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut fonts = Vec::new();

        // Helper to load fonts safely
        let mut load_font = |data: &'static [u8]| {
            let bytes = Bytes::from_static(data);
            for i in 0.. {
                if let Some(font) = Font::new(bytes.clone(), i) {
                    fonts.push(font);
                } else {
                    break;
                }
            }
        };

        // Embed Sarabun
        load_font(include_bytes!("../fonts/Sarabun-Regular.ttf"));
        load_font(include_bytes!("../fonts/Sarabun-Bold.ttf"));
        
        // Embed Geist
        load_font(include_bytes!("../fonts/Geist-Regular.ttf"));
        load_font(include_bytes!("../fonts/Geist-Bold.ttf"));

        let font_book = FontBook::from_fonts(&fonts);
        let library = Library::default();

        Self {
            library: Prehashed::new(library),
            font_book: Prehashed::new(font_book),
            fonts,
        }
    }

    pub fn render_svg(&self, source_code: &str) -> Result<String, JsValue> {
        let mut tracer = typst::eval::Tracer::new();
        let world = WasmWorld::new(source_code, self);
        let doc = typst::compile(&world, &mut tracer)
            .map_err(|err| JsValue::from_str(&format!("Compilation failed: {:?}", err)))?;
        
        if let Some(page) = doc.pages.first() {
            let svg = typst_svg::svg(&page.frame);
            Ok(svg)
        } else {
            Err(JsValue::from_str("No pages rendered"))
        }
    }

    pub fn render_pdf(&self, source_code: &str) -> Result<Vec<u8>, JsValue> {
        let mut tracer = typst::eval::Tracer::new();
        let world = WasmWorld::new(source_code, self);
        let doc = typst::compile(&world, &mut tracer)
            .map_err(|err| JsValue::from_str(&format!("Compilation failed: {:?}", err)))?;
        
        let pdf = typst_pdf::pdf(&doc, typst::foundations::Smart::Auto, None);
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
}

struct WasmWorld<'a> {
    source: Source,
    bridge: &'a TypstBridge,
}

impl<'a> WasmWorld<'a> {
    fn new(source_code: &str, bridge: &'a TypstBridge) -> Self {
        Self {
            source: Source::detached(source_code),
            bridge,
        }
    }
}

impl World for WasmWorld<'_> {
    fn library(&self) -> &Prehashed<Library> {
        &self.bridge.library
    }

    fn book(&self) -> &Prehashed<FontBook> {
        &self.bridge.font_book
    }

    fn main(&self) -> Source {
        self.source.clone()
    }

    fn source(&self, _id: FileId) -> FileResult<Source> {
        Ok(self.source.clone())
    }

    fn file(&self, _id: FileId) -> FileResult<Bytes> {
        Err(FileError::NotFound(_id.vpath().as_rootless_path().to_path_buf()))
    }

    fn font(&self, id: usize) -> Option<Font> {
        self.bridge.fonts.get(id).cloned()
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        Some(Datetime::from_ymd(2024, 1, 1).unwrap())
    }
}
