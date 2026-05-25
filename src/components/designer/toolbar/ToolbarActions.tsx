'use client';

import { exportReportPdf, type ExportProgress } from '@/lib/pdf-export';
import { useDesignerStore } from '@/store/designer-store';
import { Download, FileSpreadsheet, PanelRight, Play } from 'lucide-react';
import { memo, useState } from 'react';
import { ToolbarButton } from './ToolbarButton';

type ExportState = 'idle' | ExportProgress['stage'];

const EXPORT_LABEL: Record<ExportState, string> = {
  idle: 'Export PDF',
  compressing: 'Optimizing…',
  compiling: 'Compiling…',
  queued: 'Queued…',
  generating: 'Generating…',
  downloading: 'Downloading…',
};

export const ToolbarActions = memo(function ToolbarActions() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const isRightSidebarOpen = useDesignerStore((state) => state.isRightSidebarOpen);
  const toggleRightSidebar = useDesignerStore((state) => state.toggleRightSidebar);

  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const isExporting = exportState !== 'idle';
  const [isExcelExporting, setIsExcelExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExcelExporting(true);
    try {
      const { exportSchemaToExcel } = await import('@/lib/excel-export');
      await exportSchemaToExcel(schema, sampleData);
    } catch (error) {
      console.error('Export Excel failed:', error);
      useDesignerStore.getState().showDialog({
        title: 'Export Excel Failed',
        message: error instanceof Error ? error.message : 'Failed to export table data to Excel.',
        variant: 'danger',
        confirmLabel: 'Close',
      });
    } finally {
      setIsExcelExporting(false);
    }
  };

  const handleExport = async () => {
    setExportState('compiling');
    setExportProgress(5);

    try {
      await exportReportPdf(schema, sampleData, (p) => {
        setExportState(p.stage);
        setExportProgress(p.progress);
      });
    } catch (error) {
      console.error('Export failed:', error);
      useDesignerStore.getState().showDialog({
        title: 'Export Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate PDF. Check console for details.',
        variant: 'danger',
        confirmLabel: 'Close',
      });
    } finally {
      setExportState('idle');
      setExportProgress(0);
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

  const exportLabel =
    isExporting && exportProgress > 0
      ? `${EXPORT_LABEL[exportState]} ${exportProgress}%`
      : EXPORT_LABEL[exportState];

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
        icon={isExcelExporting ? undefined : FileSpreadsheet}
        label={isExcelExporting ? 'Exporting...' : 'Export Excel'}
        onClick={handleExportExcel}
        disabled={isExcelExporting || isExporting}
        variant="toolbar-item"
        title="Export tables data to Excel (.xlsx)"
        className="!h-7 !px-3 opacity-80 hover:opacity-100"
      >
        {isExcelExporting && (
          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin mr-1.5" />
        )}
      </ToolbarButton>

      <ToolbarButton
        icon={isExporting ? undefined : Play}
        label={exportLabel}
        onClick={handleExport}
        disabled={isExporting || isExcelExporting}
        variant="primary"
        title="Generate PDF (browser for small docs, server Typst CLI for 200+ pages)"
        className="!h-7 !px-3 shadow-sm shadow-[var(--accent-glow)]"
      >
        {isExporting && (
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
        )}
      </ToolbarButton>
    </div>
  );
});
