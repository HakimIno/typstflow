use rstar::{RTree, RTreeObject, AABB};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Clone, Debug, PartialEq)]
pub struct LayoutNode {
    pub id: String,
    pub zone: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl RTreeObject for LayoutNode {
    type Envelope = AABB<[f64; 2]>;

    fn envelope(&self) -> Self::Envelope {
        AABB::from_corners(
            [self.x, self.y],
            [self.x + self.width, self.y + self.height],
        )
    }
}

impl rstar::PointDistance for LayoutNode {
    fn distance_2(&self, point: &[f64; 2]) -> f64 {
        self.envelope().distance_2(point)
    }
}

#[derive(Serialize, Deserialize)]
pub struct NodeInput {
    pub id: String,
    pub zone: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SnapLine {
    pub is_vertical: bool,
    pub position: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SnapResult {
    pub dx: f64,
    pub dy: f64,
    pub guides: Vec<SnapLine>,
}

#[derive(Serialize, Deserialize)]
pub struct QueryResult {
    pub ids: Vec<String>,
}

#[wasm_bindgen]
pub struct LayoutEngine {
    tree: RTree<LayoutNode>,
}

#[wasm_bindgen]
impl LayoutEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            tree: RTree::new(),
        }
    }

    pub fn clear(&mut self) {
        self.tree = RTree::new();
    }

    pub fn insert_node(&mut self, input: JsValue) -> Result<(), JsValue> {
        let node: NodeInput = serde_wasm_bindgen::from_value(input)?;
        let layout_node = LayoutNode {
            id: node.id,
            zone: node.zone,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
        };
        // Remove existing node with same ID if any
        self.remove_node(&layout_node.id);
        self.tree.insert(layout_node);
        Ok(())
    }

    pub fn remove_node(&mut self, id: &str) {
        // RTree remove is a bit tricky if we don't have the exact node.
        // We have to iterate or find it.
        let mut to_remove = None;
        for node in self.tree.iter() {
            if node.id == id {
                to_remove = Some(node.clone());
                break;
            }
        }
        if let Some(node) = to_remove {
            self.tree.remove(&node);
        }
    }

    pub fn insert_nodes_batch(&mut self, inputs: JsValue) -> Result<(), JsValue> {
        let nodes: Vec<NodeInput> = serde_wasm_bindgen::from_value(inputs)?;
        let mut layout_nodes = Vec::with_capacity(nodes.len());
        for node in nodes {
            layout_nodes.push(LayoutNode {
                id: node.id,
                zone: node.zone,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
            });
        }
        // Bulk loading is faster
        self.tree = RTree::bulk_load(layout_nodes);
        Ok(())
    }

