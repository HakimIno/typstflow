use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupLayoutInput {
    pub id: String,
    pub header_height_mm: f64,
    pub footer_height_mm: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoneLayoutConfig {
    pub page_height_mm: f64,
    pub header_height_mm: f64,
    pub footer_height_mm: f64,
    pub header_repeat: bool,
    pub footer_repeat: bool,
    pub footer_last_page_only: bool,
    pub total_pages: usize,
    pub groups: Vec<GroupLayoutInput>,
}

fn is_header_visible(config: &ZoneLayoutConfig, page_index: usize) -> bool {
    config.header_repeat || page_index == 0
}

fn is_footer_visible(config: &ZoneLayoutConfig, page_index: usize) -> bool {
    let is_first_page = page_index == 0;
    let is_last_page = page_index + 1 >= config.total_pages.max(1);
    config.footer_repeat
        || (config.footer_last_page_only && is_last_page)
        || (!config.footer_repeat && !config.footer_last_page_only && is_first_page)
}

fn sum_group_header_heights(config: &ZoneLayoutConfig) -> f64 {
    config.groups.iter().map(|g| g.header_height_mm).sum()
}

pub fn calculate_zone_offset(
    config: &ZoneLayoutConfig,
    zone_key: &str,
    page_index: usize,
) -> f64 {
    if zone_key == "header" {
        return 0.0;
    }

    if zone_key == "footer" {
        if !is_footer_visible(config, page_index) {
            return 0.0;
        }
        return config.page_height_mm - config.footer_height_mm;
    }

    let mut offset = 0.0;
    if is_header_visible(config, page_index) {
        offset += config.header_height_mm;
    }

    if zone_key == "body" {
        offset += sum_group_header_heights(config);
    }

    offset
}

pub fn calculate_band_offset(
    config: &ZoneLayoutConfig,
    group_id: &str,
    group_type: &str,
    page_index: usize,
) -> f64 {
    let mut offset = 0.0;
    if is_header_visible(config, page_index) {
        offset += config.header_height_mm;
    }

    if group_type == "header" {
        for group in &config.groups {
            if group.id == group_id {
                return offset;
            }
            offset += group.header_height_mm;
        }
        return offset;
    }

    let mut bottom_offset = config.page_height_mm;

    if is_footer_visible(config, page_index) {
        bottom_offset -= config.footer_height_mm;
    }

    for group in config.groups.iter().rev() {
        bottom_offset -= group.footer_height_mm;
        if group.id == group_id {
            return bottom_offset;
        }
    }

    bottom_offset
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> ZoneLayoutConfig {
        ZoneLayoutConfig {
            page_height_mm: 297.0,
            header_height_mm: 25.0,
            footer_height_mm: 20.0,
            header_repeat: false,
            footer_repeat: false,
            footer_last_page_only: false,
            total_pages: 2,
            groups: vec![],
        }
    }

    #[test]
    fn header_offset_is_zero() {
        let config = sample_config();
        assert_eq!(calculate_zone_offset(&config, "header", 0), 0.0);
        assert_eq!(calculate_zone_offset(&config, "header", 1), 0.0);
    }

    #[test]
    fn body_offset_on_first_page() {
        let config = sample_config();
        assert_eq!(calculate_zone_offset(&config, "body", 0), 25.0);
    }

    #[test]
    fn body_offset_zero_when_header_not_repeated_on_page_two() {
        let config = sample_config();
        assert_eq!(calculate_zone_offset(&config, "body", 1), 0.0);
    }

    #[test]
    fn footer_offset_when_visible() {
        let config = sample_config();
        assert_eq!(calculate_zone_offset(&config, "footer", 0), 277.0);
    }

    #[test]
    fn footer_hidden_on_page_two() {
        let config = sample_config();
        assert_eq!(calculate_zone_offset(&config, "footer", 1), 0.0);
    }
}
