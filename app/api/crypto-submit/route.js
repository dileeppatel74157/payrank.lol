import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyUsdtTransfer } from '@/lib/tron';
import { calculateCreatorCommission, trackFirstPromoterConversion } from '@/lib/firstpromoter';

export async function POST(req) {
  try {
    const { amountUSD, url, displayName, category, txHash, referralCode, trackingId } = await req.json();

    if (!amountUSD || amountUSD < 1 || !url || !txHash) {
      return NextResponse.json(
        { error: 'Amount, URL, and transaction hash are all required.' },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // Prevent double-spending by checking if this transaction hash was already confirmed
    const { data: existingBid } = await db
      .from('bids')
      .select('id')
      .eq('payment_method', 'crypto')
      .eq('payment_reference', txHash)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (existingBid) {
      return NextResponse.json(
        { error: 'This transaction hash has already been verified and used.' },
        { status: 400 }
      );
    }

    // Check for existing listing
    const { data: existingListing } = await db
      .from('listings')
      .select('id, total_bid')
      .ilike('url', url)
      .maybeSingle();

    const walletAddress = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS;
    if (!walletAddress) {
      console.error('NEXT_PUBLIC_USDT_TRC20_ADDRESS environment variable is not defined.');
    }

    // Verify the USDT transfer on-chain
    let verification = { verified: false, reason: 'wallet_not_configured' };
    if (walletAddress) {
      verification = await verifyUsdtTransfer(txHash, walletAddress, Number(amountUSD));
    }

    let listingId = existingListing?.id;

    if (verification.verified) {
      // 1. Update or create listing with the bid amount included
      if (listingId) {
        await db
          .from('listings')
          .update({
            total_bid: Number(existingListing.total_bid) + Number(amountUSD),
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId);
      } else {
        const { data: created } = await db
          .from('listings')
          .insert({
            url,
            display_name: displayName || url,
            category: category || 'other',
            total_bid: Number(amountUSD),
            payment_method: 'crypto',
          })
          .select('id')
          .single();
        listingId = created.id;
      }

      // Calculate Net Revenue and Commission
      const calc = calculateCreatorCommission(Number(amountUSD), 'crypto');

      // 2. Insert confirmed bid
      const { data: createdBid } = await db
        .from('bids')
        .insert({
          listing_id: listingId,
          amount: Number(amountUSD),
          currency: 'USDT',
          payment_method: 'crypto',
          payment_reference: txHash,
          status: 'confirmed',
          referral_code: referralCode || null,
          tracking_id: trackingId || null,
          net_revenue: calc.netRevenue,
          gst_amount: calc.gstAmount,
          gateway_fee: calc.gatewayFee,
          commission_percentage: calc.commissionPercentage,
          commission_amount: calc.commissionAmount,
        })
        .select('id')
        .single();

      // Trigger FirstPromoter sale tracking server-side
      if (referralCode || trackingId) {
        const trackingResult = await trackFirstPromoterConversion({
          amountUSD: Number(amountUSD),
          paymentMethod: 'crypto',
          paymentReference: txHash,
          referralCode,
          trackingId,
          bidId: createdBid.id,
        });

        if (trackingResult.tracked) {
          await db
            .from('bids')
            .update({ firstpromoter_sale_tracked: true })
            .eq('id', createdBid.id);
        }
      }

      return NextResponse.json({
        received: true,
        confirmed: true,
      });
    } else {
      // Verification failed or pending
      console.log(`Crypto payment verification pending or failed: ${verification.reason || 'unknown'}`);

      // 1. Ensure the listing exists (with total_bid starting at 0 if new)
      if (!listingId) {
        const { data: created } = await db
          .from('listings')
          .insert({
            url,
            display_name: displayName || url,
            category: category || 'other',
            total_bid: 0,
            payment_method: 'crypto',
          })
          .select('id')
          .single();
        listingId = created.id;
      }

      // Calculate Net Revenue and Commission
      const calc = calculateCreatorCommission(Number(amountUSD), 'crypto');

      // 2. Insert pending bid
      await db.from('bids').insert({
        listing_id: listingId,
        amount: Number(amountUSD),
        currency: 'USDT',
        payment_method: 'crypto',
        payment_reference: txHash,
        status: 'pending',
        referral_code: referralCode || null,
        tracking_id: trackingId || null,
        net_revenue: calc.netRevenue,
        gst_amount: calc.gstAmount,
        gateway_fee: calc.gatewayFee,
        commission_percentage: calc.commissionPercentage,
        commission_amount: calc.commissionAmount,
      });

      return NextResponse.json({
        received: true,
        confirmed: false,
        message: 'Your transaction is pending on-chain verification. It will auto-confirm shortly.',
      });
    }
  } catch (err) {
    console.error('crypto-submit error', err);
    return NextResponse.json({ error: 'Could not submit the bid.' }, { status: 500 });
  }
}
