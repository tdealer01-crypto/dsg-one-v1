import { NextResponse } from 'next/server';
import { DSG_APP_BUILDER_ENGINES } from '@/lib/dsg/app-builder/engines/engine-contract';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      engines: DSG_APP_BUILDER_ENGINES,
      defaultEngine: 'dsg-native',
      userOutcome: 'User can see which builder engines are available, which are only adapters, and what evidence is required before production claims.',
    },
  });
}
