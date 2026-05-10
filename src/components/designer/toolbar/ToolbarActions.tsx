'use client';

import type { PdfExportStage } from '@/lib/typst-wasm';
import { useDesignerStore } from '@/store/designer-store';
import { Download, PanelRight, Play } from 'lucide-react';
import { memo, useState } from 'react';
import { ToolbarButton } from './ToolbarButton';

type ExportState = 'idle' | PdfExportStage;

const EXPORT_LABEL: Record<ExportState, string> = {
  idle: 'Export PDF',
  compressing: 'Optimizing...',
  compiling: 'Compiling...',
};

export const ToolbarActions = memo(function ToolbarActions() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const isRightSidebarOpen = useDesignerStore((state) => state.isRightSidebarOpen);
  const toggleRightSidebar = useDesignerStore((state) => state.toggleRightSidebar);

  const [exportState, setExportState] = useState<ExportState>('idle');
  const isExporting = exportState !== 'idle';

  const handleExport = async () => {
    const { renderReportToPdf } = await import('@/lib/typst-wasm');
    const { downloadPdf } = await import('@/lib/export-utils');

    setExportState('compressing');
    try {
      const pdfBytes = await renderReportToPdf(schema, sampleData, (stage) => {
        setExportState(stage);
      });
      downloadPdf(pdfBytes, `${schema.name || 'report'}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
      useDesignerStore.getState().showDialog({
        title: 'Export Failed',
        message: 'Failed to generate PDF. Check console for details.',
        variant: 'danger',
        confirmLabel: 'Close',
      });
    } finally {
      setExportState('idle');
    }
  };

  const handleDownloadSource = async () => {
    const { generateReportTypst } = await import('@/lib/typst-wasm');
    const { downloadText } = await import('@/lib/export-utils');

    try {
      const source = await generateReportTypst(schema, sampleData);
      downloadText(source, `${schema.name || 'report'}.typ`);
    } catch (error) {
      console.error('Download source failed:', error);
      useDesignerStore.getState().showDialog({
        title: 'Download Failed',
        message: 'Failed to generate Typst source file.',
        variant: 'danger',
        confirmLabel: 'Close',
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <ToolbarButton
        icon={PanelRight}
        onClick={toggleRightSidebar}
        active={isRightSidebarOpen}
        variant="toolbar-item"
        title="Toggle Properties Panel"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />

      <ToolbarButton
        icon={Download}
        onClick={handleDownloadSource}
        variant="toolbar-item"
        title="Download Typst Source (.typ)"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />

      <ToolbarButton
        icon={isExporting ? undefined : Play}
        label={EXPORT_LABEL[exportState]}
        onClick={handleExport}
        disabled={isExporting}
        variant="primary"
        title="Generate optimized PDF"
        className="!h-7 !px-3 shadow-sm shadow-[var(--accent-glow)]"
      >
        {isExporting && (
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
        )}
      </ToolbarButton>
    </div>
  );
});
