-- Migration: Add FirstPromoter referral tracking columns to bids
ALTER TABLE bids 
ADD COLUMN IF NOT EXISTS referral_code text,
ADD COLUMN IF NOT EXISTS tracking_id text,
ADD COLUMN IF NOT EXISTS net_revenue numeric,
ADD COLUMN IF NOT EXISTS gst_amount numeric,
ADD COLUMN IF NOT EXISTS gateway_fee numeric,
ADD COLUMN IF NOT EXISTS commission_percentage numeric,
ADD COLUMN IF NOT EXISTS commission_amount numeric,
ADD COLUMN IF NOT EXISTS firstpromoter_sale_tracked boolean DEFAULT false;
