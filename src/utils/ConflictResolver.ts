import type { ConflictChunk } from '../protocol';

function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Applies chunk resolution decisions to baseText, returning the resolved file content.
 * Chunks without resolvedWith leave the base content unchanged.
 */
export function resolveFile(baseText: string, chunks: ConflictChunk[]): string {
  const baseLines = splitLines(baseText);
  const sorted = [...chunks].sort((a, b) => a.baseStartLine - b.baseStartLine);

  const output: string[] = [];
  let baseCursor = 0;

  for (const chunk of sorted) {
    // Copy unmodified base lines before this chunk
    output.push(...baseLines.slice(baseCursor, chunk.baseStartLine));
    baseCursor = chunk.baseEndLine;

    if (chunk.resolvedWith === undefined) {
      // Keep base lines as-is for unresolved chunks
      output.push(...baseLines.slice(chunk.baseStartLine, chunk.baseEndLine));
    } else if (chunk.resolvedWith === 'ours') {
      output.push(...chunk.oursLines);
    } else if (chunk.resolvedWith === 'theirs') {
      output.push(...chunk.theirsLines);
    } else if (chunk.resolvedWith === 'manual' && chunk.manualLines) {
      output.push(...chunk.manualLines);
    }
  }

  // Copy remaining base lines after last chunk
  output.push(...baseLines.slice(baseCursor));

  return output.join('\n');
}
