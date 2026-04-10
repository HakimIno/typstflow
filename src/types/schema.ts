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
  | SummaryBoxComponent;

export interface BaseComponent {
  id: string;
  type: ComponentNode['type'];
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
}

// --- Table Component ---
export interface TableComponent extends BaseComponent {
  type: 'table';
  dataSource: BindingExpression; // "{{invoice.items}}"
  columns: TableColumn[];
  style: TableStyle;
  showHeader: boolean;
  repeatHeaderOnPage: boolean;
  summaryRows?: SummaryRow[];
}

export interface TableColumn {
  id: string;
  header: string;
  field: string; // "item.description" relative to dataSource
  width: 'auto' | '1fr' | string; // "30%", "4cm"
  align?: 'left' | 'center' | 'right';
  format?: FormatType;
  style?: TextStyle;
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
  src: string; // path or "{{company.logo_url}}"
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