    pub fn query_rect(&self, x: f64, y: f64, width: f64, height: f64, zone_filter: Option<String>) -> Result<JsValue, JsValue> {
        let aabb = AABB::from_corners([x, y], [x + width, y + height]);
        let mut ids = Vec::new();
        
        for node in self.tree.locate_in_envelope_intersecting(&aabb) {
            if let Some(ref z) = zone_filter {
                if &node.zone == z {
                    ids.push(node.id.clone());
                }
            } else {
                ids.push(node.id.clone());
            }
        }
        
        let result = QueryResult { ids };
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    pub fn find_snaps(&self, id: &str, x: f64, y: f64, width: f64, height: f64, threshold: f64, zone_filter: Option<String>) -> Result<JsValue, JsValue> {
        let search_area = AABB::from_corners(
            [x - threshold, y - threshold],
            [x + width + threshold, y + height + threshold],
        );

        let mut best_dx = 0.0;
        let mut best_dy = 0.0;
        let mut min_dx = threshold;
        let mut min_dy = threshold;
        let mut guides = Vec::new();

        let left = x;
        let right = x + width;
        let top = y;
        let bottom = y + height;
        let center_x = x + width / 2.0;
        let center_y = y + height / 2.0;

        for node in self.tree.locate_in_envelope_intersecting(&search_area) {
            if node.id == id { continue; }
            if let Some(ref z) = zone_filter {
                if &node.zone != z { continue; }
            }

            let n_left = node.x;
            let n_right = node.x + node.width;
            let n_top = node.y;
            let n_bottom = node.y + node.height;
            let n_center_x = node.x + node.width / 2.0;
            let n_center_y = node.y + node.height / 2.0;

            // X-axis snapping
            let x_edges = [n_left, n_right, n_center_x];
            let my_x_edges = [(left, 0.0), (right, width), (center_x, width / 2.0)];

            for target_x in x_edges.iter() {
                for (my_x, offset) in my_x_edges.iter() {
                    let dx = target_x - my_x;
                    if dx.abs() < min_dx {
                        min_dx = dx.abs();
                        best_dx = dx;
                    }
                }
            }

            // Y-axis snapping
            let y_edges = [n_top, n_bottom, n_center_y];
            let my_y_edges = [(top, 0.0), (bottom, height), (center_y, height / 2.0)];

            for target_y in y_edges.iter() {
                for (my_y, offset) in my_y_edges.iter() {
                    let dy = target_y - my_y;
                    if dy.abs() < min_dy {
                        min_dy = dy.abs();
                        best_dy = dy;
                    }
                }
            }
        }

        // Apply best deltas and collect guides
        let final_x = x + best_dx;
        let final_y = y + best_dy;
        let final_left = final_x;
        let final_right = final_x + width;
        let final_center_x = final_x + width / 2.0;
        let final_top = final_y;
        let final_bottom = final_y + height;
        let final_center_y = final_y + height / 2.0;

        // Re-scan with exact matches (tolerance 0.01) to build guide lines
        for node in self.tree.locate_in_envelope_intersecting(&search_area) {
            if node.id == id { continue; }
            if let Some(ref z) = zone_filter {
                if &node.zone != z { continue; }
            }

            let n_left = node.x;
            let n_right = node.x + node.width;
            let n_top = node.y;
            let n_bottom = node.y + node.height;
            let n_center_x = node.x + node.width / 2.0;
            let n_center_y = node.y + node.height / 2.0;

            let tol = 0.01;

            if (final_left - n_left).abs() < tol || (final_left - n_right).abs() < tol || (final_left - n_center_x).abs() < tol {
                guides.push(SnapLine { is_vertical: true, position: final_left });
            }
            if (final_right - n_left).abs() < tol || (final_right - n_right).abs() < tol || (final_right - n_center_x).abs() < tol {
                guides.push(SnapLine { is_vertical: true, position: final_right });
            }
            if (final_center_x - n_center_x).abs() < tol {
                guides.push(SnapLine { is_vertical: true, position: final_center_x });
            }

            if (final_top - n_top).abs() < tol || (final_top - n_bottom).abs() < tol || (final_top - n_center_y).abs() < tol {
                guides.push(SnapLine { is_vertical: false, position: final_top });
            }
            if (final_bottom - n_top).abs() < tol || (final_bottom - n_bottom).abs() < tol || (final_bottom - n_center_y).abs() < tol {
                guides.push(SnapLine { is_vertical: false, position: final_bottom });
            }
            if (final_center_y - n_center_y).abs() < tol {
                guides.push(SnapLine { is_vertical: false, position: final_center_y });
            }
        }

        // Deduplicate guides
        guides.sort_by(|a, b| {
            if a.is_vertical != b.is_vertical {
                a.is_vertical.cmp(&b.is_vertical)
            } else {
                a.position.partial_cmp(&b.position).unwrap()
            }
        });
        guides.dedup_by(|a, b| a.is_vertical == b.is_vertical && (a.position - b.position).abs() < 0.01);

        let result = SnapResult {
            dx: best_dx,
            dy: best_dy,
            guides,
        };

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
}
