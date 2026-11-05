module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      // Two files export a hook or a helper beside their component, and both
      // are better modules for it: a provider belongs with the hook that reads
      // it, and the command palette's `openCommandPalette` is how anything else
      // opens it. Neither re-renders on edit, so the fast-refresh warning is
      // advice about a situation that does not arise here.
      files: ['src/components/command-palette.tsx', 'src/components/theme-provider.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      // The UI probe is tooling, not app code: `mount.tsx` is .tsx because it
      // takes JSX, but it exports helpers rather than components.
      files: ['scripts/ui-probe/**/*.{ts,tsx}'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      // Vite's proxy hooks are typed by http-proxy, which is not a dependency
      // here; the handlers are configuration, not application code.
      files: ['vite.config.ts', 'vitest.config.ts', 'vitest.ui-probe.config.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      // ux-005: Mantine's components are the approved elements. Raw
      // <button>/<input>/<select>/<textarea> fail lint everywhere now — with
      // the kit deleted there is no directory left that legitimately writes
      // one, so the rule has no `excludedFiles`.
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': [
          'error',
          { selector: "JSXOpeningElement[name.name='button']", message: 'raw <button> is banned — use Mantine `Button`, `ActionIcon` or `UnstyledButton`' },
          { selector: "JSXOpeningElement[name.name='input']", message: 'raw <input> is banned — use Mantine `TextInput` (or `Checkbox`/`Radio`/`Switch`)' },
          { selector: "JSXOpeningElement[name.name='select']", message: 'raw <select> is banned — use Mantine `Select`' },
          { selector: "JSXOpeningElement[name.name='textarea']", message: 'raw <textarea> is banned — use Mantine `Textarea`' },
        ],
      },
    },
  ],
};
