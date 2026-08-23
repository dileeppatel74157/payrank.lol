import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyUsdtTransfer } from '@/lib/tron';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    // 1. Verify Authorization Header
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const walletAddress = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS;
    if (!walletAddress) {
      console.error('NEXT_PUBLIC_USDT_TRC20_ADDRESS is not set.');
      return NextResponse.json({ error: 'TRON wallet address not configured' }, { status: 500 });
    }

    const db = supabaseAdmin();

    // 2. Fetch pending crypto bids
    const { data: pendingBids, error: fetchError } = await db
      .from('bids')
      .select(`
        id,
        amount,
        payment_reference,
        listing_id,
        listings (
          id,
          total_bid
        )
      `)
      .eq('payment_method', 'crypto')
      .eq('status', 'pending')
      .limit(50);

    if (fetchError) {
      console.error('Error fetching pending bids:', fetchError);
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
    }

    if (!pendingBids || pendingBids.length === 0) {
      return NextResponse.json({ checked: 0, confirmed: 0 });
    }

    let checkedCount = 0;
    let confirmedCount = 0;

    // 3. Verify each pending bid
    for (const bid of pendingBids) {
      const txHash = bid.payment_reference;
      if (!txHash) {
        // Mark bids with missing txHash as failed
        await db.from('bids').update({ status: 'failed' }).eq('id', bid.id);
        checkedCount++;
        continue;
      }

      try {
        // Double-spend check: Check if this txHash is already confirmed for another bid
        const { data: duplicateConfirmed } = await db
          .from('bids')
          .select('id')
          .eq('payment_method', 'crypto')
          .eq('payment_reference', txHash)
          .eq('status', 'confirmed')
          .neq('id', bid.id)
          .maybeSingle();

        if (duplicateConfirmed) {
          console.warn(`Double-spend attempt or duplicate txHash found for bid ${bid.id}. Marking as failed.`);
          await db.from('bids').update({ status: 'failed' }).eq('id', bid.id);
          checkedCount++;
          continue;
        }

        // Call verification helper
        const result = await verifyUsdtTransfer(txHash, walletAddress, Number(bid.amount));
        checkedCount++;

        if (result.verified) {
          // Update the bid status to 'confirmed'
          await db
            .from('bids')
            .update({ status: 'confirmed' })
            .eq('id', bid.id);

          // Update the listing's total_bid
          const currentTotal = Number(bid.listings?.total_bid || 0);
          await db
            .from('listings')
            .update({
              total_bid: currentTotal + Number(bid.amount),
              updated_at: new Date().toISOString(),
            })
            .eq('id', bid.listing_id);

          confirmedCount++;
          console.log(`Successfully verified and confirmed bid ${bid.id} for listing ${bid.listing_id}`);
        } else if (
          result.reason &&
          result.reason !== 'not_found_yet' &&
          result.reason !== 'api_error' &&
          result.reason !== 'unexpected_error'
        ) {
          // If the verification returns a definitive failure (wrong address or insufficient amount), fail it.
          console.log(`Definitive failure reason for bid ${bid.id}: ${result.reason}. Marking as failed.`);
          await db.from('bids').update({ status: 'failed' }).eq('id', bid.id);
        } else {
          // Otherwise, it stays pending to retry later
          console.log(`Bid ${bid.id} remains pending. Reason: ${result.reason || 'unverified'}`);
        }
      } catch (err) {
        console.error(`Error processing pending bid ${bid.id}:`, err);
      }
    }

    return NextResponse.json({
      checked: checkedCount,
      confirmed: confirmedCount,
    });
  } catch (err) {
    console.error('verify-pending cron error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
