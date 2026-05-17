use crate::schema::BaseComponent;

/// Fixed-position wrapper using `#place()`. Components sit at exact mm coordinates.
/// Used for absolute-positioned zones (header, footer, body in non-flow mode).
pub fn wrap_placement(
    base: &BaseComponent,
    body: &str,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);
    let h = base.height.unwrap_or(20.0);

    let off_x: f64 = offset_x.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let off_y: f64 = offset_y.trim_end_matches("mm").trim().parse().unwrap_or(0.0);

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n#box()\n");
    }
    out.push_str(&format!(
        "{}place(top + left, dx: {}mm, dy: {}mm)[#block(width: {}mm, height: {}mm, clip: false)[{}]]\n",
        prefix,
        off_x + x,
        off_y + y,
        w,
        h,
        body
    ));
    out
}

/// Flow wrapper — keeps content in document flow (no `#place()`).
/// - `above/below: 0pt` removes Typst's default inter-block spacing so rows stack flush.
/// - Explicit `height` ensures percentage-height children (e.g. `height: 100%` in images)
///   resolve against the component's mm value instead of the full page height.
/// - `y` is intentionally ignored: in flow mode, order is determined by array position,
///   not by absolute coordinates.
/// - `fill_width`: when true, uses `width: 100%` for the inner block (used inside grid cells
///   where the cell width determines the available space).
/// - `is_text`: when true, omits height so Typst auto-sizes based on content (prevents overlap).
pub fn wrap_flow_block(base: &BaseComponent, body: &str, prefix: &str, fill_width: bool, is_text: bool) -> String {
    let x = base.x.unwrap_or(0.0);
    let w = base.width.unwrap_or(190.0);
    let h = base.height.unwrap_or(10.0);

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n");
    }
    if !body.is_empty() {
        // When inside a grid cell (fill_width=true), use 100% so content fills
        // the cell determined by the grid column width.
        let width_expr = if fill_width { "100%".to_string() } else { format!("{}mm", w) };
        // Text: auto height (Typst determines from content) → prevents overlap
        // Other: explicit mm height so percentage-height children resolve correctly
        let inner_block = if is_text {
            format!("#block(width: {}, clip: false)[{}]", width_expr, body)
        } else {
            format!("#block(width: {}, height: {}mm, clip: false)[{}]", width_expr, h, body)
        };
        // Inside a grid cell, skip left-padding (x indent) — the grid handles positioning
        let inner = if !fill_width && x > 0.0 {
            format!("#pad(left: {}mm)[{}]", x, inner_block)
        } else {
            inner_block
        };
        // Use component margins for spacing. Text defaults to 2pt below if no margin set,
        // preventing the "cramped" look where text blocks stack flush against each other.
        let above_val = base.margin_top.map(|m| format!("{}mm", m)).unwrap_or_else(|| "0pt".to_string());
        let below_val = base.margin_bottom.map(|m| format!("{}mm", m)).unwrap_or_else(|| {
            if is_text { "2pt".to_string() } else { "0pt".to_string() }
        });
        // Text: auto outer height too
        let outer_height = if is_text { String::new() } else { format!(", height: {}mm", h) };
        out.push_str(&format!(
            "{}block(above: {}, below: {}, width: 100%{})[{}]\n",
            prefix, above_val, below_val, outer_height, inner
        ));
    }
    out
}

/// Flow wrapper using `#pad` + `#block` for native page-break support.
/// Required for tables so Typst can split rows across pages automatically.
pub fn wrap_flow(
    base: &BaseComponent,
    body: &str,
    offset_x: &str,
    offset_y: &str,
    prefix: &str,
) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(100.0);

    let off_x: f64 = offset_x.trim_end_matches("mm").trim().parse().unwrap_or(0.0);
    let off_y: f64 = offset_y.trim_end_matches("mm").trim().parse().unwrap_or(0.0);

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n");
    }
    out.push_str(&format!(
        "{}align(top + left)[#pad(top: {}mm, left: {}mm)[#block(width: {}mm, clip: false)[{}]]]\n",
        prefix,
        off_y + y,
        off_x + x,
        w,
        body
    ));
    out
}
