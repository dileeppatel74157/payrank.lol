-- ============================================================================
-- PayRank.lol Demo Seed Data
-- ============================================================================
-- NOTE: This file is for demo/seeding purposes to populate the leaderboard.
-- You can run this script manually in the Supabase SQL Editor.
--
-- To clean up or delete these mock listings when real bidders arrive, run:
-- DELETE FROM listings WHERE is_demo = true;
-- ============================================================================

ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 1. Insert realistic-looking demo listings
INSERT INTO listings (id, url, display_name, category, total_bid, clicks, payment_method, is_demo, created_at, updated_at) VALUES
('a0000000-0000-0000-0000-000000000001', 'https://tailwind-gen.dev', 'Tailwind Generator', 'tools', 250.00, 45, 'razorpay', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('a0000000-0000-0000-0000-000000000002', 'https://copycraft.ai', 'CopyCraft AI', 'ai', 180.00, 32, 'crypto', true, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
('a0000000-0000-0000-0000-000000000003', 'https://soltracker.io', 'Solana Tracker', 'crypto', 110.00, 21, 'crypto', true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
('a0000000-0000-0000-0000-000000000004', 'https://focusflow.app', 'FocusFlow', 'apps', 75.00, 15, 'razorpay', true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
('a0000000-0000-0000-0000-000000000005', 'https://apishield.com', 'API Shield', 'tools', 45.00, 9, 'razorpay', true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('a0000000-0000-0000-0000-000000000006', 'https://indiehackernews.co', 'Indie Hacker News', 'other', 25.00, 8, 'razorpay', true, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),
('a0000000-0000-0000-0000-000000000007', 'https://synthvoice.io', 'SynthVoice', 'ai', 15.00, 5, 'crypto', true, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
('a0000000-0000-0000-0000-000000000008', 'https://gastrackerbot.net', 'Gas Tracker Bot', 'crypto', 5.00, 2, 'crypto', true, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert corresponding confirmed bids so history/ticker functions properly
INSERT INTO bids (id, listing_id, amount, currency, payment_method, payment_reference, status, created_at) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 250.00, 'USD', 'razorpay', 'pay_mock_1', 'confirmed', NOW() - INTERVAL '10 days'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 180.00, 'USD', 'crypto', 'tx_mock_2', 'confirmed', NOW() - INTERVAL '15 days'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 110.00, 'USD', 'crypto', 'tx_mock_3', 'confirmed', NOW() - INTERVAL '20 days'),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 75.00, 'USD', 'razorpay', 'pay_mock_4', 'confirmed', NOW() - INTERVAL '25 days'),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 45.00, 'USD', 'razorpay', 'pay_mock_5', 'confirmed', NOW() - INTERVAL '30 days'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 25.00, 'USD', 'razorpay', 'pay_mock_6', 'confirmed', NOW() - INTERVAL '35 days'),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 15.00, 'USD', 'crypto', 'tx_mock_7', 'confirmed', NOW() - INTERVAL '40 days'),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 5.00, 'USD', 'crypto', 'tx_mock_8', 'confirmed', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Add Row Level Security (RLS) Select Policy for Bids so clients can count them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bids' AND policyname = 'Public can read bids'
  ) THEN
    CREATE POLICY "Public can read bids" ON bids FOR SELECT USING (true);
  END IF;
END
$$;
