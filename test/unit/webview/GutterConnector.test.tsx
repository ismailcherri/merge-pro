import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GutterConnector } from '../../../webview/editor/GutterConnector';
import type { ConflictChunk } from '../../../src/protocol';

function makeChunk(baseStartLine: number, baseEndLine: number, type: 'conflict' | 'non-conflicting' = 'conflict'): ConflictChunk {
  return { type, oursLines: [], theirsLines: [], baseStartLine, baseEndLine };
}

// Mock line positions: 26px per line
const mockGetTop = (line: number) => (line - 1) * 26;

describe('GutterConnector', () => {
  it('renders an SVG with one polygon per chunk', () => {
    const chunks = [makeChunk(0, 2)];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop}
        rightGetTop={mockGetTop}
        height={300}
        width={58}
        scrollTop={0}
      />,
    );
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(1);
  });

  it('uses green fill for non-conflicting chunks', () => {
    const chunks = [makeChunk(0, 1, 'non-conflicting')];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop}
        rightGetTop={mockGetTop}
        height={300}
        width={58}
        scrollTop={0}
      />,
    );
    const polygon = container.querySelector('polygon')!;
    expect(polygon.getAttribute('fill')).toContain('98,178,98');
  });

  it('uses brown fill for conflict chunks', () => {
    const chunks = [makeChunk(0, 1, 'conflict')];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop}
        rightGetTop={mockGetTop}
        height={300}
        width={58}
        scrollTop={0}
      />,
    );
    const polygon = container.querySelector('polygon')!;
    expect(polygon.getAttribute('fill')).toContain('160,100,40');
  });
});
