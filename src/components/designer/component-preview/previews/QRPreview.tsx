import { resolveBindings } from '@/lib/utils/json-path';
import type { QRComponent } from '@/types/schema';
import { memo } from 'react';

interface QRPreviewProps {
  component: QRComponent;
  sampleData: any;
}

export const QRPreview = memo(function QRPreview({
  component,
  sampleData,
}: QRPreviewProps) {
  const value = resolveBindings(component.value || '', sampleData);
  
  // Use a public QR code API for preview
  // Note: In production, you might want to use a local library to avoid external dependencies
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(value || 'TypstFlow')}`;

  return (
    <div className="w-full h-full bg-white border border-slate-200 flex flex-col items-center justify-center overflow-hidden p-1 shadow-sm rounded-sm">
      {value ? (
        <div className="flex-1 w-full h-full flex items-center justify-center min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={qrUrl} 
            alt="QR Code" 
            className="w-full h-full object-contain mix-blend-multiply"
            draggable={false}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-1">
          <svg className="w-1/2 h-1/2 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM3 14h7v7H3v-7zM14 14h3v3h-3v-3zM18 18h3v3h-3v-3zM14 18h3v3h-3v-3zM18 14h3v3h-3v-3z" />
          </svg>
          <span className="text-[8px] font-bold uppercase tracking-tighter opacity-40">No Data</span>
        </div>
      )}
    </div>
  );
});
