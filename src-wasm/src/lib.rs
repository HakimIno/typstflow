use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, AtomicU8, Ordering};
use std::sync::{Arc, RwLock};
use typst::foundations::Bytes;
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::Library;
use typst::LibraryExt;
use wasm_bindgen::prelude::*;

mod parsers;
mod world;
pub mod image_processing;
pub mod layout_engine;
pub mod table_engine;
pub mod zone_layout;

use world::WasmWorld;

type ImageRegistry = Arc<RwLock<HashMap<String, Bytes>>>;

#[wasm_bindgen]
pub struct TypstBridge {
    pub(crate) library: LazyHash<Library>,
    pub(crate) font_book: LazyHash<FontBook>,
    pub(crate) fonts: Vec<Font>,
    pub(crate) images: ImageRegistry,
    pub(crate) packages: HashMap<String, String>,
    pub(crate) today_year: AtomicI32,
    pub(crate) today_month: AtomicU8,
    pub(crate) today_day: AtomicU8,
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

        for (name, content) in [
            ("typst.toml",    include_str!("../typst-packages/codetastic/0.2.2/typst.toml")),
            ("codetastic.typ", include_str!("../typst-packages/codetastic/0.2.2/codetastic.typ")),
            ("bitfield.typ",  include_str!("../typst-packages/codetastic/0.2.2/bitfield.typ")),
            ("bits.typ",      include_str!("../typst-packages/codetastic/0.2.2/bits.typ")),
            ("checksum.typ",  include_str!("../typst-packages/codetastic/0.2.2/checksum.typ")),
            ("ecc.typ",       include_str!("../typst-packages/codetastic/0.2.2/ecc.typ")),
            ("qrluts.typ",    include_str!("../typst-packages/codetastic/0.2.2/qrluts.typ")),
            ("qrutil.typ",    include_str!("../typst-packages/codetastic/0.2.2/qrutil.typ")),
            ("util.typ",      include_str!("../typst-packages/codetastic/0.2.2/util.typ")),
        ] {
            packages.insert(format!("@preview/codetastic:0.2.2/{}", name), content.to_string());
        }

        for (name, content) in [
            ("typst.toml", include_str!("../typst-packages/cheq/0.2.2/typst.toml")),
            ("lib.typ",    include_str!("../typst-packages/cheq/0.2.2/lib.typ")),
        ] {
            packages.insert(format!("@preview/cheq:0.2.2/{}", name), content.to_string());
        }

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

    /// Set the current date so `datetime.today()` returns the correct value.
    /// Call from JS before each render: `bridge.set_today(year, month, day)`.
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
        let mut families: Vec<String> = self
            .fonts
            .iter()
            .map(|f| f.info().family.to_string())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        families.sort();
        let array = js_sys::Array::new();
        for name in &families {
            array.push(&JsValue::from_str(name));
        }
        array.into()
    }

    pub fn render_svg(&self, source_code: &str) -> Result<String, JsValue> {
        let world = WasmWorld::new(source_code, self);
        let doc: typst::layout::PagedDocument =
            typst::compile(&world).output.map_err(|err| {
                web_sys::console::error_1(
                    &format!("❌ Typst Compilation Failed:\n{}", source_code).into(),
                );
                JsValue::from_str(&format!("Compilation failed: {:?}", err))
            })?;

        let mut all_svgs = String::new();
        for page in &doc.pages {
            all_svgs.push_str(&typst_svg::svg(page));
            all_svgs.push_str("<!-- PAGE_BREAK -->");
        }
        Ok(all_svgs)
    }

    pub fn render_pdf(&self, source_code: &str, pdf_standard: Option<String>) -> Result<Vec<u8>, JsValue> {
        let world = WasmWorld::new(source_code, self);
        let doc: typst::layout::PagedDocument =
            typst::compile(&world).output.map_err(|err| {
                web_sys::console::error_1(
                    &format!("❌ Typst Compilation Failed:\n{}", source_code).into(),
                );
                JsValue::from_str(&format!("Compilation failed: {:?}", err))
            })?;

        let mut options = typst_pdf::PdfOptions::default();
        if let Some(ref std_str) = pdf_standard {
            let std_str_lower = std_str.to_lowercase();
            if std_str_lower == "a-3b" || std_str_lower == "pdf-a-3b" {
                if let Ok(stds) = typst_pdf::PdfStandards::new(&[typst_pdf::PdfStandard::A_3b]) {
                    options.standards = stds;
                }
            } else if std_str_lower == "a-3u" || std_str_lower == "pdf-a-3u" {
                if let Ok(stds) = typst_pdf::PdfStandards::new(&[typst_pdf::PdfStandard::A_3u]) {
                    options.standards = stds;
                }
            } else if std_str_lower == "a-3a" || std_str_lower == "pdf-a-3a" {
                if let Ok(stds) = typst_pdf::PdfStandards::new(&[typst_pdf::PdfStandard::A_3a]) {
                    options.standards = stds;
                }
            }
        }

        typst_pdf::pdf(&doc, &options)
            .map_err(|err| JsValue::from_str(&format!("PDF generation failed: {:?}", err)))
    }

    /// Remove background from image bytes using flood-fill from the 4 corners.
    /// `tolerance` controls how similar a pixel must be to the background colour (0–255).
    /// Returns PNG bytes with the background made transparent.
    pub fn remove_background(&self, data: &[u8], tolerance: u8) -> Result<Vec<u8>, JsValue> {
        image_processing::remove_background_impl(data, tolerance)
            .map_err(|e| JsValue::from_str(&e))
    }


    pub fn parse_csv(&self, csv_data: &str) -> Result<String, JsValue> {
        parsers::parse_csv_bytes(csv_data.as_bytes())
    }

    pub fn parse_csv_bytes(&self, data: &[u8]) -> Result<String, JsValue> {
        parsers::parse_csv_bytes(data)
    }

    pub fn parse_xlsx(&self, data: &[u8]) -> Result<String, JsValue> {
        parsers::parse_xlsx_bytes(data)
    }
}
