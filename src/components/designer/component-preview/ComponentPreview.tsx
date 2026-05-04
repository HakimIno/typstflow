import { useDesignerStore } from '@/store/designer-store';
import type {
  ComponentNode,
  PageNumberComponent,
  TableComponent,
  TextComponent,
} from '@/types/schema';
import { memo } from 'react';
import { TablePreview } from '../TablePreview';
import { BarcodePreview } from './previews/BarcodePreview';
import { ImagePreview } from './previews/ImagePreview';
import { LinePreview } from './previews/LinePreview';
import { PageBreakPreview } from './previews/PageBreakPreview';
import { PageNumberPreview } from './previews/PageNumberPreview';
import { SpacerPreview } from './previews/SpacerPreview';
import { SummaryBoxPreview } from './previews/SummaryBoxPreview';
import { TextPreview } from './previews/TextPreview';

interface Props {
  component: ComponentNode;
  pageIndex?: number;
  totalPages?: number;
}

export const ComponentPreview = memo(function ComponentPreview({
  component,
  pageIndex = 0,
  totalPages = 1,
}: Props) {
  const sampleData = useDesignerStore((state) => state.sampleData);

  switch (component.type) {
    case 'text':
      return <TextPreview component={component as TextComponent} sampleData={sampleData} />;
    case 'table':
      return <TablePreview component={component as TableComponent} />;
    case 'line':
      return <LinePreview component={component} />;
    case 'spacer':
      return <SpacerPreview component={component} />;
    case 'image':
      return <ImagePreview component={component} />;
    case 'barcode':
    case 'qr':
      return <BarcodePreview component={component} sampleData={sampleData} />;
    case 'summary-box':
      return <SummaryBoxPreview component={component} sampleData={sampleData} />;
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
    default:
      return <div>Preview for {component.type}</div>;
  }
});
