import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    appId: 'abc-game-worker',
    productionReadyClaim: false
  });
}
