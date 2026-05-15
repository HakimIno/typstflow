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
pub struct SpacingIndicator {
    pub side: String,
    pub distance: f64,
    pub line_start: f64,
    pub line_end: f64,
    pub cross_pos: f64,
}

#[derive(Serialize, Deserialize)]
pub struct FullSnapResult {
    pub snapped_x: f64,
    pub snapped_y: f64,
    pub guides_x: Vec<f64>,
    pub guides_y: Vec<f64>,
    pub spacing_indicators: Vec<SpacingIndicator>,
}

#[derive(Serialize, Deserialize)]
pub struct QueryResult {
    pub ids: Vec<String>,
}

const EQUAL_SPACING_THRESHOLD: f64 = 1.5; // mm
const MAX_INDICATOR_DIST: f64 = 100.0; // mm
const GRID_SIZE: f64 = 1.0; // mm

#[wasm_bindgen]
pub struct LayoutEngine {
    tree: RTree<LayoutNode>,
}

// Private helpers — not exported to WASM
impl LayoutEngine {
    /// Find equal-spacing snap candidates.
    /// Returns Vec<(axis, snapped_value, reference_gap)>.
    fn compute_equal_spacing_snaps(
        &self,
        id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        zone_filter: Option<&str>,
    ) -> Vec<(String, f64, f64)> {
        let siblings: Vec<&LayoutNode> = self
            .tree
            .iter()
            .filter(|n| n.id != id)
            .filter(|n| zone_filter.map_or(true, |z| n.zone == z))
            .collect();

        if siblings.len() < 2 {
            return vec![];
        }

        // Compute X gaps from siblings sorted by left edge.
        // Store as fixed-point (×100) to use in a HashSet without float precision issues.
        let mut sorted_x: Vec<(f64, f64)> = siblings.iter().map(|n| (n.x, n.x + n.width)).collect();
        sorted_x.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

        let mut gaps_x: std::collections::HashSet<i64> = std::collections::HashSet::new();
        for i in 0..sorted_x.len().saturating_sub(1) {
            let gap = sorted_x[i + 1].0 - sorted_x[i].1;
            if gap > 0.5 && gap < 150.0 {
                gaps_x.insert((gap * 100.0).round() as i64);
            }
        }

        let mut sorted_y: Vec<(f64, f64)> = siblings.iter().map(|n| (n.y, n.y + n.height)).collect();
        sorted_y.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

        let mut gaps_y: std::collections::HashSet<i64> = std::collections::HashSet::new();
        for i in 0..sorted_y.len().saturating_sub(1) {
            let gap = sorted_y[i + 1].0 - sorted_y[i].1;
            if gap > 0.5 && gap < 150.0 {
                gaps_y.insert((gap * 100.0).round() as i64);
            }
        }

        let mut result = Vec::new();
        for node in &siblings {
            for &gap_fixed in &gaps_x {
                let gap = gap_fixed as f64 / 100.0;
                let cand_after = node.x + node.width + gap;
                if (x - cand_after).abs() < EQUAL_SPACING_THRESHOLD {
                    result.push(("x".to_string(), cand_after, gap));
                }
                let cand_before = node.x - width - gap;
                if (x - cand_before).abs() < EQUAL_SPACING_THRESHOLD {
                    result.push(("x".to_string(), cand_before, gap));
                }
            }
            for &gap_fixed in &gaps_y {
                let gap = gap_fixed as f64 / 100.0;
                let cand_below = node.y + node.height + gap;
                if (y - cand_below).abs() < EQUAL_SPACING_THRESHOLD {
                    result.push(("y".to_string(), cand_below, gap));
                }
                let cand_above = node.y - height - gap;
                if (y - cand_above).abs() < EQUAL_SPACING_THRESHOLD {
                    result.push(("y".to_string(), cand_above, gap));
                }
            }
        }
        result
    }

