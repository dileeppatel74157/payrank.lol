-- PayRank.lol database schema
-- Run this in the Supabase SQL editor for your project

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  display_name text not null,
  category text default 'other',
  total_bid numeric not null default 0,
  clicks integer not null default 0,
  payment_method text not null check (payment_method in ('razorpay', 'crypto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every individual bid/top-up is logged separately for auditing
create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'USD',
  payment_method text not null check (payment_method in ('razorpay', 'crypto')),
  payment_reference text, -- razorpay payment_id or crypto tx hash
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_listings_total_bid on listings (total_bid desc);
create index if not exists idx_bids_listing_id on bids (listing_id);

-- Row Level Security: public read, writes only via server (service role key)
alter table listings enable row level security;
alter table bids enable row level security;

create policy "Public can read listings"
  on listings for select
  using (true);

-- No public insert/update policies — all writes go through your API routes
-- using the Supabase service role key (server-side only, never exposed to browser).
