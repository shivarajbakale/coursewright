/**
 * Catches a render error so one broken part never blanks the whole reader. Without a boundary React
 * unmounts everything on an uncaught error, which is what "Ask tutor makes the screen go blank" was.
 */
import { Component, type ReactNode } from 'react';

type Props = { fallback: (reset: () => void) => ReactNode; children: ReactNode; onError?: (e: Error) => void };

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('[reader]', error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
