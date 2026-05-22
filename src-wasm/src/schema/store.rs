use super::types::{LayoutSchemaDoc, PageDefinition, Zone, Zones};
use im::Vector;

const MAX_HISTORY_DEFAULT: usize = 50;

pub fn max_history_for(doc: &LayoutSchemaDoc) -> usize {
    let page_count = doc.pages.len();
    if page_count > 500 {
        return 5;
    }
    if page_count > 200 {
        return 10;
    }
    if page_count > 100 {
        return 15;
    }

    let component_count: usize = doc.zones.header.components.len()
        + doc.zones.footer.components.len()
        + doc.pages.iter().map(|p| p.body.components.len()).sum::<usize>()
        + doc
            .groups
            .iter()
            .map(|g| g.header.components.len() + g.footer.components.len())
            .sum::<usize>();

    if component_count > 500 {
        10
    } else if component_count > 200 {
        20
    } else if component_count > 100 {
        30
    } else {
        MAX_HISTORY_DEFAULT
    }
}

fn zones_equal(a: &Zones, b: &Zones) -> bool {
    zone_equal(&a.header, &b.header) && zone_equal(&a.footer, &b.footer)
}

fn zone_equal(a: &Zone, b: &Zone) -> bool {
    a.id == b.id
        && a.min_height == b.min_height
        && a.layout_mode == b.layout_mode
        && a.flow_gap == b.flow_gap
        && a.components.len() == b.components.len()
        && a
            .components
            .iter()
            .zip(b.components.iter())
            .all(|(x, y)| x == y)
}

fn page_equal(a: &PageDefinition, b: &PageDefinition) -> bool {
    a.id == b.id && a.name == b.name && a.data_source == b.data_source && zone_equal(&a.body, &b.body)
}

/// Merge schemas reusing im::Vector nodes for unchanged pages (structural sharing).
pub fn share_schema_structure(prev: &LayoutSchemaDoc, next: LayoutSchemaDoc) -> LayoutSchemaDoc {
    if prev.pages.len() != next.pages.len() {
        return next;
    }

    let mut pages = next.pages.clone();
    let mut changed = false;

    for i in 0..prev.pages.len() {
        let p = &prev.pages[i];
        let n = &next.pages[i];
        if page_equal(p, n) {
            pages = pages.update(i, p.clone());
            changed = true;
        }
    }

    let mut result = next;
    if changed {
        result.pages = pages;
    }

    if zones_equal(&prev.zones, &result.zones) {
        result.zones = prev.zones.clone();
    }

    if prev.page == result.page {
        result.page = prev.page.clone();
    }
    if prev.fonts == result.fonts {
        result.fonts = prev.fonts.clone();
    }
    if prev.variables == result.variables {
        result.variables = prev.variables.clone();
    }
    if prev.data_schema == result.data_schema {
        result.data_schema = prev.data_schema.clone();
    }

    result
}

pub struct SchemaStoreInner {
    history: Vector<LayoutSchemaDoc>,
    index: usize,
}

impl SchemaStoreInner {
    pub fn new() -> Self {
        Self {
            history: Vector::new(),
            index: 0,
        }
    }

    pub fn load_initial(&mut self, doc: LayoutSchemaDoc) {
        self.history = Vector::unit(doc);
        self.index = 0;
    }

    pub fn current(&self) -> Option<&LayoutSchemaDoc> {
        self.history.get(self.index)
    }

    pub fn push(&mut self, next: LayoutSchemaDoc) {
        let doc = if let Some(current) = self.current() {
            share_schema_structure(current, next)
        } else {
            next
        };

        let max = max_history_for(&doc);
        let truncated: Vector<LayoutSchemaDoc> = self
            .history
            .iter()
            .take(self.index + 1)
            .cloned()
            .collect();

        let mut new_history = truncated;
        new_history.push_back(doc);
        while new_history.len() > max {
            new_history.remove(0);
        }

        self.index = new_history.len().saturating_sub(1);
        self.history = new_history;
    }

    pub fn undo(&mut self) -> Option<&LayoutSchemaDoc> {
        if self.index == 0 {
            return None;
        }
        self.index -= 1;
        self.history.get(self.index)
    }

    pub fn redo(&mut self) -> Option<&LayoutSchemaDoc> {
        if self.index + 1 >= self.history.len() {
            return None;
        }
        self.index += 1;
        self.history.get(self.index)
    }

    pub fn can_undo(&self) -> bool {
        self.index > 0
    }

    pub fn can_redo(&self) -> bool {
        self.index + 1 < self.history.len()
    }

    pub fn history_len(&self) -> usize {
        self.history.len()
    }

    pub fn history_index(&self) -> usize {
        self.index
    }

    pub fn goto_index(&mut self, index: usize) -> Option<&LayoutSchemaDoc> {
        if index >= self.history.len() {
            return None;
        }
        self.index = index;
        self.history.get(self.index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::types::{PageConfig, PageMargin, SchemaMetadata, Zones};

    fn blank_doc(id: &str) -> LayoutSchemaDoc {
        LayoutSchemaDoc {
            id: id.to_string(),
            name: "Test".to_string(),
            version: "1.0.0".to_string(),
            page: PageConfig {
                size: "A4".to_string(),
                orientation: "portrait".to_string(),
                margin: PageMargin {
                    top: "15mm".to_string(),
                    bottom: "15mm".to_string(),
                    left: "15mm".to_string(),
                    right: "15mm".to_string(),
                },
                background: None,
            },
            fonts: vec![],
            zones: Zones {
                header: Zone {
                    id: "header".to_string(),
                    components: vec![],
                    min_height: None,
                    background: None,
                    padding: None,
                    show_on_first_page_only: None,
                    show_on_last_page_only: None,
                    repeat_on_every_page: None,
                    layout_mode: None,
                    flow_gap: None,
                },
                footer: Zone {
                    id: "footer".to_string(),
                    components: vec![],
                    min_height: None,
                    background: None,
                    padding: None,
                    show_on_first_page_only: None,
                    show_on_last_page_only: None,
                    repeat_on_every_page: None,
                    layout_mode: None,
                    flow_gap: None,
                },
            },
            pages: Vector::new(),
            groups: Vector::new(),
            group_data_source: None,
            batch_data_source: None,
            variables: vec![],
            data_schema: vec![],
            metadata: SchemaMetadata {
                title: "Test".to_string(),
                created_at: String::new(),
                updated_at: String::new(),
                author: "test".to_string(),
            },
        }
    }

    #[test]
    fn undo_redo_roundtrip() {
        let mut store = SchemaStoreInner::new();
        store.load_initial(blank_doc("a"));
        store.push(blank_doc("b"));
        store.push(blank_doc("c"));
        assert_eq!(store.current().unwrap().id, "c");

        store.undo();
        assert_eq!(store.current().unwrap().id, "b");
        store.redo();
        assert_eq!(store.current().unwrap().id, "c");
    }
}
