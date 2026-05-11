use rstar::{RTree, RTreeObject, AABB};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Clone, Debug, PartialEq)]
pub struct LayoutNode {
    pub id: String,
    pub zone: String,
    pub page_id: Option<String>,
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
    pub page_id: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: serde_json::Value,
    pub height: serde_json::Value,
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

fn parse_f64(v: &serde_json::Value) -> f64 {
    match v {
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0),
        serde_json::Value::String(s) => s.parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
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
            page_id: node.page_id,
            x: node.x,
            y: node.y,
            width: parse_f64(&node.width),
            height: parse_f64(&node.height),
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
            let x = if node.x.is_finite() { node.x } else { 0.0 };
            let y = if node.y.is_finite() { node.y } else { 0.0 };

            layout_nodes.push(LayoutNode {
                id: node.id,
                zone: node.zone,
                page_id: node.page_id,
                x,
                y,
                width: parse_f64(&node.width),
                height: parse_f64(&node.height),
            });
        }
        // Bulk loading is faster
        self.tree = RTree::bulk_load(layout_nodes);
        Ok(())
    }

    pub fn query_rect(&self, x: f64, y: f64, width: f64, height: f64, zone_filter: Option<String>, page_filter: Option<String>) -> Vec<String> {
        // Safety checks to prevent AABB panics
        if x.is_nan() || y.is_nan() || width.is_nan() || height.is_nan() {
            return vec![];
        }

        let x_min = x.min(x + width);
        let x_max = x.max(x + width);
        let y_min = y.min(y + height);
        let y_max = y.max(y + height);

        let aabb = AABB::from_corners([x_min, y_min], [x_max, y_max]);
        let mut ids = Vec::new();
        
        for node in self.tree.locate_in_envelope_intersecting(&aabb) {
            if let Some(ref z) = zone_filter {
                if &node.zone != z { continue; }
            }
            if let Some(ref p) = page_filter {
                if let Some(ref node_p) = node.page_id {
                    if node_p != p { continue; }
                } else {
                    continue; 
                }
            }
            ids.push(node.id.clone());
        }
        
        ids
    }

    pub fn find_snaps(&self, id: &str, x: f64, y: f64, width: f64, height: f64, threshold: f64, zone_filter: Option<String>) -> Result<JsValue, JsValue> {
        if x.is_nan() || y.is_nan() || width.is_nan() || height.is_nan() {
            return Ok(serde_wasm_bindgen::to_value(&Vec::<SnapResult>::new())?);
        }

        const GRID_SIZE: f64 = 0.1;

        // Search area slightly larger than threshold
        let x_min = (x - threshold).min(x + width + threshold);
        let x_max = (x - threshold).max(x + width + threshold);
        let y_min = (y - threshold).min(y + height + threshold);
        let y_max = (y - threshold).max(y + height + threshold);

        let search_area = AABB::from_corners([x_min, y_min], [x_max, y_max]);

        let mut best_dx = None;
        let mut best_dy = None;
        let mut min_dx = threshold;
        let mut min_dy = threshold;
        let mut guides = Vec::new();

        let left = x;
        let right = x + width;
        let top = y;
        let bottom = y + height;
        let center_x = x + width / 2.0;
        let center_y = y + height / 2.0;

        // 1. Element Snapping Pass
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
            let x_targets = [n_left, n_right, n_center_x];
            let my_x_points = [left, right, center_x];

            for &target_x in x_targets.iter() {
                for &my_x in my_x_points.iter() {
                    let dx = target_x - my_x;
                    if dx.abs() < min_dx {
                        min_dx = dx.abs();
                        best_dx = Some(dx);
                    }
                }
            }

            // Y-axis snapping
            let y_targets = [n_top, n_bottom, n_center_y];
            let my_y_points = [top, bottom, center_y];

            for &target_y in y_targets.iter() {
                for &my_y in my_y_points.iter() {
                    let dy = target_y - my_y;
                    if dy.abs() < min_dy {
                        min_dy = dy.abs();
                        best_dy = Some(dy);
                    }
                }
            }
        }

        // 2. Grid Snapping Fallback (If no element snap found)
        let final_dx = match best_dx {
            Some(dx) => dx,
            None => {
                let snapped_x = (x / GRID_SIZE).round() * GRID_SIZE;
                snapped_x - x
            }
        };

        let final_dy = match best_dy {
            Some(dy) => dy,
            None => {
                let snapped_y = (y / GRID_SIZE).round() * GRID_SIZE;
                snapped_y - y
            }
        };

        // 3. Build Guide Lines for exact matches
        let snapped_x_pos = x + final_dx;
        let snapped_y_pos = y + final_dy;
        
        let final_left = snapped_x_pos;
        let final_right = snapped_x_pos + width;
        let final_center_x = snapped_x_pos + width / 2.0;
        let final_top = snapped_y_pos;
        let final_bottom = snapped_y_pos + height;
        let final_center_y = snapped_y_pos + height / 2.0;

        let tol = 0.001; // mm precision for guide matching

        // Only show guides for element snapping, not grid snapping
        if best_dx.is_some() || best_dy.is_some() {
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

                // Vertical Guides (X)
                if best_dx.is_some() {
                    if (final_left - n_left).abs() < tol || (final_left - n_right).abs() < tol || (final_left - n_center_x).abs() < tol {
                        guides.push(SnapLine { is_vertical: true, position: final_left });
                    }
                    if (final_right - n_left).abs() < tol || (final_right - n_right).abs() < tol || (final_right - n_center_x).abs() < tol {
                        guides.push(SnapLine { is_vertical: true, position: final_right });
                    }
                    if (final_center_x - n_center_x).abs() < tol {
                        guides.push(SnapLine { is_vertical: true, position: final_center_x });
                    }
                }

                // Horizontal Guides (Y)
                if best_dy.is_some() {
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
            }
        }

        // Deduplicate guides
        guides.sort_by(|a, b| {
            if a.is_vertical != b.is_vertical {
                a.is_vertical.cmp(&b.is_vertical)
            } else {
                a.position.partial_cmp(&b.position).unwrap_or(std::cmp::Ordering::Equal)
            }
        });
        guides.dedup_by(|a, b| a.is_vertical == b.is_vertical && (a.position - b.position).abs() < tol);

        Ok(serde_wasm_bindgen::to_value(&SnapResult {
            dx: final_dx,
            dy: final_dy,
            guides,
        })?)
    }
}
