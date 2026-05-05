#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const executionId = process.env.DSG_EXECUTION_ID;
const previewUrl = process.env.DSG_PREVIEW_URL;
if (!executionId || !previewUrl) throw new Error('DSG_EXECUTION_ID_AND_PREVIEW_URL_REQUIRED');

if (!process.env.DSG_TEST_IDENTITY) throw new Error('DSG_TEST_IDENTITY_REQUIRED');
// Real browser flow runner must happen in external runner (e.g., Playwright in Actions), never in Vercel server functions.
const checks = { login: false, protectedRoute: false, crud: false, logout: false };
const production_flow_passed = Object.values(checks).every(Boolean);
const payload = { executionId, previewUrl, checks, production_flow_passed, createdAt: new Date().toISOString() };
const flowHash = `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
const result = { ...payload, flowHash };
writeFileSync('dsg-production-flow-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
