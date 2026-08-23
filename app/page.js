import { supabasePublic } from '@/lib/supabase';
import HomeClient from './HomeClient';

export const revalidate = 0; // Ensure fresh data on every page load (disable caching)

export default async function Page() {
  let initialListings = [];
  let initialRecentBidsCount = 0;

  try {
    const { data, error } = await supabasePublic
      .from('listings')
      .select('id, url, display_name, category, total_bid, clicks, created_at')
      .order('total_bid', { ascending: false })
      .limit(50);
    if (!error && data) {
      initialListings = data;
    }
  } catch (err) {
    console.error('Error fetching initial listings on server:', err);
  }

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabasePublic
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('created_at', yesterday);
    if (!error && count !== null) {
      initialRecentBidsCount = count;
    }
  } catch (err) {
    console.error('Error fetching initial bids count on server:', err);
  }

  return (
    <HomeClient
      initialListings={initialListings}
      initialRecentBidsCount={initialRecentBidsCount}
    />
  );
}
