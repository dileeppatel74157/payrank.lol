import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateCreatorCommission, trackFirstPromoterConversion, trackFirstPromoterRefund } from '@/lib/firstpromoter';

// Configure this exact URL as a webhook in Razorpay Dashboard > Settings > Webhooks,
// subscribed to the "payment.captured" and "refund.processed" events, using RAZORPAY_WEBHOOK_SECRET as the secret.
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

  // Handle refund.processed event
  if (event.event === 'refund.processed') {
    const refund = event.payload.refund.entity;
    const originalPaymentId = refund.payment_id;
    const amountUSD = refund.amount / 100;

    const db = supabaseAdmin();
    // 1. Look up the bid to find the listing_id and check if it has a referral
    const { data: bid } = await db
      .from('bids')
      .select('id, amount, listing_id, referral_code, tracking_id, status')
      .eq('payment_method', 'razorpay')
      .eq('payment_reference', originalPaymentId)
      .maybeSingle();

    if (!bid) {
      console.warn(`[Webhook] Refund processed for unknown payment: ${originalPaymentId}`);
      return NextResponse.json({ received: true });
    }

    if (bid.status === 'confirmed') {
      // 2. Mark the bid as failed (since check constraint restricts to 'pending', 'confirmed', 'failed')
      await db
        .from('bids')
        .update({ status: 'failed' })
        .eq('id', bid.id);

      // 3. Update the listing's total_bid
      const { data: listing } = await db
        .from('listings')
        .select('total_bid')
        .eq('id', bid.listing_id)
        .maybeSingle();

      if (listing) {
        const newTotal = Math.max(0, Number(listing.total_bid) - amountUSD);
        await db
          .from('listings')
          .update({
            total_bid: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bid.listing_id);
      }

      // 4. Reverse FirstPromoter commission if it was tracked
      if (bid.referral_code || bid.tracking_id) {
        await trackFirstPromoterRefund({
          amountUSD,
          paymentMethod: 'razorpay',
          paymentReference: originalPaymentId,
          bidId: bid.id,
        });
      }
    }

    return NextResponse.json({ received: true });
  }

  // Handle payment.captured event
  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true });
  }

  const payment = event.payload.payment.entity;
  const amountUSD = payment.amount / 100;
  const { url, display_name, category, referral_code, tracking_id } = payment.notes || {};

  if (!url) {
    return NextResponse.json({ error: 'Missing listing URL in payment notes.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Prevent double processing: check if a bid with this payment reference already exists and is confirmed
  const { data: existingBid } = await db
    .from('bids')
    .select('id, status')
    .eq('payment_method', 'razorpay')
    .eq('payment_reference', payment.id)
    .maybeSingle();

  if (existingBid && existingBid.status === 'confirmed') {
    return NextResponse.json({ received: true });
  }

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

  // Calculate Net Revenue and Commission breakdown
  const calc = calculateCreatorCommission(amountUSD, 'razorpay');

  let bidId;
  if (existingBid) {
    bidId = existingBid.id;
    await db
      .from('bids')
      .update({
        status: 'confirmed',
        referral_code: referral_code || null,
        tracking_id: tracking_id || null,
        net_revenue: calc.netRevenue,
        gst_amount: calc.gstAmount,
        gateway_fee: calc.gatewayFee,
        commission_percentage: calc.commissionPercentage,
        commission_amount: calc.commissionAmount,
      })
      .eq('id', bidId);
  } else {
    const { data: createdBid } = await db
      .from('bids')
      .insert({
        listing_id: listingId,
        amount: amountUSD,
        currency: 'USD',
        payment_method: 'razorpay',
        payment_reference: payment.id,
        status: 'confirmed',
        referral_code: referral_code || null,
        tracking_id: tracking_id || null,
        net_revenue: calc.netRevenue,
        gst_amount: calc.gstAmount,
        gateway_fee: calc.gatewayFee,
        commission_percentage: calc.commissionPercentage,
        commission_amount: calc.commissionAmount,
      })
      .select('id')
      .single();
    bidId = createdBid.id;
  }

  // Trigger FirstPromoter sale tracking server-side
  if (referral_code || tracking_id) {
    const trackingResult = await trackFirstPromoterConversion({
      amountUSD,
      paymentMethod: 'razorpay',
      paymentReference: payment.id,
      referralCode: referral_code,
      trackingId: tracking_id,
      bidId,
    });

    if (trackingResult.tracked) {
      await db
        .from('bids')
        .update({ firstpromoter_sale_tracked: true })
        .eq('id', bidId);
    }
  }

  return NextResponse.json({ received: true });
}
