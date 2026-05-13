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
/// Uses `#block > #pad > #block` for left/top indent so that nested `#set` rules
/// inside deep content brackets don't trigger Typst parser errors.
pub fn wrap_flow_block(base: &BaseComponent, body: &str, prefix: &str) -> String {
    let x = base.x.unwrap_or(0.0);
    let y = base.y.unwrap_or(0.0);
    let w = base.width.unwrap_or(190.0);

    let mut out = String::new();
    if base.page_break_before.unwrap_or(false) {
        out.push_str("#pagebreak(weak: true)\n");
    }
    if !body.is_empty() {
        if x > 0.0 || y > 0.0 {
            out.push_str(&format!(
                "{}block(width: 100%)[#pad(top: {}mm, left: {}mm)[#block(width: {}mm, clip: false)[{}]]]\n",
                prefix, y, x, w, body
            ));
        } else {
            out.push_str(&format!("{}block(width: {}mm, clip: false)[{}]\n", prefix, w, body));
        }
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
