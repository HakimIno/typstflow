pub mod store;
pub mod types;

use store::SchemaStoreInner;
use types::LayoutSchemaDoc;
use wasm_bindgen::prelude::*;

const MSGPACK_MAGIC: &[u8; 4] = b"TFMP";

#[wasm_bindgen]
pub struct SchemaStore {
    inner: SchemaStoreInner,
}

#[wasm_bindgen]
impl SchemaStore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: SchemaStoreInner::new(),
        }
    }

    pub fn load_from_json(&mut self, json: &str) -> Result<(), JsValue> {
        let doc = LayoutSchemaDoc::from_json(json)
            .map_err(|e| JsValue::from_str(&format!("schema parse error: {e}")))?;
        self.inner.load_initial(doc);
        Ok(())
    }

    pub fn push_from_json(&mut self, json: &str) -> Result<(), JsValue> {
        let doc = LayoutSchemaDoc::from_json(json)
            .map_err(|e| JsValue::from_str(&format!("schema parse error: {e}")))?;
        self.inner.push(doc);
        Ok(())
    }

    pub fn current_to_json(&self) -> Result<String, JsValue> {
        let current = self
            .inner
            .current()
            .ok_or_else(|| JsValue::from_str("schema store is empty"))?;
        current
            .to_json()
            .map_err(|e| JsValue::from_str(&format!("schema serialize error: {e}")))
    }

    pub fn undo(&mut self) -> Result<Option<String>, JsValue> {
        match self.inner.undo() {
            Some(doc) => doc
                .to_json()
                .map(Some)
                .map_err(|e| JsValue::from_str(&format!("schema serialize error: {e}"))),
            None => Ok(None),
        }
    }

    pub fn redo(&mut self) -> Result<Option<String>, JsValue> {
        match self.inner.redo() {
            Some(doc) => doc
                .to_json()
                .map(Some)
                .map_err(|e| JsValue::from_str(&format!("schema serialize error: {e}"))),
            None => Ok(None),
        }
    }

    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    pub fn history_len(&self) -> usize {
        self.inner.history_len()
    }

    pub fn history_index(&self) -> usize {
        self.inner.history_index()
    }

    pub fn goto_index(&mut self, index: usize) -> Result<Option<String>, JsValue> {
        match self.inner.goto_index(index) {
            Some(doc) => doc
                .to_json()
                .map(Some)
                .map_err(|e| JsValue::from_str(&format!("schema serialize error: {e}"))),
            None => Ok(None),
        }
    }
}

/// Encode arbitrary JSON state to MessagePack with TypstFlow magic header.
#[wasm_bindgen]
pub fn msgpack_encode_json(json: &str) -> Result<Vec<u8>, JsValue> {
    let value: serde_json::Value = serde_json::from_str(json)
        .map_err(|e| JsValue::from_str(&format!("json parse error: {e}")))?;
    let mut bytes = MSGPACK_MAGIC.to_vec();
    rmp_serde::to_vec(&value)
        .map(|payload| {
            bytes.extend(payload);
            bytes
        })
        .map_err(|e| JsValue::from_str(&format!("msgpack encode error: {e}")))
}

/// Decode MessagePack (with optional TFMP header) back to JSON string.
#[wasm_bindgen]
pub fn msgpack_decode_to_json(bytes: &[u8]) -> Result<String, JsValue> {
    let payload = if bytes.len() >= 4 && &bytes[..4] == MSGPACK_MAGIC {
        &bytes[4..]
    } else {
        bytes
    };

    let value: serde_json::Value = rmp_serde::from_slice(payload)
        .map_err(|e| JsValue::from_str(&format!("msgpack decode error: {e}")))?;
    serde_json::to_string(&value).map_err(|e| JsValue::from_str(&format!("json serialize error: {e}")))
}
