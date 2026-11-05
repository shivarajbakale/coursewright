import React from 'react';
import { Button, Code, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { Spot } from '@/illustrations/spots';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Stack align="center" justify="center" gap={0} mih={400} p="xl" role="alert">
          <Spot kind="broken" width={200} />
          <Title order={2} size="h4" mt="sm" mb="xs">
            This screen stopped working
          </Title>
          <Text c="dimmed" ta="center" maw={448} mb="md">
            Something in the page broke while drawing it. Your courses and notes are safe. Try again, or go back to
            the library.
          </Text>
          {import.meta.env.DEV && this.state.error && (
            // Dev only: the message is for whoever is building the app, and it
            // is scrolled rather than clipped because a stack-ish message that
            // ends mid-word is worse than no message.
            <ScrollArea.Autosize mah={192} maw={512} mb="md">
              <Code block>{this.state.error.message}</Code>
            </ScrollArea.Autosize>
          )}
          <Group gap="sm">
            <Button onClick={this.handleReset}>Try again</Button>
            <Button variant="default" onClick={() => (window.location.href = '/')}>
              Back to the library
            </Button>
          </Group>
        </Stack>
      );
    }

    return this.props.children;
  }
}
