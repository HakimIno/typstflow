import type { TextComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { memo } from 'react';
import { TextEditor } from '../TextEditor';

interface EditorOverlayProps {
  component: TextComponent;
  sampleData: any;
  handleTextChange: (value: string) => void;
  handleExitEdit: () => void;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  autoHeight?: boolean;
}

export const EditorOverlay = memo(function EditorOverlay({
  component,
  sampleData,
  handleTextChange,
  handleExitEdit,
  editorContainerRef,
  autoHeight = false,
}: EditorOverlayProps) {
  return (
    <div
      ref={editorContainerRef}
      className={clsx(
        'w-full bg-transparent overflow-hidden',
        autoHeight ? 'relative' : 'absolute inset-0 h-full'
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
      style={{
        display: 'flex',
        alignItems: (component.style as any)?.verticalAlign || 'flex-start',
        justifyContent:
          component.align === 'center'
            ? 'center'
            : component.align === 'right'
              ? 'flex-end'
              : component.align === 'justify'
                ? 'flex-start'
                : 'flex-start',
      }}
    >
      <TextEditor
        value={component.content || ''}
        onChange={handleTextChange}
        sampleData={sampleData}
        className="w-full h-full"
        placeholder=""
        inline={true}
        textStyle={component.style}
        style={{
          textAlign: component.align === 'justify' ? 'left' : component.align || 'left',
          minHeight: `${component.height || 20}px`,
          display: 'block',
        }}
        onExit={handleExitEdit}
        autoHeight={autoHeight}
      />
    </div>
  );
});
