use std::path::PathBuf;
use std::sync::atomic::Ordering;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::Library;
use typst::World;

use crate::TypstBridge;

/// The interned `FileId` for the entrypoint `main.typ` in the project root.
fn main_file_id() -> FileId {
    FileId::new(RootedPath::new(
        VirtualRoot::Project,
        VirtualPath::new("main.typ").expect("main.typ is a valid virtual path"),
    ))
}

pub(crate) struct WasmWorld<'a> {
    source: Source,
    pub(crate) bridge: &'a TypstBridge,
}

impl<'a> WasmWorld<'a> {
    pub(crate) fn new(source_code: &str, bridge: &'a TypstBridge) -> Self {
        Self {
            source: Source::new(main_file_id(), source_code.to_string()),
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
        main_file_id()
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
        let vpath = id.vpath().get_without_slash();
        let path_str = match id.root() {
            VirtualRoot::Package(pkg) => format!("{}/{}", pkg, vpath),
            VirtualRoot::Project => vpath.to_string(),
        };

        if let Ok(map) = self.bridge.images.read() {
            if let Some(bytes) = map.get(&path_str) {
                return Ok(bytes.clone());
            }
        }

        if let Some(content) = self.bridge.packages.get(&path_str) {
            return Ok(Bytes::new(content.as_bytes().to_vec()));
        }

        Err(FileError::NotFound(PathBuf::from(vpath)))
    }

    fn font(&self, id: usize) -> Option<Font> {
        self.bridge.fonts.get(id).cloned()
    }

    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        let year = self.bridge.today_year.load(Ordering::Relaxed);
        if year > 0 {
            Datetime::from_ymd(
                year,
                self.bridge.today_month.load(Ordering::Relaxed),
                self.bridge.today_day.load(Ordering::Relaxed),
            )
        } else {
            let js_now = js_sys::Date::new_0();
            let y = js_now.get_full_year() as i32;
            let m = (js_now.get_month() + 1) as u8;
            let d = js_now.get_date() as u8;
            Datetime::from_ymd(y, m, d)
        }
    }
}
