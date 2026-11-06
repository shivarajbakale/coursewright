import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installRandomUUID, uid } from './uid';
import { loadThread } from './tutor/threads';

afterEach(() => vi.restoreAllMocks());

describe('ids on plain-http pages (no crypto.randomUUID)', () => {
  it('still makes v4 ids, so opening the tutor cannot crash', () => {
    const original = crypto.randomUUID;
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
      expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(uid()).not.toBe(uid());
      expect(loadThread('ch1').threadId).toMatch(/^reader-ch1-[0-9a-f]{8}$/);
      installRandomUUID();
      expect(typeof crypto.randomUUID).toBe('function');
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});

describe('ErrorBoundary', () => {
  it('shows the fallback instead of blanking the screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary fallback={() => <Text>The tutor couldn't open.</Text>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("The tutor couldn't open.")).toBeInTheDocument();
  });
});
