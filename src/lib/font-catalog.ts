const GH = 'https://raw.githubusercontent.com/google/fonts/main';

export interface CatalogFont {
  family: string;
  label: string;
  builtIn: boolean;
  category: 'thai' | 'latin' | 'mono';
  sampleText?: string;
  /**
   * GitHub raw URLs keyed by weight (400 = Regular, 700 = Bold).
   * For variable fonts, use the same URL for all weights and set variable: true.
   */
  githubUrls?: Record<number, string>;
  /** True if this is an OpenType variable font (one file covers all weights). */
  variable?: boolean;
}

export const FONT_CATALOG: CatalogFont[] = [
  // Built-in (already embedded in WASM — no download needed)
  { family: 'Sarabun', label: 'Sarabun', builtIn: true, category: 'thai', sampleText: 'สวัสดี Aa' },

  // Thai
  // === Thai fonts — static TTF ===
  {
    family: 'Noto Sans Thai',
    label: 'Noto Sans Thai',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf` },
  },
  {
    family: 'Noto Serif Thai',
    label: 'Noto Serif Thai',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/notoserifthai/NotoSerifThai%5Bwdth%2Cwght%5D.ttf` },
  },
  {
    family: 'IBM Plex Sans Thai',
    label: 'IBM Plex Sans Thai',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    githubUrls: {
      400: `${GH}/ofl/ibmplexsansthai/IBMPlexSansThai-Regular.ttf`,
      700: `${GH}/ofl/ibmplexsansthai/IBMPlexSansThai-Bold.ttf`,
    },
  },
  {
    family: 'Prompt',
    label: 'Prompt',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    githubUrls: {
      400: `${GH}/ofl/prompt/Prompt-Regular.ttf`,
      700: `${GH}/ofl/prompt/Prompt-Bold.ttf`,
    },
  },
  {
    family: 'Kanit',
    label: 'Kanit',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    githubUrls: {
      400: `${GH}/ofl/kanit/Kanit-Regular.ttf`,
      700: `${GH}/ofl/kanit/Kanit-Bold.ttf`,
    },
  },
  {
    family: 'Mitr',
    label: 'Mitr',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    githubUrls: {
      400: `${GH}/ofl/mitr/Mitr-Regular.ttf`,
      700: `${GH}/ofl/mitr/Mitr-Bold.ttf`,
    },
  },
  {
    family: 'Chakra Petch',
    label: 'Chakra Petch',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    githubUrls: {
      400: `${GH}/ofl/chakrapetch/ChakraPetch-Regular.ttf`,
      700: `${GH}/ofl/chakrapetch/ChakraPetch-Bold.ttf`,
    },
  },
  {
    family: 'Chonburi',
    label: 'Chonburi (Display)',
    builtIn: false,
    category: 'thai',
    sampleText: 'สวัสดี Aa',
    githubUrls: { 400: `${GH}/ofl/chonburi/Chonburi-Regular.ttf` },
  },

  // === Latin fonts ===
  {
    family: 'Inter',
    label: 'Inter',
    builtIn: false,
    category: 'latin',
    sampleText: 'The quick brown fox',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf` },
  },
  {
    family: 'Roboto',
    label: 'Roboto',
    builtIn: false,
    category: 'latin',
    sampleText: 'The quick brown fox',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf` },
  },
  {
    family: 'Open Sans',
    label: 'Open Sans',
    builtIn: false,
    category: 'latin',
    sampleText: 'The quick brown fox',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf` },
  },
  {
    family: 'Lato',
    label: 'Lato',
    builtIn: false,
    category: 'latin',
    sampleText: 'The quick brown fox',
    githubUrls: {
      400: `${GH}/ofl/lato/Lato-Regular.ttf`,
      700: `${GH}/ofl/lato/Lato-Bold.ttf`,
    },
  },
  {
    family: 'Playfair Display',
    label: 'Playfair Display',
    builtIn: false,
    category: 'latin',
    sampleText: 'Elegant Serif',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf` },
  },

  // === Monospace fonts ===
  {
    family: 'Noto Sans Mono',
    label: 'Noto Sans Mono',
    builtIn: false,
    category: 'mono',
    sampleText: 'code { }',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/notosansmono/NotoSansMono%5Bwdth%2Cwght%5D.ttf` },
  },
  {
    family: 'JetBrains Mono',
    label: 'JetBrains Mono',
    builtIn: false,
    category: 'mono',
    sampleText: 'code { }',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf` },
  },
  {
    family: 'Fira Code',
    label: 'Fira Code',
    builtIn: false,
    category: 'mono',
    sampleText: 'code { }',
    variable: true,
    githubUrls: { 400: `${GH}/ofl/firacode/FiraCode%5Bwght%5D.ttf` },
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  thai: 'Thai',
  latin: 'Latin',
  mono: 'Monospace',
};
