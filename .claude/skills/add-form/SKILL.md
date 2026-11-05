---
name: add-form
description: Build a form end-to-end with react-hook-form + zod + Mantine inputs. Covers single-field, multi-step, conditional fields, file upload, server-side errors mapped to fields, and validation timing (on-submit vs on-blur). Use when the user asks to add a form, an input, a settings page, or anything that mutates state via RHF.
---

# add-form — build a form with RHF + zod + Mantine inputs

Forms are **react-hook-form + zod + Mantine inputs**. A Mantine input owns its
label, description and error slot and wires `aria-describedby` itself, so a
field is one component: `register()` for anything that reports an event,
`Controller` for anything that reports a value (`SegmentedControl`, `Select`,
`DatePickerInput`, `PinInput`).

## Read these first

- `src/pages/Customers/customer-form.tsx` — the canonical pattern: schema,
  resolver, `register`, one `Controller`, and the mutation. Copy it.
- `src/pages/Settings.tsx` — the non-modal variant, where fields live in panels
  and save on change rather than on submit.
- `docs/principles/microcopy.md` — button verbs, error message anatomy.

## When to reach for which

| Need | Recipe |
| --- | --- |
| One input + submit | `useForm({ resolver: zodResolver(schema) })` + Mantine inputs |
| A value-reporting control | `Controller` — `SegmentedControl`, `Select`, `Checkbox.Group`, `DatePickerInput`, `PinInput` |
| Multi-step wizard | One zod schema per step, `trigger()` to gate Next, merge on submit |
| Settings page (non-modal) | Mantine inputs inside `Panel`s, no RHF for read-mostly state |
| File upload | `register('file')`; preview with `URL.createObjectURL`; revoke on unmount |
| Server-side error → field | `setError('field', { message })` in the mutation's `onError` |
| Conditional fields | `watch('kind')`, and `z.discriminatedUnion` in the schema |
| Optimistic + rollback | `useMutation({ onMutate, onError, onSettled })` — see `add-feature` |

## The recipe — a form in a Modal

```tsx
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { toast } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
});
type Values = z.infer<typeof schema>;

export function InviteMemberModal({ opened, onClose }: Props) {
  const create = useCreateMember();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Invite a member">
      <form
        onSubmit={handleSubmit((v) =>
          create.mutate(v, {
            onSuccess: () => {
              toast.success('Member invited');
              reset();
              onClose();
            },
            onError: (e) => {
              const msg = getErrorMessage(e);
              if (msg.toLowerCase().includes('email')) setError('email', { message: msg });
              else toast.error(msg);
            },
          }),
        )}
      >
        <Stack gap="md">
          {/* `data-autofocus`, not `autoFocus`: Mantine's focus trap decides
              where focus lands after the open transition, and this is the
              attribute it looks for. */}
          <TextInput label="Name" data-autofocus error={errors.name?.message} {...register('name')} />
          <TextInput
            label="Email"
            type="email"
            description="They'll receive an invite link."
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            error={errors.email?.message}
            {...register('email')}
          />
          <Group justify="flex-end" gap="xs">
            <Button type="button" variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Send invite
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
```

## Validation timing

The ux-prepass gate says "validate on submit first, on blur after the first
submit" — which is RHF's default pair: `mode: 'onSubmit'` with
`reValidateMode: 'onChange'`. Set `mode: 'onBlur'` for a long settings form the
user tabs through; leave the default for a modal the user submits once.

## Multi-step wizards

1. **Per-step schema, merged on submit.** Each step validates its own fields
   with `trigger()` before advancing. Use this when the steps are genuinely
   distinct (onboarding).
2. **One schema, conditional fields.** `watch()` a discriminator and use
   `z.discriminatedUnion`. Use this when every step shares a parent shape.

## Server-side errors → field

- **Maps to a field:** `setError(field, { message })` and the input renders it
  in its own error slot.
- **Does not map:** `toast.error(getErrorMessage(e))` from `@/lib/notify`, and
  leave the fields alone.

## Don'ts

- **Don't wrap a Mantine input in a label of your own.** It has `label`,
  `description` and `error` props, and they carry the ARIA wiring.
- **Don't use `Controller` for a plain text input.** `register()` is fewer
  renders and less code; `Controller` is for controls that report a value.
- **Don't forget `reset()` after success**, or the next open shows stale values.
- **Don't pass changing props to `defaultValues`.** RHF reads them once; call
  `reset(next)` in an effect, or use the `values` option.
- **Don't put a form in the page's scroll region.** A form belongs in a `Modal`
  or its own pane.

## Verify

Run the `verify` skill. Specifically check that:

1. `npm run type-check` is clean (zod + RHF types are tightly coupled).
2. `npx vitest run` is green — `src/test/ui-contract.test.tsx` shows the pattern
   for rendering a form against MSW.
3. The submit button carries `loading={mutation.isPending}`.
4. Esc closes the modal, and the first field — not the close button — has focus
   when it opens (`data-autofocus`).
5. Tab order is logical: first input → next input → Cancel → Submit.

See `ux-prepass` for the mandatory UI gates.
