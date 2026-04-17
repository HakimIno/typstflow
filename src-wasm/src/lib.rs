use std::collections::HashMap;
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

/// Shared image registry — maps virtual path (e.g. "img-abc.png") → raw bytes
type ImageRegistry = Arc<RwLock<HashMap<String, Bytes>>>;

#[wasm_bindgen]
pub struct TypstBridge {
    library: LazyHash<Library>,
    font_book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    images: ImageRegistry,
    /// Native Typst packages embedded in the binary
    packages: HashMap<String, String>,
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
        web_sys::console::log_1(&"✅ Typst WASM Engine v0.14.2 Loaded (Image Registry + Native Packages)".into());

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
        }
    }

    /// Register raw image bytes under a virtual filename.
    /// Call this before rendering when source uses #image("virtual-name.png").
    pub fn register_image(&self, virtual_path: &str, data: &[u8]) {
        let bytes = Bytes::new(data.to_vec());
        if let Ok(mut map) = self.images.write() {
            map.insert(virtual_path.to_string(), bytes);
        }
    }

    /// Clear all registered images (call between renders if needed).
    pub fn clear_images(&self) {
        if let Ok(mut map) = self.images.write() {
            map.clear();
        }
    }

    pub fn render_svg(&self, source_code: &str) -> Result<String, JsValue> {
        let world = WasmWorld::new(source_code, self);
        let output = typst::compile(&world).output;
        let doc: typst::layout::PagedDocument = output
            .map_err(|err| JsValue::from_str(&format!("Compilation failed: {:?}", err)))?;
        
        if let Some(page) = doc.pages.first() {
            let svg = typst_svg::svg(page);
            Ok(svg)
        } else {
            Err(JsValue::from_str("No pages rendered"))
        }
    }

    pub fn render_pdf(&self, source_code: &str) -> Result<Vec<u8>, JsValue> {
        let world = WasmWorld::new(source_code, self);
        let output = typst::compile(&world).output;
        let doc: typst::layout::PagedDocument = output
            .map_err(|err| JsValue::from_str(&format!("Compilation failed: {:?}", err)))?;
        
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
        let text = std::str::from_utf8(&bytes)
            .map_err(|_| FileError::InvalidUtf8)?;
        Ok(Source::new(id, text.to_string()))
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        // Construct the effective path for internal lookup
        let path_str = if let Some(pkg) = id.package() {
            // Standard Typst package path format: @namespace/name:version/path
            format!("{}/{}", pkg, id.vpath().as_rootless_path().to_string_lossy())
        } else {
            // Standard rootless path for images and main source
            id.vpath().as_rootless_path().to_string_lossy().to_string()
        };

        // Debug logging in WASM console
        web_sys::console::log_1(&format!("🔍 Requesting file: {} (ID: {:?})", path_str, id).into());

        // 1. Look up image by virtual path name in the registry
        if let Ok(map) = self.bridge.images.read() {
            if let Some(bytes) = map.get(&path_str) {
                return Ok(bytes.clone());
            }
        }

        // 2. Look up embedded Typst packages (e.g. @preview/codetastic:0.2.2/...)
        if let Some(content) = self.bridge.packages.get(&path_str) {
            return Ok(Bytes::new(content.as_bytes().to_vec()));
        }

        Err(FileError::NotFound(id.vpath().as_rootless_path().to_path_buf()))
    }

    fn font(&self, id: usize) -> Option<Font> {
        self.bridge.fonts.get(id).cloned()
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        Some(Datetime::from_ymd(2024, 1, 1).unwrap())
    }
}
