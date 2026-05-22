/** Options for {@link TypstGenerator.generate}. */
export interface GenerateOptions {
  /**
   * When true, emit human-readable Typst with section banners, component labels,
   * and multi-line indentation. Used for `.typ` download — not required for compile.
   * @default false
   */
  pretty?: boolean;
  /**
   * When set, only emit Typst for these zero-based page indices.
   * Used for incremental preview — omits unchanged pages from compilation.
   */
  pageIndices?: number[];
  /**
   * Omit pages with no body/header/footer components from output.
   * Defaults to `pretty` — keeps compile output page-accurate unless overridden.
   */
  skipEmptyPages?: boolean;
}
