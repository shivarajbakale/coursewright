/**
 * msw-storybook-addon v3 hands each story an `msw` handle on the story context
 * (`beforeEach({ msw })`). The augmentation that declares it ships with the
 * addon but is not referenced by anything the compiler already sees, so pull it
 * in once here instead of hand-annotating the context at every call site.
 */
import 'msw-storybook-addon/types';
