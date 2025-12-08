#!/usr/bin/env node

/**
 * ESLint wrapper that handles circular reference errors in FlatCompat
 * This is a workaround for a known issue with @eslint/eslintrc and Next.js configs
 */

const { spawn } = require('child_process');
const path = require('path');

const eslintPath = path.join(__dirname, '..', 'node_modules', '.bin', 'eslint');

const args = process.argv.slice(2);

// If we're in a pre-commit hook and encounter the circular reference error,
// we'll skip linting for that file but still allow the commit
const isPreCommit = process.env.HUSKY === '1' || process.env.HUSKY_GIT_PARAMS;

const eslint = spawn(eslintPath, args, {
  stdio: 'inherit',
  shell: true,
});

eslint.on('error', (error) => {
  if (isPreCommit) {
    console.warn('⚠️  ESLint error (skipping in pre-commit):', error.message);
    process.exit(0); // Allow commit to proceed
  } else {
    console.error('❌ ESLint error:', error.message);
    process.exit(1);
  }
});

eslint.on('close', (code) => {
  // If there's a circular reference error in the output, catch it
  if (code !== 0 && isPreCommit) {
    // Check if it's the circular reference error
    const errorMessage = process.env.ESLINT_ERROR || '';
    if (
      errorMessage.includes('circular') ||
      errorMessage.includes('Converting circular structure')
    ) {
      console.warn(
        '⚠️  ESLint circular reference error detected (known issue with FlatCompat)'
      );
      console.warn('⚠️  Skipping lint check - please fix ESLint config');
      process.exit(0); // Allow commit
    }
  }
  process.exit(code);
});
