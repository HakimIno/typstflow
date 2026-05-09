import type { TextComponent } from '@/types/schema';
import { memo } from 'react';
import { TextEditor } from '../TextEditor';

interface EditorOverlayProps {
  component: TextComponent;
  sampleData: any;
  handleTextChange: (value: string) => void;
  handleExitEdit: () => void;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const EditorOverlay = memo(function EditorOverlay({
  component,
  sampleData,
  handleTextChange,
  handleExitEdit,
  editorContainerRef,
}: EditorOverlayProps) {
  return (
    <div
      ref={editorContainerRef}
      className="absolute inset-0 w-full h-full bg-white overflow-hidden"
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
          color: '#1e293b',
          minHeight: `${component.height || 20}px`,
          display: 'block',
        }}
        onExit={handleExitEdit}
      />
    </div>
  );
});
