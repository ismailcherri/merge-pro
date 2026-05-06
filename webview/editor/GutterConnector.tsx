import { useMemo } from 'react';
import type { ConflictChunk } from '../../src/protocol';

interface Props {
  chunks: ConflictChunk[];
  /** Returns pixel top for a 1-indexed line number, not accounting for scroll */
  leftGetTop: (line: number) => number;
  rightGetTop: (line: number) => number;
  height: number;
  width: number;
  scrollTop: number;
}

const COLORS = {
  'non-conflicting': { fill: 'rgba(98,178,98,0.28)', stroke: 'rgba(98,178,98,0.6)' },
  'conflict':        { fill: 'rgba(160,100,40,0.28)', stroke: 'rgba(160,100,40,0.6)' },
  'resolved':        { fill: 'rgba(78,201,176,0.28)', stroke: 'rgba(78,201,176,0.6)' },
};

export function GutterConnector({ chunks, leftGetTop, rightGetTop, height, width, scrollTop }: Props) {
  const polygons = useMemo(() => {
    return chunks.map((chunk, i) => {
      // Line numbers are 1-indexed in Monaco; baseStartLine is 0-indexed
      const leftTop    = leftGetTop(chunk.baseStartLine + 1) - scrollTop;
      const leftBottom = leftGetTop(chunk.baseEndLine + 1) - scrollTop;
      const rightTop    = rightGetTop(chunk.baseStartLine + 1) - scrollTop;
      const rightBottom = rightGetTop(chunk.baseEndLine + 1) - scrollTop;

      const colorKey = chunk.resolvedWith !== undefined ? 'resolved' : chunk.type;
      const { fill, stroke } = COLORS[colorKey as keyof typeof COLORS] ?? COLORS.conflict;

      // Polygon: left edge (x=0) connects to right edge (x=width)
      // Points: top-left, bottom-left, bottom-right, top-right
      const points = `0,${leftTop} 0,${leftBottom} ${width},${rightBottom} ${width},${rightTop}`;

      return <polygon key={`${chunk.baseStartLine}-${chunk.baseEndLine}`} points={points} fill={fill} stroke={stroke} strokeWidth={1} />;
    });
  }, [chunks, leftGetTop, rightGetTop, width, scrollTop]);

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden
    >
      {polygons}
    </svg>
  );
}
