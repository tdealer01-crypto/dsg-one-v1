/**
 * POST /api/jobs/weekly-payouts
 * Weekly developer payout automation (Monday 00:00 UTC)
 *
 * This should be scheduled via cron job (GitHub Actions, BullMQ, etc.)
 * Triggers every Monday and processes all pending earnings
 *
 * Response:
 *   {
 *     "ok": true,
 *     "payouts_processed": 42,
 *     "total_amount_usd": 1250.00,
 *     "successful": 42,
 *     "failed": 0
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

interface PayoutRecord {
  id: string;
  author_id: string;
  amount_usd: number;
}

interface AuthorEarnings {
  author_id: string;
  total_amount_usd: number;
  pending_payouts: PayoutRecord[];
}

export async function POST(req: NextRequest) {
  try {
    // Verify authorization (e.g., API key or auth header)
    const authHeader = req.headers.get('authorization');
    const expectedKey = process.env.PAYOUT_JOB_SECRET_KEY;

    if (!expectedKey || !authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== expectedKey) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 1. Fetch all pending earnings grouped by author
    const { data: pendingEarnings, error: fetchError } = await supabase
      .from('earnings')
      .select('id, author_id, amount_usd, plugin_id')
      .eq('payout_status', 'pending')
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Only earnings older than 7 days

    if (fetchError) {
      console.error('Database error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pendingEarnings || pendingEarnings.length === 0) {
      return NextResponse.json({
        ok: true,
        payouts_processed: 0,
        total_amount_usd: 0,
        successful: 0,
        failed: 0,
        message: 'No pending earnings to process',
      });
    }

    // 2. Group earnings by author
    const authorEarnings: Record<string, AuthorEarnings> = {};
    for (const earning of pendingEarnings) {
      if (!authorEarnings[earning.author_id]) {
        authorEarnings[earning.author_id] = {
          author_id: earning.author_id,
          total_amount_usd: 0,
          pending_payouts: [],
        };
      }
      authorEarnings[earning.author_id].total_amount_usd += earning.amount_usd;
      authorEarnings[earning.author_id].pending_payouts.push({
        id: earning.id,
        author_id: earning.author_id,
        amount_usd: earning.amount_usd,
      });
    }

    // 3. Process payouts for each author
    let successCount = 0;
    let failCount = 0;
    let totalPayoutAmount = 0;

    for (const [authorId, earnings] of Object.entries(authorEarnings)) {
      try {
        // Fetch author profile with Stripe account
        const { data: author, error: authorError } = await supabase
          .from('profiles')
          .select('email, stripe_account_id, name')
          .eq('id', authorId)
          .single();

        if (authorError || !author?.stripe_account_id) {
          console.error(`Author ${authorId} has no Stripe account`);
          failCount += earnings.pending_payouts.length;
          continue;
        }

        // Create payout via Stripe
        const payout = await stripe.payouts.create(
          {
            amount: Math.round(earnings.total_amount_usd * 100), // Convert to cents
            currency: 'usd',
            description: `DSG Plugin Revenue Payout - Week of ${new Date().toISOString().split('T')[0]}`,
            statement_descriptor: 'DSG Plugin Revenue',
          },
          {
            stripeAccount: author.stripe_account_id,
          },
        );

        // Update all pending earnings to processed
        const { error: updateError } = await supabase
          .from('earnings')
          .update({
            payout_status: 'processed',
            payout_id: payout.id,
            payout_date: new Date().toISOString(),
          })
          .in(
            'id',
            earnings.pending_payouts.map((p) => p.id),
          );

        if (updateError) {
          console.error(`Failed to update earnings for author ${authorId}:`, updateError);
          failCount += earnings.pending_payouts.length;
        } else {
          successCount += earnings.pending_payouts.length;
          totalPayoutAmount += earnings.total_amount_usd;

          console.log(
            `Payout processed for ${author.name} (${authorId}): $${earnings.total_amount_usd.toFixed(2)}, Payout ID: ${payout.id}`,
          );

          // Send email notification to author
          await sendPayoutNotification(author.email, author.name, earnings.total_amount_usd, payout.id);
        }
      } catch (err) {
        console.error(`Payout error for author ${authorId}:`, err);
        failCount += earnings.pending_payouts.length;
      }
    }

    return NextResponse.json({
      ok: true,
      payouts_processed: successCount,
      total_amount_usd: totalPayoutAmount,
      successful: successCount,
      failed: failCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Job error:', err);
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
 * Send email notification to developer about payout
 */
async function sendPayoutNotification(
  email: string,
  name: string,
  amount: number,
  payoutId: string,
) {
  try {
    // Use your email service (SendGrid, Resend, etc.)
    console.log(`Sending payout notification to ${email}: $${amount.toFixed(2)}`);

    // Example: Send via Resend
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'payouts@dsg.pics',
    //   to: email,
    //   subject: 'Your DSG Plugin Revenue Payout',
    //   html: `<p>Hi ${name},</p><p>We've processed your weekly payout of $${amount.toFixed(2)}.</p><p>Payout ID: ${payoutId}</p>`,
    // });
  } catch (err) {
    console.error('Email error:', err);
    // Don't fail the payout if email fails
  }
}

/**
 * GET /api/jobs/weekly-payouts/health
 * Health check for the payout job
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'weekly-payouts',
    schedule: 'Monday 00:00 UTC (cron: 0 0 * * 1)',
  });
}
