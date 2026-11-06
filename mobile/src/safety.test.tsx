import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { ErrorBoundary } from './components/ErrorBoundary';
import { fallbackUid, installRandomUUID, uid } from './uid';
import { loadThread } from './tutor/threads';

afterEach(() => vi.restoreAllMocks());

describe('ids on plain-http pages (no crypto.randomUUID)', () => {
  it('still makes v4 ids, and the installed stand-in never calls itself', () => {
    const original = crypto.randomUUID;
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
      const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(fallbackUid()).toMatch(v4);
      expect(fallbackUid()).not.toBe(fallbackUid());
      installRandomUUID();
      // The page-freezing bug: the stand-in looked randomUUID up again and recursed forever.
      expect(crypto.randomUUID()).toMatch(v4);
      expect(uid()).toMatch(v4);
      expect(loadThread('ch1').threadId).toMatch(/^reader-ch1-[0-9a-f]{8}$/);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true, writable: true });
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
