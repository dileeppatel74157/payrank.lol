import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Configure this exact URL as a webhook in Razorpay Dashboard > Settings > Webhooks,
// subscribed to the "payment.captured" event, using RAZORPAY_WEBHOOK_SECRET as the secret.
export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true });
  }

  const payment = event.payload.payment.entity;
  const amountUSD = payment.amount / 100;
  const { url, display_name, category } = payment.notes || {};

  if (!url) {
    return NextResponse.json({ error: 'Missing listing URL in payment notes.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Find an existing listing for this URL (case-insensitive), or create a new one
  const { data: existing } = await db
    .from('listings')
    .select('id, total_bid')
    .ilike('url', url)
    .maybeSingle();

  let listingId = existing?.id;

  if (listingId) {
    await db
      .from('listings')
      .update({
        total_bid: Number(existing.total_bid) + amountUSD,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId);
  } else {
    const { data: created } = await db
      .from('listings')
      .insert({
        url,
        display_name: display_name || url,
        category: category || 'other',
        total_bid: amountUSD,
        payment_method: 'razorpay',
      })
      .select('id')
      .single();
    listingId = created.id;
  }

  await db.from('bids').insert({
    listing_id: listingId,
    amount: amountUSD,
    currency: 'USD',
    payment_method: 'razorpay',
    payment_reference: payment.id,
    status: 'confirmed',
  });

  return NextResponse.json({ received: true });
}
