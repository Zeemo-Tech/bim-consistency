#!/usr/bin/env node

const requiredNode = '20.19.0';
const requiredPnpm = '9.15.0';

const userAgent = process.env.npm_config_user_agent || '';
const pnpmMatch = userAgent.match(/pnpm\/(\d+\.\d+\.\d+)/);
const activePnpm = pnpmMatch ? pnpmMatch[1] : null;

const errors = [];

if (process.versions.node !== requiredNode) {
  errors.push(
    `Node.js ${requiredNode} is required, current version is ${process.versions.node}.`,
  );
}

if (activePnpm && activePnpm !== requiredPnpm) {
  errors.push(`pnpm ${requiredPnpm} is required, current version is ${activePnpm}.`);
}

if (errors.length > 0) {
  console.error('\n[toolchain mismatch]');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error('\nSuggested fix:');
  console.error(`- nvm use ${requiredNode}`);
  console.error(`- corepack prepare pnpm@${requiredPnpm} --activate\n`);
  process.exit(1);
}

console.log(`[toolchain ok] node ${process.versions.node}, pnpm ${activePnpm || requiredPnpm}`);
