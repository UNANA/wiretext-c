import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import { getFirstLine, getObjectTitle } from './objectLabel';

function makeObject(overrides: Partial<CanvasObject>): CanvasObject {
  return {
    id: 'obj-1',
    type: 'box',
    position: { col: 0, row: 0 },
    width: 10,
    height: 3,
    zIndex: 0,
    ...overrides,
  };
}

describe('getFirstLine', () => {
  it('returns the string unchanged when it has no newline (legacy single-line data)', () => {
    expect(getFirstLine('single line note')).toBe('single line note');
  });

  it('returns only the first line of a multi-line string', () => {
    expect(getFirstLine('line one\nline two\nline three')).toBe('line one');
  });

  it('returns an empty string for undefined', () => {
    expect(getFirstLine(undefined)).toBe('');
  });

  it('returns an empty string for an empty string', () => {
    expect(getFirstLine('')).toBe('');
  });

  it('handles a string that starts with a newline', () => {
    expect(getFirstLine('\nsecond line')).toBe('');
  });
});

describe('getObjectTitle', () => {
  it('collapses a multi-line annotation to its first line for a box', () => {
    const obj = makeObject({ type: 'box', annotation: 'TODO: fix this\nsee ticket #12' });
    expect(getObjectTitle(obj)).toBe('TODO: fix this');
  });

  it('falls back to label, then type, when there is no annotation', () => {
    expect(getObjectTitle(makeObject({ type: 'box', label: 'My Box' }))).toBe('My Box');
    expect(getObjectTitle(makeObject({ type: 'box' }))).toBe('box');
  });

  it('reads a single-line legacy annotation unchanged', () => {
    expect(getObjectTitle(makeObject({ type: 'box', annotation: 'legacy note' }))).toBe('legacy note');
  });

  it('collapses multi-line text content to its first line', () => {
    const obj = makeObject({ type: 'text', content: 'hello\nworld' });
    expect(getObjectTitle(obj)).toBe('hello');
  });

  it('prefers annotation over label for a connector', () => {
    const obj = makeObject({ type: 'line', isConnector: true, annotation: 'flow\nstep 1', label: 'edge' });
    expect(getObjectTitle(obj)).toBe('flow');
  });

  it('prefers annotation over label/componentType for a component', () => {
    const obj = makeObject({ type: 'component', componentType: 'button', annotation: 'submit\nform action' });
    expect(getObjectTitle(obj)).toBe('submit');
  });
});
