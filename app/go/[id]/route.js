import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// /go/[listing-id] increments the click counter, then redirects to the real URL.
// Keeps click counts visible on the board without exposing tracking params.
export async function GET(req, { params }) {
  const db = supabaseAdmin();

  const { data: listing } = await db
    .from('listings')
    .select('url, clicks')
    .eq('id', params.id)
    .maybeSingle();

  if (!listing) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  await db
    .from('listings')
    .update({ clicks: listing.clicks + 1 })
    .eq('id', params.id);

  const target = listing.url.startsWith('http') ? listing.url : `https://${listing.url}`;
  return NextResponse.redirect(target);
}
