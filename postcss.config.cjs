/**
 * PostCSS — Mantine's half of the pipeline.
 *
 * There is nothing else in the pipeline: Mantine is the app's only styling
 * system, and this file exists for Mantine's CSS-module authoring helpers — `light-dark()`, `rem()`, `@mixin hover`, and the
 * `$mantine-breakpoint-*` variables that media queries in a `.module.css` are
 * written against.
 *
 * `.cjs` on purpose: `package.json` declares `"type": "module"`, so a
 * `postcss.config.js` would be parsed as ESM and fail to load.
 */
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};
