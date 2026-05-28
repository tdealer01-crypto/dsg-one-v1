import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Returns recent tool usage + decisions for a session
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  const { data } = await supabase
    .from('chat_messages')
    .select('role, content, dsg_decision, dsg_stamp, tools_used, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ messages: data ?? [] })
}
