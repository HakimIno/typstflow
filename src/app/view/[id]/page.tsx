import { CompiledReportViewer } from '@/components/viewer/CompiledReportViewer';
import { getShare } from '@/lib/server/share-db';
import { ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = getShare(id);
  if (!share) notFound();

  const createdDate = new Date(share.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="h-screen bg-[#0f0f12] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#18181f] shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-sm truncate max-w-xs">
            {share.name ?? 'Untitled Template'}
          </span>
          <span className="text-xs text-white/30">· Shared {createdDate}</span>
        </div>
        <Link
          href={`/designer?import=${share.id}`}
          className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open TypstFlow
        </Link>
      </header>

      {/* Canvas */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <CompiledReportViewer schema={share.schema} sampleData={share.sampleData} />
      </main>
    </div>
  );
}
