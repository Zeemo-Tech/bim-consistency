#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.includes('pnpm/')) {
  console.error('\n[install blocked] This repository only supports pnpm.')
  console.error('Run: corepack enable && pnpm install --frozen-lockfile\n')
  process.exit(1);
}
