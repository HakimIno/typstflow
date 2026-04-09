'use client';

import React, { useState, useEffect } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Database, AlertCircle, CheckCircle2, ChevronRight, Braces } from 'lucide-react';
import { clsx } from 'clsx';

export function DataPanel() {
  const { sampleData, setSampleData } = useDesignerStore();
  const [jsonString, setJsonString] = useState(JSON.stringify(sampleData, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Keep local sync if store changes externally
    setJsonString(JSON.stringify(sampleData, null, 2));
  }, [sampleData]);

  const handleJsonChange = (val: string) => {
    setJsonString(val);
    try {
      if (!val.trim()) {
        setSampleData({});
        setError(null);
        return;
      }
      const parsed = JSON.parse(val);
      setSampleData(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadExample = () => {
    const example = {
      invoice_no: "INV-2024-888",
      date: "2024-04-09",
      customer: {
        name: "บริษัท เทคโนโลยี จำกัด",
        address: "123 ถนนสุขุมวิท กรุงเทพฯ"
      },
      items: [
        { description: "Industrial Controller v2", qty: 2, price: 15000, total: 30000 },
        { description: "Sensor Array XP", qty: 5, price: 2500, total: 12500 }
      ],
      subtotal: 42500,
      vat: 2975,
      total: 45475
    };
    handleJsonChange(JSON.stringify(example, null, 2));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-3 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-1.5 text-slate-700">
              <Braces className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Sample JSON Data</span>
           </div>
           <button 
             onClick={loadExample}
             className="text-[10px] text-blue-600 hover:underline font-bold"
           >
             Load Example
           </button>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-1">
          Define mock data to test bindings like <code className="bg-slate-100 px-1 truncate">{"{{customer.name}}"}</code> in real-time.
        </p>
      </div>

      <div className="flex-1 relative overflow-hidden group">
        <textarea
           value={jsonString}
           onChange={(e) => handleJsonChange(e.target.value)}
           spellCheck={false}
           className={clsx(
             "absolute inset-0 w-full h-full p-4 font-mono text-[11px] resize-none focus:ring-0 border-none transition-colors",
             error ? "bg-red-50/30" : "bg-white group-hover:bg-slate-50/50"
           )}
           placeholder='{ "key": "value" }'
        />
        
        {/* Error/Success Indicator */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
           {error ? (
             <div className="flex items-center gap-1 px-2 py-1 bg-white border border-red-200 rounded shadow-sm text-red-600 animate-in fade-in slide-in-from-right-2">
               <AlertCircle className="w-3 h-3" />
               <span className="text-[9px] font-bold uppercase">Invalid JSON</span>
             </div>
           ) : (
             <div className="flex items-center gap-1 px-2 py-1 bg-white border border-green-200 rounded shadow-sm text-green-600">
               <CheckCircle2 className="w-3 h-3" />
               <span className="text-[9px] font-bold uppercase">Valid Data</span>
             </div>
           )}
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-600 text-white text-[9px] font-mono whitespace-pre-wrap break-all border-t border-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
