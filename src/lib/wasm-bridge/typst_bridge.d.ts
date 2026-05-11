/* tslint:disable */
/* eslint-disable */

export class LayoutEngine {
    free(): void;
    [Symbol.dispose](): void;
    clear(): void;
    find_snaps(id: string, x: number, y: number, width: number, height: number, threshold: number, zone_filter?: string | null): any;
    insert_node(input: any): void;
    insert_nodes_batch(inputs: any): void;
    constructor();
    query_rect(x: number, y: number, width: number, height: number, zone_filter?: string | null, page_filter?: string | null): string[];
    remove_node(id: string): void;
}

export class TableEngine {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    static resolve(table_json: string, page_height_mm: number, start_y_mm: number): any;
}

export class TypstBridge {
    free(): void;
    [Symbol.dispose](): void;
    clear_images(): void;
    generate_report_typst(schema_json: string, data_json: string): string;
    /**
     * Return sorted list of available font family names as a JS Array of strings.
     */
    get_font_names(): any;
    constructor();
    /**
     * Parse CSV string into JSON array of objects.
     * High-performance parsing using Rust's csv crate with smart type inference.
     */
    parse_csv(csv_data: string): string;
    /**
     * Parse CSV bytes into JSON array of objects.
     */
    parse_csv_bytes(data: Uint8Array): string;
    /**
     * Parse Excel bytes (XLSX, XLS, ODS, XLSB) into JSON array of objects from the first sheet.
     * Uses high-performance calamine reader.
     */
    parse_xlsx(data: Uint8Array): string;
    /**
     * Register a font at runtime. Accepts raw TTF/OTF bytes.
     * Returns true if at least one font face was loaded successfully.
     * Requires &mut self — safe in single-threaded WASM context.
     */
    register_font(data: Uint8Array): boolean;
    register_image(virtual_path: string, data: Uint8Array): void;
    render_pdf(source_code: string): Uint8Array;
    render_report_pdf(schema_json: string, data_json: string): Uint8Array;
    render_report_svg(schema_json: string, data_json: string): string;
    render_svg(source_code: string): string;
    /**
     * Set the current date so datetime.today() returns the correct value.
     * Call this from JS before each render: bridge.set_today(year, month, day).
     */
    set_today(year: number, month: number, day: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly qcms_transform_data_rgb_out_lut: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_transform_data_rgba_out_lut: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_transform_data_bgra_out_lut: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_transform_data_rgb_out_lut_precache: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_transform_data_rgba_out_lut_precache: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_transform_data_bgra_out_lut_precache: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_profile_precache_output_transform: (a: number) => void;
    readonly qcms_transform_release: (a: number) => void;
    readonly qcms_white_point_sRGB: (a: number) => void;
    readonly qcms_profile_is_bogus: (a: number) => number;
    readonly lut_inverse_interp16: (a: number, b: number, c: number) => number;
    readonly lut_interp_linear16: (a: number, b: number, c: number) => number;
    readonly __wbg_layoutengine_free: (a: number, b: number) => void;
    readonly __wbg_tableengine_free: (a: number, b: number) => void;
    readonly layoutengine_clear: (a: number) => void;
    readonly layoutengine_find_snaps: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number];
    readonly layoutengine_insert_node: (a: number, b: any) => [number, number];
    readonly layoutengine_insert_nodes_batch: (a: number, b: any) => [number, number];
    readonly layoutengine_new: () => number;
    readonly layoutengine_query_rect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly layoutengine_remove_node: (a: number, b: number, c: number) => void;
    readonly tableengine_resolve: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly __wbg_typstbridge_free: (a: number, b: number) => void;
    readonly typstbridge_clear_images: (a: number) => void;
    readonly typstbridge_generate_report_typst: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly typstbridge_get_font_names: (a: number) => any;
    readonly typstbridge_new: () => number;
    readonly typstbridge_parse_csv: (a: number, b: number, c: number) => [number, number, number, number];
    readonly typstbridge_parse_csv_bytes: (a: number, b: number, c: number) => [number, number, number, number];
    readonly typstbridge_parse_xlsx: (a: number, b: number, c: number) => [number, number, number, number];
    readonly typstbridge_register_font: (a: number, b: number, c: number) => number;
    readonly typstbridge_register_image: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly typstbridge_render_pdf: (a: number, b: number, c: number) => [number, number, number, number];
    readonly typstbridge_render_report_pdf: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly typstbridge_render_report_svg: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly typstbridge_render_svg: (a: number, b: number, c: number) => [number, number, number, number];
    readonly typstbridge_set_today: (a: number, b: number, c: number, d: number) => void;
    readonly qcms_enable_iccv4: () => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
