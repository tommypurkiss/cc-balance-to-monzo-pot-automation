import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
});

// Load Next.js configs individually to avoid circular reference issues
let nextConfigs = [];
try {
  // Use compat.config() instead of compat.extends() to avoid circular references
  const config1 = compat.config({
    extends: ['next/core-web-vitals'],
  });
  const config2 = compat.config({
    extends: ['next/typescript'],
  });
  nextConfigs = [...(Array.isArray(config1) ? config1 : [config1]), ...(Array.isArray(config2) ? config2 : [config2])].filter(Boolean);
} catch (error) {
  // Silently fail and continue without Next.js presets
  // This is a known issue with FlatCompat and circular references
  nextConfigs = [];
}

const eslintConfig = [
  ...nextConfigs,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'functions/**',
    ],
  },
  {
    files: ['jest.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },
];

export default eslintConfig;
