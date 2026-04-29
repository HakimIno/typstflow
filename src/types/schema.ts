export interface LayoutSchema {
  id: string;
  name: string;
  version: string; // "1.0.0"
  page: PageConfig;
  fonts: FontConfig[];
  zones: {
    header: Zone;
    body: Zone;
    footer: Zone;
  };
  variables: VariableDefinition[]; // user-defined reusable values
  dataSchema: DataFieldDefinition[]; // expected input data shape
  metadata: {
    createdAt: string;
    updatedAt: string;
    author: string;
  };
}

export interface PageConfig {
  size: 'A4' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margin: {
    top: string; // CSS-like: "2cm", "20mm", "56pt"
    bottom: string;
    left: string;
    right: string;
  };
  background?: string; // hex color or image path
}

export interface FontConfig {
  family: string; // "Sarabun", "Noto Sans Thai"
  role: 'body' | 'heading' | 'mono';
  size: number; // pt
  embedded: boolean; // must be true for PDF
}

export interface Zone {
  id: string;
  components: ComponentNode[];
  minHeight?: string;
  background?: string;
  padding?: string;
  showOnFirstPageOnly?: boolean; // for header
  showOnLastPageOnly?: boolean; // for footer
}

export type ComponentNode =
  | TextComponent
  | TableComponent
  | ImageComponent
  | LineComponent
  | SpacerComponent
  | RepeaterComponent
  | ColumnLayoutComponent
  | BarcodeComponent
  | QRComponent
  | SummaryBoxComponent
  | PageBreakIndicatorComponent;

export interface BaseComponent {
  id: string;
  type: ComponentNode['type'];
  name?: string; // Custom display name for layers panel
  visible?: BindingExpression; // "{{invoice.show_discount}}"
  x?: number; // Absolute X in mm
  y?: number; // Absolute Y in mm
  width?: number; // Width in mm
  height?: number; // Height in mm
  marginTop?: string;
  marginBottom?: string;
  pageBreakBefore?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
}

// --- Text Component ---
export interface TextComponent extends BaseComponent {
  type: 'text';
  content: string; // "{{customer.name}}" or static
  style: TextStyle;
}

export interface TextStyle {
  fontSize?: number;
  fontWeight?: 'regular' | 'medium' | 'bold';
  color?: string; // hex
  italic?: boolean;
  underline?: boolean;
  textTransform?: 'none' | 'upper' | 'lower' | 'title';
  lineHeight?: number; // scale: 1.2
  letterSpacing?: string; // e.g. "0.05em"
  justify?: boolean;
}

// --- Stroke Configuration (maps to Typst stroke dictionary) ---
export interface StrokeConfig {
  top?: string;    // e.g. "1pt + black"
  bottom?: string;
  left?: string;
  right?: string;
}

// --- Table Cell (maps to Typst table.cell) ---
export interface TableCell {
  id: string;
  content: string;        // static text or {{binding}}
  colspan?: number;
  rowspan?: number;
  align?: 'left' | 'center' | 'right';
  fill?: string;           // per-cell background color
  stroke?: StrokeConfig;   // per-cell border override
  inset?: string;          // per-cell padding override
  style?: TextStyle;       // per-cell text style
}

// --- Table Row (maps to table.header / table.footer / data rows) ---
export interface TableRow {
  id: string;
  type: 'header' | 'data' | 'footer';
  cells: TableCell[];
  height?: string;        // row height (e.g. "30pt", "auto")
  repeat?: boolean;       // for header/footer: repeat across pages
}

// --- Horizontal / Vertical Line (maps to table.hline / table.vline) ---
export interface HLineConfig {
  id: string;
  y: number;               // row position (zero-indexed)
  start?: number;          // start column (zero-indexed, inclusive)
  end?: number;            // end column (zero-indexed, exclusive)
  stroke?: string;         // e.g. "1pt + red"
  position?: 'top' | 'bottom';
}

export interface VLineConfig {
  id: string;
  x: number;               // column position (zero-indexed)
  start?: number;          // start row (zero-indexed, inclusive)
  end?: number;            // end row (zero-indexed, exclusive)
  stroke?: string;         // e.g. "1pt + blue"
  position?: 'start' | 'end';
}

// --- Fill Pattern Presets ---
export type FillPattern =
  | 'none'
  | 'striped-rows'
  | 'striped-cols'
  | 'checkerboard'
  | 'header-only'
  | 'custom';

