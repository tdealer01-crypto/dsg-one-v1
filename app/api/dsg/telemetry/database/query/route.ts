import { NextResponse } from 'next/server';
import { answerDsgDatabaseTelemetryQuery } from '@/lib/dsg/telemetry/database-telemetry';

export const dynamic = 'force-dynamic';

type QueryBody = {
  query?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as QueryBody;
  return NextResponse.json(answerDsgDatabaseTelemetryQuery(body.query || 'status'));
}
