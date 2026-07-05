/** Options for {@link TypstGenerator.generate}. */
export interface GenerateOptions {
  /**
   * When true, emit human-readable Typst with section banners, component labels,
   * and multi-line indentation. Used for `.typ` download — not required for compile.
   * @default false
   */
  pretty?: boolean;
  /**
   * When true, tables without resolved data still render one placeholder detail
   * row so design preview/PDF mirrors the canvas structure.
   * @default true
   */
  renderDesignPlaceholders?: boolean;
}
