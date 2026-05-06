#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import process from 'node:process';

function isTermux() {
  return Boolean(
    process.env.TERMUX_VERSION ||
    process.env.PREFIX?.includes('/com.termux') ||
    process.env.HOME?.includes('/com.termux')
  );
}

const env = {...process.env};

if (isTermux()) {
  env.DSG_DISABLE_WEBPACK_CACHE = 'true';
  env.NEXT_TELEMETRY_DISABLED = env.NEXT_TELEMETRY_DISABLED || '1';
  console.log('[dsg-build] Termux detected: disabling webpack persistent cache for deterministic build.');
} else if (env.DSG_DISABLE_WEBPACK_CACHE === 'true') {
  console.log('[dsg-build] DSG_DISABLE_WEBPACK_CACHE=true: disabling webpack persistent cache.');
}

const result = spawnSync('next', ['build'], {
  stdio: 'inherit',
  shell: true,
  env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