// --- Table Component ---
export interface TableComponent extends BaseComponent {
  type: 'table';
  dataSource: BindingExpression; // "{{invoice.items}}"
  columns: TableColumn[];
  style: TableStyle;
  showHeader: boolean;
  repeatHeaderOnPage: boolean;
  isStatic?: boolean; // If true, the table does NOT loop over dataSource
  summaryRows?: SummaryRow[];
  // --- New: Structured rows for multi-row header/footer ---
  headerRows?: TableRow[];   // structured header rows
  detailRows?: TableRow[];   // structured data rows for loops (replaces strict column looping)
  footerRows?: TableRow[];   // structured footer rows
  // --- New: Manual lines ---
  hlines?: HLineConfig[];    // manual horizontal lines
  vlines?: VLineConfig[];    // manual vertical lines
}

export interface TableColumn {
  id: string;
  header: string;
  field: string; // "item.description" relative to dataSource
  width: 'auto' | '1fr' | string; // "30%", "4cm"
  align?: 'left' | 'center' | 'right';
  format?: FormatType;
  style?: TextStyle;
  borderWidth?: string;
  borderColor?: string;
  background?: string;
  colspan?: number;
  rowspan?: number;
}

export interface TableStyle {
  headerBackground?: string;
  headerTextColor?: string;
  alternateRowBackground?: string;
  borderColor?: string;
  borderWidth?: string;
  cellPadding?: string;
  fontSize?: number;
  fontWeight?: 'regular' | 'medium' | 'bold';
  lineHeight?: number;
  letterSpacing?: string;
  justify?: boolean;
  cellStyles?: Record<string, CellStyle>; // Keys: "header:col", "row:col", "data:col"
  headerRows?: number;
  footerRows?: number;
  rowHeights?: string[];
  gutter?: string; // padding between cells
  // --- New: Typst table API extensions ---
  inset?: string;                       // global cell padding (e.g. "7pt")
  fillPattern?: FillPattern;            // fill pattern preset
  stripedColor1?: string;               // even row/col color for patterns
  stripedColor2?: string;               // odd row/col color for patterns
  stroke?: string | StrokeConfig;       // global stroke config
  columnGutter?: string;                // space between columns
  rowGutter?: string;                   // space between rows
}

export interface CellStyle {
  fill?: string;
  stroke?: string | { top?: string; bottom?: string; left?: string; right?: string };
  align?: 'left' | 'center' | 'right';
  weight?: 'bold' | 'regular';
  size?: number;
  color?: string;
}

export interface SummaryRow {
  label: string;
  value: BindingExpression; // "{{formatTHB(invoice.subtotal)}}"
  style?: TextStyle;
  separator?: boolean;
}

// --- Image Component ---
export interface ImageComponent extends BaseComponent {
  type: 'image';
  src: string;       // display URL (shown in designer canvas preview)
  srcData?: string;  // base64 data URL (data:image/png;base64,...) — used by WASM
  mimeType?: string; // e.g. "image/png", "image/jpeg", "image/webp"
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'stretch';
}

// --- Line Component ---
export interface LineComponent extends BaseComponent {
  type: 'line';
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  thickness?: string;
}

// --- Spacer Component ---
export interface SpacerComponent extends BaseComponent {
  type: 'spacer';
  height: number;
}

// --- Repeater Component ---
export interface RepeaterComponent extends BaseComponent {
  type: 'repeater';
  dataSource: BindingExpression;
  children: ComponentNode[];
  columns?: number; // multi-column layout
}

// --- Column Layout ---
export interface ColumnLayoutComponent extends BaseComponent {
  type: 'columns';
  columns: {
    width: string;
    components: ComponentNode[];
  }[];
  gap?: string;
}

// --- Barcode Component ---
export interface BarcodeComponent extends BaseComponent {
  type: 'barcode';
  value: BindingExpression;
  format: 'code128' | 'ean13' | 'pdf417';
  width?: number;
  height?: number;
}

// --- QR Component ---
export interface QRComponent extends BaseComponent {
  type: 'qr';
  value: BindingExpression;
  width?: number;
  height?: number;
}

// --- Summary Box ---
export interface SummaryBoxComponent extends BaseComponent {
  type: 'summary-box';
  rows: {
    label: string;
    value: BindingExpression;
    style?: 'normal' | 'subtotal' | 'total' | 'highlight';
  }[];
  width?: number;
}

// --- Page Break Indicator ---
export interface PageBreakIndicatorComponent extends BaseComponent {
  type: 'page-break-indicator';
  label?: string; // Optional label like "Continued on next page..."
  style?: 'solid' | 'dashed' | 'dotted';
  showPageNumber?: boolean; // Show "Page X of Y"
}

// --- Supporting Types ---
export type BindingExpression = string; // "{{...}}" or static string
export type FormatType =
  | 'text'
  | 'number'
  | 'currency-thb'
  | 'currency-usd'
  | 'date-th'
  | 'date-en'
  | 'percent'
  | 'boolean';

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'color';
  defaultValue: string | number | boolean;
  description?: string;
}

export interface DataFieldDefinition {
  path: string; // "invoice.customer.name"
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  required: boolean;
  description?: string;
  example?: unknown;
}
