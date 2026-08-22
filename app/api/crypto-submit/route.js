import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Crypto bids are NOT auto-confirmed (no on-chain verification wired up for this MVP).
// This just logs a "pending" bid with the tx hash the bidder claims to have sent.
// You confirm it manually in the Supabase table editor after checking the transaction
// on a TRC20 block explorer (e.g. tronscan.org) — then flip status to 'confirmed' and
// the total_bid update happens via the same logic as the webhook (see README).
export async function POST(req) {
  try {
    const { amountUSD, url, displayName, category, txHash } = await req.json();

    if (!amountUSD || amountUSD < 1 || !url || !txHash) {
      return NextResponse.json(
        { error: 'Amount, URL, and transaction hash are all required.' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    const { data: existing } = await db
      .from('listings')
      .select('id')
      .ilike('url', url)
      .maybeSingle();

    let listingId = existing?.id;

    if (!listingId) {
      const { data: created } = await db
        .from('listings')
        .insert({
          url,
          display_name: displayName || url,
          category: category || 'other',
          total_bid: 0, // stays 0 until you manually confirm the bid below
          payment_method: 'crypto',
        })
        .select('id')
        .single();
      listingId = created.id;
    }

    await db.from('bids').insert({
      listing_id: listingId,
      amount: amountUSD,
      currency: 'USDT',
      payment_method: 'crypto',
      payment_reference: txHash,
      status: 'pending',
    });

    return NextResponse.json({
      received: true,
      message: "Submitted. Your rank updates once we've verified the transaction (usually within a few hours).",
    });
  } catch (err) {
    console.error('crypto-submit error', err);
    return NextResponse.json({ error: 'Could not submit the bid.' }, { status: 500 });
  }
}
