import type { StorybookConfig } from '@storybook/react-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import remarkGfm from 'remark-gfm';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    '../src/**/*.stories.@(ts|tsx)',
    '../src/**/*.mdx',
    // `./**/*.mdx` (not `./*.mdx`) so the generated section landing pages in
    // .storybook/sections/ are picked up — see scripts/gen-storybook-docs.mjs.
    './**/*.mdx',
  ],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        // Without remark-gfm, MDX renders GitHub-flavoured tables as a single
        // run-on paragraph of pipe characters. Every table in Introduction.mdx
        // and in the generated section pages was doing exactly that.
        mdxPluginOptions: {
          mdxCompileOptions: { remarkPlugins: [remarkGfm] },
        },
      },
    },
    '@storybook/addon-a11y',
    'msw-storybook-addon',
  ],
  docs: {},
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  async viteFinal(config) {
    // The app's vite.config.ts is inherited by the react-vite framework; drop
    // its TanStack Router generator plugin (it chokes on storybook's virtual
    // modules) while keeping the react plugin and the aliases.
    const raw = config.plugins ?? [];
    const awaited = await Promise.all(
      raw.map((plugin) => (plugin && typeof (plugin as PromiseLike<unknown>).then === 'function' ? plugin : plugin))
    );
    const flat = awaited.flat(Infinity) as Array<{ name?: string } | false | null | undefined>;
    config.plugins = flat.filter(
      (plugin) => plugin && typeof plugin === 'object' && !String(plugin.name ?? '').includes('tanstack')
    ) as typeof config.plugins;
    config.resolve = config.resolve ?? {};
    // Stable path for the local storybook helpers (see .storybook/story-helpers.tsx).
    // Important: scope the alias to *only* `storybook/story-helpers` — using a
    // catch-all `storybook: <.storybook dir>` would also intercept Storybook's
    // own `storybook/internal/preview/runtime` import (added by @storybook/builder-vite)
    // and break `storybook build`. The regex match + literal replacement keeps
    // Storybook's package.json exports untouched.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(dirname, '../src'),
      'storybook/story-helpers': path.resolve(dirname, 'story-helpers.tsx'),
    };
    return config;
  },
};

export default config;
