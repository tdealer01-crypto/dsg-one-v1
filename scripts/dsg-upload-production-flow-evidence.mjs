#!/usr/bin/env node
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

const callbackUrl = process.env.DSG_CALLBACK_URL;
const secret = process.env.DSG_CALLBACK_SECRET;
if (!callbackUrl || !secret) throw new Error('DSG_CALLBACK_URL_AND_SECRET_REQUIRED');

const result = JSON.parse(readFileSync('dsg-production-flow-result.json', 'utf8'));
const body = JSON.stringify(result);
const signatureHex = createHmac('sha256', secret).update(body).digest('hex');
const signature = `sha256=${signatureHex}`;

const verifySelf = timingSafeEqual(Buffer.from(signatureHex), Buffer.from(createHmac('sha256', secret).update(body).digest('hex')));
if (!verifySelf) throw new Error('DSG_CALLBACK_SIGNATURE_INVALID');

const res = await fetch(callbackUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dsg-signature': signature }, body });
if (!res.ok) throw new Error(`DSG_CALLBACK_FAILED:${res.status}`);
console.log(JSON.stringify({ ok: true, callbackStatus: res.status }));
