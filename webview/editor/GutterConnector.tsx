import { useMemo } from 'react';
import type { ConflictChunk } from '../../src/protocol';

interface Props {
  chunks: ConflictChunk[];
  leftGetTop: (line: number) => number;
  rightGetTop: (line: number) => number;
  height: number;
  width: number;
  scrollTop: number;
  onAcceptOurs?: (chunkIndex: number) => void;
  onAcceptTheirs?: (chunkIndex: number) => void;
}

const COLORS = {
  'non-conflicting': { fill: 'rgba(98,178,98,0.12)', stroke: 'rgba(98,178,98,0.3)' },
  'conflict':        { fill: 'rgba(160,100,40,0.18)', stroke: 'rgba(160,100,40,0.5)' },
  'resolved':        { fill: 'rgba(78,201,176,0.15)', stroke: 'rgba(78,201,176,0.5)' },
};

const HOVER_OURS = { fill: 'rgba(86,156,214,0.35)', stroke: 'rgba(86,156,214,0.8)' };
const HOVER_THEIRS = { fill: 'rgba(197,134,192,0.35)', stroke: 'rgba(197,134,192,0.8)' };

export function GutterConnector({ chunks, leftGetTop, rightGetTop, height, width, scrollTop, onAcceptOurs, onAcceptTheirs }: Props) {
  const halfW = width / 2;

  const elements = useMemo(() => {
    return chunks.map((chunk, i) => {
      const top = leftGetTop(chunk.baseStartLine + 1) - scrollTop;
      const bottom = leftGetTop(chunk.baseEndLine + 1) - scrollTop;

      const isResolved = chunk.resolvedWith !== undefined;
      const isConflict = chunk.type === 'conflict' && !isResolved;
      const colorKey = isResolved ? 'resolved' : chunk.type;
      const baseColor = COLORS[colorKey as keyof typeof COLORS] ?? COLORS.conflict;

      // Full polygon for non-conflicting or resolved chunks
      if (!isConflict) {
        return (
          <polygon
            key={`${chunk.baseStartLine}-${chunk.baseEndLine}`}
            points={`0,${top} 0,${bottom} ${width},${bottom} ${width},${top}`}
            fill={baseColor.fill}
            stroke={baseColor.stroke}
            strokeWidth={1}
          />
        );
      }

      // Split polygon: left half = Accept Ours, right half = Accept Theirs
      const midY = (top + bottom) / 2;
      return (
        <g key={`${chunk.baseStartLine}-${chunk.baseEndLine}`}>
          {/* Left triangle: Accept Ours */}
          <polygon
            points={`0,${top} 0,${bottom} ${halfW},${midY}`}
            fill={baseColor.fill}
            stroke={baseColor.stroke}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onAcceptOurs?.(i)}
            onMouseEnter={(e) => {
              e.currentTarget.setAttribute('fill', HOVER_OURS.fill);
              e.currentTarget.setAttribute('stroke', HOVER_OURS.stroke);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.setAttribute('fill', baseColor.fill);
              e.currentTarget.setAttribute('stroke', baseColor.stroke);
            }}
          />
          {/* Right triangle: Accept Theirs */}
          <polygon
            points={`${halfW},${midY} ${width},${top} ${width},${bottom}`}
            fill={baseColor.fill}
            stroke={baseColor.stroke}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onAcceptTheirs?.(i)}
            onMouseEnter={(e) => {
              e.currentTarget.setAttribute('fill', HOVER_THEIRS.fill);
              e.currentTarget.setAttribute('stroke', HOVER_THEIRS.stroke);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.setAttribute('fill', baseColor.fill);
              e.currentTarget.setAttribute('stroke', baseColor.stroke);
            }}
          />
        </g>
      );
    });
  }, [chunks, leftGetTop, rightGetTop, width, scrollTop, onAcceptOurs, onAcceptTheirs]);

  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      {elements}
    </svg>
  );
}
