/**
 * POST /api/plugins/execute
 * Execute a plugin and charge the user via Stripe
 *
 * Request:
 *   {
 *     "plugin_id": "uuid",
 *     "user_id": "uuid",
 *     "input": {...}
 *   }
 *
 * Response:
 *   {
 *     "ok": true,
 *     "execution_id": "uuid",
 *     "cost_usd": 0.05,
 *     "charge_id": "ch_xxx"
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
});

interface ExecuteRequest {
  plugin_id: string;
  user_id: string;
  input?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExecuteRequest;
    const { plugin_id, user_id, input } = body;

    if (!plugin_id || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: plugin_id, user_id' },
        { status: 400 },
      );
    }

    // 1. Fetch plugin details
    const { data: plugin, error: pluginError } = await supabase
      .from('plugins')
      .select('*')
      .eq('id', plugin_id)
      .single();

    if (pluginError || !plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    if (!plugin.enabled) {
      return NextResponse.json({ error: 'Plugin is disabled' }, { status: 403 });
    }

    // 2. Fetch user's Stripe customer ID
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'User not found or profile missing' },
        { status: 404 },
      );
    }

    if (!userProfile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'User has no Stripe customer ID. Payment method required.' },
        { status: 402 },
      );
    }

    // 3. Create execution record (pending state)
    const executionId = crypto.randomUUID();
    const { data: execution, error: execError } = await supabase
      .from('executions')
      .insert([
        {
          id: executionId,
          plugin_id,
          user_id,
          cost_usd: plugin.cost_usd,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (execError || !execution) {
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 },
      );
    }

    // 4. Charge user via Stripe
    let charge;
    try {
      charge = await stripe.charges.create({
        amount: Math.round(plugin.cost_usd * 100), // Convert to cents
        currency: 'usd',
        customer: userProfile.stripe_customer_id,
        description: `Plugin execution: ${plugin.name} v${plugin.version}`,
        metadata: {
          execution_id: executionId,
          plugin_id,
          plugin_name: plugin.name,
          user_id,
        },
      });
    } catch (stripeError) {
      // Update execution to failed
      await supabase
        .from('executions')
        .update({ status: 'failed', error_message: String(stripeError) })
        .eq('id', executionId);

      return NextResponse.json(
        {
          error: 'Payment failed',
          details: stripeError instanceof Error ? stripeError.message : String(stripeError),
        },
        { status: 402 },
      );
    }

    // 5. Update execution with charge ID and running status
    await supabase
      .from('executions')
      .update({
        status: 'running',
        stripe_charge_id: charge.id,
      })
      .eq('id', executionId);

    // 6. Create earnings record for plugin developer (70% of cost)
    const developerShare = plugin.cost_usd * 0.7;
    const { error: earningsError } = await supabase.from('earnings').insert([
      {
        plugin_id,
        author_id: plugin.author_id,
        execution_id: executionId,
        amount_usd: developerShare,
        payout_status: 'pending',
      },
    ]);

    if (earningsError) {
      console.error('Warning: Failed to create earnings record:', earningsError);
      // Don't fail the request, but log the issue
    }

    // 7. Queue plugin execution (async)
    // In production, this would be a job queue (BullMQ, Temporal, etc.)
    // For now, return success immediately

    return NextResponse.json({
      ok: true,
      execution_id: executionId,
      cost_usd: plugin.cost_usd,
      charge_id: charge.id,
      status: 'running',
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/plugins/execute?execution_id=uuid
 * Check execution status
 */
export async function GET(req: NextRequest) {
  try {
    const executionId = req.nextUrl.searchParams.get('execution_id');

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing query parameter: execution_id' },
        { status: 400 },
      );
    }

    const { data: execution, error } = await supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error || !execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      execution_id: execution.id,
      status: execution.status,
      result: execution.result,
      error_message: execution.error_message,
      cost_usd: execution.cost_usd,
      execution_time_ms: execution.execution_time_ms,
      completed_at: execution.completed_at,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
