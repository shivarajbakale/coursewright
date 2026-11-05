import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useRouter } from '@tanstack/react-router';
import { signIn } from '@/lib/auth';
import { AuthLayout } from './AuthLayout';
import {
  Alert,
  Anchor,
  Box,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If a session already exists (dev auto-login, or signed-in earlier and
  // navigated back to /login), skip the form and head straight to the app.
  // AuthGuard would have bounced us anyway — this just saves a render.
  // Read localStorage directly so we always see the latest value (the module-
  // cached `current` from auth.ts can be stale across probe test cycles).
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('demo-session')) router.navigate({ to: '/' });
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email: data.email, password: data.password });
      if (result.error) setError(result.error.message || 'Invalid email or password');
      else router.navigate({ to: '/' });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Stack gap={6} mb="xl">
        <Title order={1} size="h3">
          Welcome back
        </Title>
        <Text size="sm" c="dimmed">
          Sign in to your account to continue.
        </Text>
      </Stack>

      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <Alert color="red" variant="light" mb="md">
            {error}
          </Alert>
        )}

        <Stack gap="md">
          {/* Mantine inputs own their label, description and error slot, so a
              field is one component rather than a Field/Label/Input/Description
              stack — and the error is wired to the control by `aria-describedby`
              without the page arranging it. */}
          <TextInput
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordInput
            id="password"
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            labelProps={{ style: { width: '100%' } }}
            description={
              <Anchor component="button" type="button" size="xs">
                Forgot password?
              </Anchor>
            }
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            {...register('password')}
          />

          <Stack gap="xs">
            <Button type="submit" fullWidth loading={loading}>
              Sign in
            </Button>
            <Button variant="default" type="button" fullWidth>
              Login with Google
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Text size="sm" c="dimmed" ta="center" mt="lg">
        Don&apos;t have an account?{' '}
        <Anchor component={Link} to="/signup" fw={500} c="var(--mantine-color-text)">
          Sign up
        </Anchor>
      </Text>
      <Text size="xs" c="dimmed" ta="center" mt="sm">
        Demo mode — any valid email and an 8+ character password works.
      </Text>
    </AuthLayout>
  );
}
