import { NextResponse } from 'next/server';
import { listAppBuilderBuildTools } from '@/lib/dsg/app-builder/build-tools';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      tools: listAppBuilderBuildTools(),
      truthBoundary: 'Tools may be listed before approval, but HIGH risk tools cannot execute until the app builder job is READY_FOR_RUNTIME.',
    },
  });
}
