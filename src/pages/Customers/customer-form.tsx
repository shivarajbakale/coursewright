import {
  Box,
  Button,
  Fieldset,
  Group,
  LoadingOverlay,
  NumberInput,
  SegmentedControl,
  Stack,
  TextInput,
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateCustomer } from '@/hooks/useCustomers';

/**
 * New-customer form.
 *
 * React Hook Form + Zod: the resolver, the schema and the mutation are the
 * parts worth copying. A Mantine input owns its label, description and error
 * slot, and wires `aria-describedby` itself, so a field is one component — no
 * Form/FormField/FormItem/FormLabel/FormControl/FormMessage scaffolding.
 *
 * `register()` for the plain inputs; `Controller` for `SegmentedControl` and
 * `NumberInput`, because they report a value rather than an event.
 *
 * The plan picker is a `SegmentedControl` rather than a `Select`: four
 * mutually-exclusive tiers that all fit on one line should be visible, not
 * hidden behind a click. It also keeps a known landmine out of the test suite —
 * mounting a Mantine `Select` under jsdom costs upwards of twenty seconds (see
 * its entry in `.claude/skills/use-mantine/mantine-capabilities.md`), which is
 * the difference between a suite that runs in `make check` and one nobody
 * waits for.
 *
 * Copy this shape for any new resource form.
 */
const schema = z.object({
  name: z.string().min(2, 'Give the account a name'),
  domain: z
    .string()
    // Not `z.string().url()`: an account is identified by its bare domain, and
    // a validator that demands a scheme makes every user type `https://` into a
    // field that then displays it back without one.
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, 'Use a bare domain, e.g. acme.com'),
  plan: z.enum(['free', 'pro', 'business', 'enterprise']),
  seats: z.number().int().min(1, 'At least one seat').max(10_000),
});

type FormValues = z.infer<typeof schema>;

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function CustomerForm({
  onCreated,
  onCancel,
}: {
  onCreated?: (id: string) => void;
  onCancel?: () => void;
}) {
  const create = useCreateCustomer();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', domain: '', plan: 'pro', seats: 5 },
  });

  const onSubmit = (values: FormValues) =>
    create.mutate(values, {
      onSuccess: customer => {
        reset();
        onCreated?.(customer.id);
      },
    });

  return (
    <Box pos="relative">
      {/* The submit button already shows a spinner; this covers the *fields*.
          A create that takes a second leaves four editable inputs behind a
          button that says it is busy, and the second edit is the one that gets
          lost. `LoadingOverlay` needs a positioned parent, and it does not
          disable anything on its own — hence `fieldset disabled`, which takes
          every control inside out of the tab order in one prop. */}
      <LoadingOverlay
        visible={create.isPending}
        zIndex={1}
        overlayProps={{ blur: 1 }}
        loaderProps={{ size: 'sm' }}
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Fieldset variant="unstyled" disabled={create.isPending}>
          <Stack gap="md">
            {/* `data-autofocus`, not `autoFocus`: inside a Modal it is Mantine's
            focus trap that decides where focus lands once the open transition
            finishes, and this is the attribute it looks for. Without it the
            trap parks focus on the close button and the first keystroke of a
            user who starts typing immediately is lost. */}
            <TextInput
              label="Account name"
              placeholder="e.g. Northwind Labs"
              data-autofocus
              error={errors.name?.message}
              {...register('name')}
            />

            <TextInput
              label="Domain"
              placeholder="northwind.io"
              description="Used to match users to this account when they sign up."
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              error={errors.domain?.message}
              {...register('domain')}
            />

            <Controller
              control={control}
              name="plan"
              render={({ field }) => (
                <div>
                  <SegmentedControl
                    size="sm"
                    fullWidth
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-label="Plan"
                    data={PLAN_OPTIONS}
                  />
                </div>
              )}
            />

            <Controller
              control={control}
              name="seats"
              render={({ field }) => (
                <NumberInput
                  label="Seats"
                  description="Pro bills $29 a seat, Business $79. Enterprise is contracted."
                  inputWrapperOrder={['label', 'input', 'description', 'error']}
                  min={1}
                  max={10_000}
                  clampBehavior="strict"
                  value={field.value}
                  onChange={v => field.onChange(typeof v === 'number' ? v : Number(v) || 1)}
                  onBlur={field.onBlur}
                  error={errors.seats?.message}
                />
              )}
            />

            <Group justify="flex-end" gap="xs" pt={4}>
              {onCancel && (
                <Button type="button" variant="subtle" color="gray" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" loading={create.isPending}>
                Add customer
              </Button>
            </Group>
          </Stack>
        </Fieldset>
      </form>
    </Box>
  );
}
