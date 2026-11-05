import { describe, expect, it } from 'vitest';
import { errorDetail, errorKind } from './errors';

describe('errorKind', () => {
  it('reads a network failure or a proxy without a backend as offline', () => {
    expect(errorKind({ message: 'Network error: Unable to reach the server', status: 0 })).toBe('offline');
    expect(errorKind({ message: 'An error occurred', status: 502 })).toBe('offline');
  });
  it('separates missing from broken', () => {
    expect(errorKind({ message: 'Not found', status: 404 })).toBe('missing');
    expect(errorKind({ message: 'An error occurred', status: 500 })).toBe('server');
    expect(errorKind({ message: 'Bad input', status: 422 })).toBe('other');
  });
});

describe('errorDetail', () => {
  it('drops stock phrases and keeps a real message', () => {
    expect(errorDetail({ message: 'An error occurred' })).toBeNull();
    expect(errorDetail({ message: 'Network error: Unable to reach the server', status: 0 })).toBeNull();
    expect(errorDetail({ message: 'database is locked', status: 500 })).toBe('database is locked');
  });
});
