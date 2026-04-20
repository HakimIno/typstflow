'use client';

import { memo, useState } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Download, Play, PanelRight, Save } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const ToolbarActions = memo(function ToolbarActions() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const isRightSidebarOpen = useDesignerStore((state) => state.isRightSidebarOpen);
  const toggleRightSidebar = useDesignerStore((state) => state.toggleRightSidebar);
  
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const { renderReportToPdf } = await import('@/lib/typst-wasm');
    const { downloadPdf } = await import('@/lib/export-utils');

    setIsExporting(true);
    try {
      const pdfBytes = await renderReportToPdf(schema, sampleData);
      downloadPdf(pdfBytes, `${schema.name || 'report'}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setIsExporting(false);
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
      alert('Failed to generate source.');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <ToolbarButton
        icon={PanelRight}
        onClick={toggleRightSidebar}
        active={isRightSidebarOpen}
        title="Toggle Properties Panel"
      />

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <ToolbarButton
        icon={Download}
        label="Source"
        onClick={handleDownloadSource}
        title="Download Typst Source (.typ)"
      />
      
      <ToolbarButton
        icon={isExporting ? undefined : Play}
        label={isExporting ? "Exporting..." : "Run PDF"}
        onClick={handleExport}
        disabled={isExporting}
        variant="primary"
        title="Generate Final PDF"
      >
        {isExporting && (
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
        )}
      </ToolbarButton>
    </div>
  );
});
