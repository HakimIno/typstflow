import { useDesignerStore } from '@/store/designer-store';
import type {
  ChecklistComponent,
  ColumnLayoutComponent,
  ComponentNode,
  PageNumberComponent,
  QRComponent,
  RectangleComponent,
  SignatureComponent,
  TableComponent,
  TextComponent,
} from '@/types/schema';
import { memo } from 'react';
import { TablePreview } from '../TablePreview';
import { BarcodePreview } from './previews/BarcodePreview';
import { ChecklistPreview } from './previews/ChecklistPreview';
import { ColumnLayoutPreview } from './previews/ColumnLayoutPreview';
import { ImagePreview } from './previews/ImagePreview';
import { LinePreview } from './previews/LinePreview';
import { PageBreakPreview } from './previews/PageBreakPreview';
import { PageNumberPreview } from './previews/PageNumberPreview';
import { QRPreview } from './previews/QRPreview';
import { RectanglePreview } from './previews/RectanglePreview';
import { SignaturePreview } from './previews/SignaturePreview';
import { SpacerPreview } from './previews/SpacerPreview';
import { SummaryBoxPreview } from './previews/SummaryBoxPreview';
import { TextPreview } from './previews/TextPreview';

interface Props {
  component: ComponentNode;
  pageIndex?: number;
  totalPages?: number;
  autoHeight?: boolean;
}

export const ComponentPreview = memo(function ComponentPreview({
  component,
  pageIndex = 0,
  totalPages = 1,
  autoHeight,
}: Props) {
  const sampleData = useDesignerStore((state) => state.sampleData);

  switch (component.type) {
    case 'text':
      return (
        <TextPreview
          component={component as TextComponent}
          sampleData={sampleData}
          autoHeight={autoHeight}
        />
      );
    case 'table':
      return <TablePreview component={component as TableComponent} />;
    case 'line':
      return <LinePreview component={component} />;
    case 'spacer':
      return <SpacerPreview component={component} />;
    case 'image':
      return <ImagePreview component={component} />;
    case 'barcode':
      return <BarcodePreview component={component} sampleData={sampleData} />;
    case 'qr':
      return <QRPreview component={component as QRComponent} sampleData={sampleData} />;
    case 'summary-box':
      return <SummaryBoxPreview component={component} sampleData={sampleData} />;
    case 'columns':
      return (
        <ColumnLayoutPreview
          component={component as ColumnLayoutComponent}
          pageIndex={pageIndex}
          totalPages={totalPages}
        />
      );
    case 'page-break-indicator':
      return (
        <PageBreakPreview component={component} pageIndex={pageIndex} totalPages={totalPages} />
      );
    case 'page-number':
      return (
        <PageNumberPreview
          component={component as PageNumberComponent}
          pageIndex={pageIndex}
          totalPages={totalPages}
        />
      );
    case 'checklist':
      return (
        <ChecklistPreview component={component as ChecklistComponent} sampleData={sampleData} />
      );
    case 'rectangle':
      return <RectanglePreview component={component as RectangleComponent} />;
    case 'signature':
      return <SignaturePreview component={component as SignatureComponent} />;
    default:
      return <div>Preview for {component.type}</div>;
  }
});