    /// Find nearest neighbor on each side and generate spacing indicators.
    /// Uses all loaded nodes (no zone filter) — nodes are already pre-filtered
    /// to nearby pages by the caller (DragMonitor loads only ±SNAP_PAGE_RADIUS pages).
    fn compute_spacing_indicators(
        &self,
        id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Vec<SpacingIndicator> {
        let drag_right = x + width;
        let drag_bottom = y + height;
        let drag_center_x = x + width / 2.0;
        let drag_center_y = y + height / 2.0;

        // (distance, line_start, line_end)
        let mut nearest_left: Option<(f64, f64, f64)> = None;
        let mut nearest_right: Option<(f64, f64, f64)> = None;
        let mut nearest_top: Option<(f64, f64, f64)> = None;
        let mut nearest_bottom: Option<(f64, f64, f64)> = None;

        for node in self.tree.iter() {
            if node.id == id {
                continue;
            }

            let s_right = node.x + node.width;
            let s_bottom = node.y + node.height;

            let y_overlap = !(s_bottom < y || node.y > drag_bottom);
            let x_overlap = !(s_right < x || node.x > drag_right);

            if y_overlap {
                if s_right <= x {
                    let dist = x - s_right;
                    if nearest_left.map_or(true, |(d, _, _)| dist < d) {
                        nearest_left = Some((dist, s_right, x));
                    }
                }
                if node.x >= drag_right {
                    let dist = node.x - drag_right;
                    if nearest_right.map_or(true, |(d, _, _)| dist < d) {
                        nearest_right = Some((dist, drag_right, node.x));
                    }
                }
            }

            if x_overlap {
                if s_bottom <= y {
                    let dist = y - s_bottom;
                    if nearest_top.map_or(true, |(d, _, _)| dist < d) {
                        nearest_top = Some((dist, s_bottom, y));
                    }
                }
                if node.y >= drag_bottom {
                    let dist = node.y - drag_bottom;
                    if nearest_bottom.map_or(true, |(d, _, _)| dist < d) {
                        nearest_bottom = Some((dist, drag_bottom, node.y));
                    }
                }
            }
        }

        let mut indicators = Vec::new();

        if let Some((dist, ls, le)) = nearest_left {
            if dist < MAX_INDICATOR_DIST {
                indicators.push(SpacingIndicator {
                    side: "left".to_string(),
                    distance: (dist * 10.0).round() / 10.0,
                    line_start: ls,
                    line_end: le,
                    cross_pos: drag_center_y,
                });
            }
        }
        if let Some((dist, ls, le)) = nearest_right {
            if dist < MAX_INDICATOR_DIST {
                indicators.push(SpacingIndicator {
                    side: "right".to_string(),
                    distance: (dist * 10.0).round() / 10.0,
                    line_start: ls,
                    line_end: le,
                    cross_pos: drag_center_y,
                });
            }
        }
        if let Some((dist, ls, le)) = nearest_top {
            if dist < MAX_INDICATOR_DIST {
                indicators.push(SpacingIndicator {
                    side: "top".to_string(),
                    distance: (dist * 10.0).round() / 10.0,
                    line_start: ls,
                    line_end: le,
                    cross_pos: drag_center_x,
                });
            }
        }
        if let Some((dist, ls, le)) = nearest_bottom {
            if dist < MAX_INDICATOR_DIST {
                indicators.push(SpacingIndicator {
                    side: "bottom".to_string(),
                    distance: (dist * 10.0).round() / 10.0,
                    line_start: ls,
                    line_end: le,
                    cross_pos: drag_center_x,
                });
            }
        }

        indicators
    }
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
            width: node.width,
            height: node.height,
        };
        // Remove existing node with same ID if any
        self.remove_node(&layout_node.id);
        self.tree.insert(layout_node);
        Ok(())
    }

    pub fn remove_node(&mut self, id: &str) {
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
                page_id: node.page_id,
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height,
            });
        }
        self.tree = RTree::bulk_load(layout_nodes);
        Ok(())
    }

    pub fn query_rect(
        &self,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        zone_filter: Option<String>,
        page_filter: Option<String>,
    ) -> Vec<String> {
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
                if &node.zone != z {
                    continue;
                }
            }
            if let Some(ref p) = page_filter {
                if let Some(ref node_p) = node.page_id {
                    if node_p != p {
                        continue;
                    }
                } else {
                    continue;
                }
            }
            ids.push(node.id.clone());
        }

        ids
    }

    /// Legacy single-pass snap: returns {dx, dy, guides}.
    /// Kept for backward compatibility with existing callers.
    pub fn find_snaps(
        &self,
        id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        threshold: f64,
        zone_filter: Option<String>,
    ) -> Result<JsValue, JsValue> {
        if x.is_nan() || y.is_nan() || width.is_nan() || height.is_nan() {
            return Ok(serde_wasm_bindgen::to_value(&SnapResult {
                dx: 0.0,
                dy: 0.0,
                guides: vec![],
            })?);
        }

        const GRID_SIZE_LEGACY: f64 = 0.1;

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

        for node in self.tree.locate_in_envelope_intersecting(&search_area) {
            if node.id == id {
                continue;
            }
            if let Some(ref z) = zone_filter {
                if &node.zone != z {
                    continue;
                }
            }

            let n_left = node.x;
            let n_right = node.x + node.width;
            let n_top = node.y;
            let n_bottom = node.y + node.height;
            let n_center_x = node.x + node.width / 2.0;
            let n_center_y = node.y + node.height / 2.0;

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

        let final_dx = match best_dx {
            Some(dx) => dx,
            None => {
                let snapped_x = (x / GRID_SIZE_LEGACY).round() * GRID_SIZE_LEGACY;
                snapped_x - x
            }
        };

        let final_dy = match best_dy {
            Some(dy) => dy,
            None => {
                let snapped_y = (y / GRID_SIZE_LEGACY).round() * GRID_SIZE_LEGACY;
                snapped_y - y
            }
        };

        let snapped_x_pos = x + final_dx;
        let snapped_y_pos = y + final_dy;

        let final_left = snapped_x_pos;
        let final_right = snapped_x_pos + width;
        let final_center_x = snapped_x_pos + width / 2.0;
        let final_top = snapped_y_pos;
        let final_bottom = snapped_y_pos + height;
        let final_center_y = snapped_y_pos + height / 2.0;

        let tol = 0.001;

        if best_dx.is_some() || best_dy.is_some() {
            for node in self.tree.locate_in_envelope_intersecting(&search_area) {
                if node.id == id {
                    continue;
                }
                if let Some(ref z) = zone_filter {
                    if &node.zone != z {
                        continue;
                    }
                }

                let n_left = node.x;
                let n_right = node.x + node.width;
                let n_top = node.y;
                let n_bottom = node.y + node.height;
                let n_center_x = node.x + node.width / 2.0;
                let n_center_y = node.y + node.height / 2.0;

                if best_dx.is_some() {
                    if (final_left - n_left).abs() < tol
                        || (final_left - n_right).abs() < tol
                        || (final_left - n_center_x).abs() < tol
                    {
                        guides.push(SnapLine { is_vertical: true, position: final_left });
                    }
                    if (final_right - n_left).abs() < tol
                        || (final_right - n_right).abs() < tol
                        || (final_right - n_center_x).abs() < tol
                    {
                        guides.push(SnapLine { is_vertical: true, position: final_right });
                    }
                    if (final_center_x - n_center_x).abs() < tol {
                        guides.push(SnapLine { is_vertical: true, position: final_center_x });
                    }
                }

                if best_dy.is_some() {
                    if (final_top - n_top).abs() < tol
                        || (final_top - n_bottom).abs() < tol
                        || (final_top - n_center_y).abs() < tol
                    {
                        guides.push(SnapLine { is_vertical: false, position: final_top });
                    }
                    if (final_bottom - n_top).abs() < tol
                        || (final_bottom - n_bottom).abs() < tol
                        || (final_bottom - n_center_y).abs() < tol
                    {
                        guides.push(SnapLine { is_vertical: false, position: final_bottom });
                    }
                    if (final_center_y - n_center_y).abs() < tol {
                        guides.push(SnapLine { is_vertical: false, position: final_center_y });
                    }
                }
            }
        }

        guides.sort_by(|a, b| {
            if a.is_vertical != b.is_vertical {
                a.is_vertical.cmp(&b.is_vertical)
            } else {
                a.position.partial_cmp(&b.position).unwrap_or(std::cmp::Ordering::Equal)
            }
        });
        guides.dedup_by(|a, b| {
            a.is_vertical == b.is_vertical && (a.position - b.position).abs() < tol
        });

        Ok(serde_wasm_bindgen::to_value(&SnapResult {
            dx: final_dx,
            dy: final_dy,
            guides,
        })?)
    }

    /// Comprehensive single-call snap: equal-spacing + element + spacing indicators.
    /// Returns {snapped_x, snapped_y, guides_x, guides_y, spacing_indicators}.
    /// zone_filter scopes element/equal-spacing snaps; spacing indicators always use all nodes.
    pub fn calculate_snap(
        &self,
        id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        threshold: f64,
        zone_filter: Option<String>,
    ) -> Result<JsValue, JsValue> {
        if x.is_nan() || y.is_nan() || width.is_nan() || height.is_nan() {
            return Ok(serde_wasm_bindgen::to_value(&FullSnapResult {
                snapped_x: x,
                snapped_y: y,
                guides_x: vec![],
                guides_y: vec![],
                spacing_indicators: vec![],
            })?);
        }

        let zone = zone_filter.as_deref();

        // --- Step 1: Equal-spacing snaps (higher priority than element snap) ---
        let equal_snaps = self.compute_equal_spacing_snaps(id, x, y, width, height, zone);

        let mut snapped_x = x;
        let mut snapped_y = y;
        let mut equal_x = false;
        let mut equal_y = false;

        for (axis, val, _gap) in &equal_snaps {
            if axis == "x" && !equal_x {
                snapped_x = *val;
                equal_x = true;
            }
            if axis == "y" && !equal_y {
                snapped_y = *val;
                equal_y = true;
            }
        }

        // --- Step 2: Element snap via RTree (axes not already equal-snapped) ---
        let left = x;
        let right = x + width;
        let top = y;
        let bottom = y + height;
        let center_x = x + width / 2.0;
        let center_y = y + height / 2.0;

        let x_min = (x - threshold).min(x + width + threshold);
        let x_max = (x - threshold).max(x + width + threshold);
        let y_min = (y - threshold).min(y + height + threshold);
        let y_max = (y - threshold).max(y + height + threshold);
        let search_area = AABB::from_corners([x_min, y_min], [x_max, y_max]);

        let mut best_dx: Option<f64> = None;
        let mut best_dy: Option<f64> = None;
        let mut min_dx = threshold;
        let mut min_dy = threshold;

        for node in self.tree.locate_in_envelope_intersecting(&search_area) {
            if node.id == id {
                continue;
            }
            if let Some(z) = zone {
                if node.zone != z {
                    continue;
                }
            }

            let nl = node.x;
            let nr = node.x + node.width;
            let nc = node.x + node.width / 2.0;
            let nt = node.y;
            let nb = node.y + node.height;
            let ncy = node.y + node.height / 2.0;

            if !equal_x {
                for &tx in &[nl, nr, nc] {
                    for &mx in &[left, right, center_x] {
                        let dx = tx - mx;
                        if dx.abs() < min_dx {
                            min_dx = dx.abs();
                            best_dx = Some(dx);
                        }
                    }
                }
            }
            if !equal_y {
                for &ty in &[nt, nb, ncy] {
                    for &my in &[top, bottom, center_y] {
                        let dy = ty - my;
                        if dy.abs() < min_dy {
                            min_dy = dy.abs();
                            best_dy = Some(dy);
                        }
                    }
                }
            }
        }

        if !equal_x {
            snapped_x = match best_dx {
                Some(dx) => x + dx,
                None => (x / GRID_SIZE).round() * GRID_SIZE,
            };
        }
        if !equal_y {
            snapped_y = match best_dy {
                Some(dy) => y + dy,
                None => (y / GRID_SIZE).round() * GRID_SIZE,
            };
        }

        // --- Step 3: Build guide lines for snapped positions ---
        let tol = 0.001;
        let final_left = snapped_x;
        let final_right = snapped_x + width;
        let final_center_x = snapped_x + width / 2.0;
        let final_top = snapped_y;
        let final_bottom = snapped_y + height;
        let final_center_y = snapped_y + height / 2.0;

        let mut guides_x: Vec<f64> = Vec::new();
        let mut guides_y: Vec<f64> = Vec::new();

        let has_x_snap = best_dx.is_some() || equal_x;
        let has_y_snap = best_dy.is_some() || equal_y;

        if has_x_snap || has_y_snap {
            for node in self.tree.locate_in_envelope_intersecting(&search_area) {
                if node.id == id {
                    continue;
                }
                if let Some(z) = zone {
                    if node.zone != z {
                        continue;
                    }
                }
                let nl = node.x;
                let nr = node.x + node.width;
                let nc = node.x + node.width / 2.0;
                let nt = node.y;
                let nb = node.y + node.height;
                let ncy = node.y + node.height / 2.0;

                if has_x_snap {
                    for &gx in &[final_left, final_right, final_center_x] {
                        for &nx in &[nl, nr, nc] {
                            if (gx - nx).abs() < tol && !guides_x.contains(&gx) {
                                guides_x.push(gx);
                            }
                        }
                    }
                }
                if has_y_snap {
                    for &gy in &[final_top, final_bottom, final_center_y] {
                        for &ny in &[nt, nb, ncy] {
                            if (gy - ny).abs() < tol && !guides_y.contains(&gy) {
                                guides_y.push(gy);
                            }
                        }
                    }
                }
            }
        }

        // --- Step 4: Spacing indicators (all loaded nodes, no zone filter) ---
        let spacing_indicators = self.compute_spacing_indicators(id, snapped_x, snapped_y, width, height);

        Ok(serde_wasm_bindgen::to_value(&FullSnapResult {
            snapped_x,
            snapped_y,
            guides_x,
            guides_y,
            spacing_indicators,
        })?)
    }
}
