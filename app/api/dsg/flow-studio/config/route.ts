import { NextResponse } from 'next/server';

const defaultConfig = {
  headerBg: 'bg-slate-900',
  title: 'DSG Flow Studio',
  boundary: 'Production integration uses dry-run mutation and allowlisted fetch only.',
};

export async function GET() {
  return NextResponse.json({ ok: true, data: defaultConfig });
}
