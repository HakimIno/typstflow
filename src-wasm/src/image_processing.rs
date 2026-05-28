use image::{DynamicImage, GenericImage, GenericImageView, Rgba};
use std::collections::VecDeque;

fn color_dist(a: Rgba<u8>, b: Rgba<u8>) -> i32 {
    let dr = a[0] as i32 - b[0] as i32;
    let dg = a[1] as i32 - b[1] as i32;
    let db = a[2] as i32 - b[2] as i32;
    ((dr * dr + dg * dg + db * db) as f64).sqrt() as i32
}

/// Flood-fill background removal seeded from the 4 corners.
/// Background colour is estimated as the average of the 4 corner pixels.
/// Any pixel reachable from a corner whose colour is within `tolerance` (0-255,
/// Euclidean RGB distance) of the background colour is made fully transparent.
/// Returns PNG bytes (alpha channel preserved).
pub fn remove_background_impl(data: &[u8], tolerance: u8) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory(data).map_err(|e| e.to_string())?;
    let mut rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    if width == 0 || height == 0 {
        return Err("Empty image".to_string());
    }

    // Estimate background colour from the average of the 4 corner pixels
    let corners = [
        *rgba.get_pixel(0, 0),
        *rgba.get_pixel(width - 1, 0),
        *rgba.get_pixel(0, height - 1),
        *rgba.get_pixel(width - 1, height - 1),
    ];
    let bg = Rgba([
        (corners.iter().map(|p| p[0] as u32).sum::<u32>() / 4) as u8,
        (corners.iter().map(|p| p[1] as u32).sum::<u32>() / 4) as u8,
        (corners.iter().map(|p| p[2] as u32).sum::<u32>() / 4) as u8,
        255u8,
    ]);

    let tol = tolerance as i32;
    let total = (width * height) as usize;
    let mut visited = vec![false; total];
    let mut queue: VecDeque<u32> = VecDeque::new();

    // Seed BFS from all 4 corners
    for (sx, sy) in [(0u32, 0u32), (width - 1, 0), (0, height - 1), (width - 1, height - 1)] {
        let idx = (sy * width + sx) as usize;
        if !visited[idx] {
            visited[idx] = true;
            queue.push_back(idx as u32);
        }
    }

    while let Some(flat) = queue.pop_front() {
        let x = flat % width;
        let y = flat / width;
        let pixel = *rgba.get_pixel(x, y);

        if color_dist(pixel, bg) > tol {
            continue;
        }

        rgba.put_pixel(x, y, Rgba([0, 0, 0, 0]));

        // Push 4-connected neighbours
        for (nx, ny) in [
            (x.wrapping_sub(1), y),
            (x + 1, y),
            (x, y.wrapping_sub(1)),
            (x, y + 1),
        ] {
            if nx < width && ny < height {
                let nidx = (ny * width + nx) as usize;
                if !visited[nidx] {
                    visited[nidx] = true;
                    queue.push_back((ny * width + nx) as u32);
                }
            }
        }
    }

    let mut buf = std::io::Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(rgba)
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(buf.into_inner())
}
