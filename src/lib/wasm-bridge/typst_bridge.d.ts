/* tslint:disable */
/* eslint-disable */

export class TypstBridge {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Clear all registered images (call between renders if needed).
     */
    clear_images(): void;
    generate_report_typst(schema_json: string, data_json: string): string;
    constructor();
    /**
     * Register raw image bytes under a virtual filename.
     * Call this before rendering when source uses #image("virtual-name.png").
     */
    register_image(virtual_path: string, data: Uint8Array): void;
    render_pdf(source_code: string): Uint8Array;
    render_report_pdf(schema_json: string, data_json: string): Uint8Array;
    render_report_svg(schema_json: string, data_json: string): string;
    render_svg(source_code: string): string;
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
    readonly __wbg_typstbridge_free: (a: number, b: number) => void;
    readonly typstbridge_clear_images: (a: number) => void;
    readonly typstbridge_generate_report_typst: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly typstbridge_new: () => number;
    readonly typstbridge_register_image: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly typstbridge_render_pdf: (a: number, b: number, c: number) => [number, number, number, number];
    readonly typstbridge_render_report_pdf: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly typstbridge_render_report_svg: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly typstbridge_render_svg: (a: number, b: number, c: number) => [number, number, number, number];
    readonly qcms_enable_iccv4: () => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
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
