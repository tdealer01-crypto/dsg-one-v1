#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const callbackUrl = process.env.DSG_CALLBACK_URL;
const secret = process.env.DSG_CALLBACK_SECRET;

if (!callbackUrl || !secret) {
  throw new Error('DSG_CALLBACK_URL_AND_SECRET_REQUIRED');
}

const body = readFileSync('dsg-production-flow-result.json', 'utf8');
const signature = `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

const res = await fetch(callbackUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-dsg-signature': signature,
  },
  body,
});

const text = await res.text();

if (!res.ok) {
  throw new Error(`DSG_CALLBACK_FAILED:${res.status}:${text}`);
}

console.log(text);
