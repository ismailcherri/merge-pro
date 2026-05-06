import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as monaco from 'monaco-editor';

export interface EditorPaneHandle {
  getEditor(): monaco.editor.IStandaloneCodeEditor | null;
}

interface Props {
  value: string;
  language: string;
  readOnly: boolean;
  decorations: monaco.editor.IModelDeltaDecoration[];
  onScroll?: (scrollTop: number) => void;
  onDidScrollChange?: (e: monaco.IScrollEvent) => void;
}

export const EditorPane = forwardRef<EditorPaneHandle, Props>(function EditorPane(
  { value, language, readOnly, decorations, onDidScrollChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationCollectionRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const editor = monaco.editor.create(containerRef.current, {
      value,
      language,
      readOnly,
      theme: 'vs-dark',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 4,
      renderLineHighlight: 'none',
      scrollbar: { vertical: 'hidden', horizontal: 'auto' },
    });
    editorRef.current = editor;
    decorationCollectionRef.current = editor.createDecorationsCollection([]);

    if (onDidScrollChange) {
      editor.onDidScrollChange(onDidScrollChange);
    }

    return () => editor.dispose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount once

  // Sync value changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  // Sync decorations
  useEffect(() => {
    decorationCollectionRef.current?.set(decorations);
  }, [decorations]);

  return (
    <div ref={containerRef} style={{ flex: 1, height: '100%', minWidth: 0 }} />
  );
});
