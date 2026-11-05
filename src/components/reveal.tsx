import { motion, type HTMLMotionProps } from 'motion/react';

import { durations, fadeUp, stagger, useMotionEnabled } from '@/lib/motion';

/**
 * Entrance motion, as three components.
 *
 * Everything in this app that arrives on screen arrives through one of these,
 * which is what keeps the choreography a single decision rather than a prop
 * repeated in nineteen files. They are deliberately thin: a `motion.div` with
 * the shared variants already attached, and the reduced-motion answer already
 * made.
 *
 * `data-motion` is on every one of them. That is not decoration — it is the
 * handle probe rules M1 and M2 measure: M2 asserts that everything marked with
 * it has finished at `opacity: 1` and an identity transform, which is the one
 * failure mode of entrance animation that every other gate is blind to. An
 * animation that never fires leaves the element in the DOM, findable by every
 * query in the test suite, and invisible to the user.
 */

/** Shared reduced-motion behaviour: skip the hidden state entirely. */
function useEntrance(enabled: boolean) {
  return enabled
    ? ({ initial: 'hidden', animate: 'visible' } as const)
    : ({ initial: false, animate: 'visible' } as const);
}

/**
 * One element, arriving.
 *
 * Use for a section, a card, a panel — anything that is the only thing entering
 * where it is. Inside a `Stagger`, use `StaggerItem` instead: this one declares
 * its own `animate`, and a child that does that opts out of its parent's
 * sequencing.
 */
export function Reveal({
  delay = 0,
  children,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number }) {
  const enabled = useMotionEnabled();
  const entrance = useEntrance(enabled);

  return (
    <motion.div
      data-motion="reveal"
      variants={fadeUp}
      transition={enabled ? { delay } : { duration: durations.instant }}
      {...entrance}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * A container whose children arrive one after another.
 *
 * The sequencing lives on the parent (`staggerChildren` in `lib/motion.ts`) and
 * propagates down to any child that does *not* declare its own `animate` — so
 * the children must be `StaggerItem`, and a `Reveal` dropped in here would
 * silently arrive on its own schedule.
 */
export function Stagger({ children, ...props }: HTMLMotionProps<'div'>) {
  const enabled = useMotionEnabled();
  const entrance = useEntrance(enabled);

  return (
    <motion.div data-motion="stagger" variants={stagger} {...entrance} {...props}>
      {children}
    </motion.div>
  );
}

/**
 * One child of a `Stagger`.
 *
 * It carries variants and no `animate`, which is exactly what makes Framer
 * treat it as part of the parent's sequence.
 */
export function StaggerItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div data-motion="stagger-item" variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}
