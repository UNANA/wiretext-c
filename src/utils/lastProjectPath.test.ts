import { describe, expect, it } from 'vitest';
import { getLastProjectPath, setLastProjectPath } from './lastProjectPath';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('last project path', () => {
  it('round-trips the remembered path', () => {
    const storage = createStorage();
    expect(getLastProjectPath(storage)).toBeNull();
    setLastProjectPath('/Users/me/design.wiretext', storage);
    expect(getLastProjectPath(storage)).toBe('/Users/me/design.wiretext');
  });

  it('forgets the path when cleared', () => {
    const storage = createStorage();
    setLastProjectPath('/Users/me/design.wiretext', storage);
    setLastProjectPath(null, storage);
    expect(getLastProjectPath(storage)).toBeNull();
  });

  it('tolerates unavailable storage', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(getLastProjectPath(broken)).toBeNull();
    expect(() => setLastProjectPath('/tmp/a.wiretext', broken)).not.toThrow();
  });
});
