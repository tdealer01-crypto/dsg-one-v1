#!/usr/bin/env node

const url = process.env.DSG_VERCEL_PREVIEW_URL;

if (!url) {
  console.log(JSON.stringify({ status: 'BLOCK', reason: 'MISSING_PREVIEW_URL' }));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PREVIEW_DEPLOYED',
  preview_url: url,
  reason: 'URL_PRESENT_ONLY_VERCEL_API_AND_HEALTH_PROOF_REQUIRED'
}));
