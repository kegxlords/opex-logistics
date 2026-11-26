-- ============================================================
-- CSC APARTMENTS — complete schema, RLS, RPCs
-- Idempotent: safe to re-run at any time.
-- ============================================================
create extension if not exists "pgcrypto";

-- ---------------- tables ----------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, phone text,
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  upline_2 uuid references public.profiles(id),
  upline_3 uuid references public.profiles(id),
  is_admin boolean default false,
  is_active boolean default true,
  has_funded boolean default false,
  welcome_claimed boolean default false,
  total_funded numeric(15,2) default 0,
  total_withdrawn numeric(15,2) default 0,
  streak_days int default 0,
  longest_streak int default 0,
  last_checkin date,
  created_at timestamptz default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(15,2) not null default 0,
  income_balance numeric(15,2) not null default 0,
  locked numeric(15,2) not null default 0,
  updated_at timestamptz default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  slug text unique, name text not null, tier text,
  price numeric(15,2) not null, daily_yield numeric(15,2) not null,
  duration_days int not null, income_drop_days text,
  purchase_limit int not null default 5,
  bedrooms int default 1, bathrooms int default 1, sqm int default 0,
  image_url text, amenities text[] default '{}', description text,
  status text not null default 'live' check (status in ('live','hidden','upcoming','deleted')),
  sort_order int default 0, sold int default 0,
  created_at timestamptz default now()
);

create or replace function public.vip_package_rank(p_label text)
returns int language sql immutable parallel safe as $$
  select substring(coalesce(p_label, '') from '(?i)VIP[[:space:]_-]*([0-9]+)')::int
$$;

create or replace function public.enforce_vip5_package_terms()
returns trigger language plpgsql set search_path = public as $$
declare v_rank int;
begin
  v_rank := greatest(
    coalesce(public.vip_package_rank(new.tier), 0),
    coalesce(public.vip_package_rank(new.name), 0)
  );
  if v_rank >= 5 then
    new.daily_yield := round(new.price * 0.20, 2);
    new.duration_days := 10;
    new.income_drop_days := '0,1,2,3,4,5,6';
  end if;
  return new;
end $$;

drop trigger if exists enforce_vip5_package_terms on public.units;
create trigger enforce_vip5_package_terms before insert or update on public.units
for each row execute function public.enforce_vip5_package_terms();

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.units(id),
  unit_price numeric(15,2) not null, daily_yield numeric(15,2) not null,
  duration_days int not null, income_drop_days text not null,
  status text not null default 'active' check (status in ('active','completed','terminated')),
  days_paid int not null default 0,
  total_collected numeric(15,2) not null default 0,
  granted_by_admin boolean default false,
  started_at timestamptz not null default now()
);
create index if not exists leases_active_idx on public.leases (status, started_at);
create index if not exists leases_user_idx on public.leases (user_id, status);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  amount numeric(15,2) not null,
  fee numeric(15,2) default 0,
  net_amount numeric(15,2) not null,
  description text, reference text unique,
  status text not null default 'pending' check (status in ('pending','completed','rejected')),
  bank_name text, bank_code text, account_number text, account_name text,
  admin_note text, processed_by uuid references public.profiles(id),
  processing_mode text not null default 'review' check (processing_mode in ('gateway','review','manual')),
  gateway_status text not null default 'not_attempted' check (gateway_status in ('not_attempted','submitted','failed')),
  gateway_reference text, gateway_attempts int not null default 0,
  gateway_error text, gateway_submitted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists tx_user_idx on public.transactions (user_id, created_at desc);
create index if not exists tx_queue_idx on public.transactions (type, status, created_at desc);
alter table public.transactions add column if not exists processing_mode text not null default 'review';
alter table public.transactions add column if not exists bank_code text;
alter table public.transactions add column if not exists gateway_status text not null default 'not_attempted';
alter table public.transactions add column if not exists gateway_reference text;
alter table public.transactions add column if not exists gateway_attempts int not null default 0;
alter table public.transactions add column if not exists gateway_error text;
alter table public.transactions add column if not exists gateway_submitted_at timestamptz;

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bank_name text not null, bank_code text,
  account_number text not null, account_name text not null,
  is_default boolean default false, is_verified boolean default false,
  created_at timestamptz default now(),
  unique (user_id, account_number)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null,
  base_amount numeric(15,2) not null,
  streak_bonus numeric(15,2) default 0,
  total_amount numeric(15,2) not null,
  streak_at_time int not null,
  created_at timestamptz default now(),
  unique (user_id, checkin_date)
);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.profiles(id) on delete cascade,
  source_user_id uuid not null references public.profiles(id) on delete cascade,
  source_tx_id uuid references public.transactions(id) on delete set null,
  level int not null check (level between 1 and 3),
  rate numeric(6,2) not null,
  amount numeric(15,2) not null,
  created_at timestamptz default now(),
  unique (source_tx_id, beneficiary_id, level)
);

create table if not exists public.settings (key text primary key, value text not null);

create table if not exists public.cron_runs (
  id bigserial primary key, scanned int, drops_paid int, amount_paid numeric(15,2),
  leases_completed int, remaining int, elapsed_ms int, ok boolean, error text,
  created_at timestamptz default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  subject text, category text, message text,
  status text default 'open' check (status in ('open','answered','closed')),
  admin_reply text, created_at timestamptz default now(), replied_at timestamptz
);

create table if not exists public.audit_log (
  id bigserial primary key, actor uuid, action text, target uuid, meta jsonb,
  created_at timestamptz default now()
);

create table if not exists public.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists admin_impersonation_lookup_idx
  on public.admin_impersonation_sessions (token_hash, admin_id, user_id, expires_at);

-- ---------------- settings seed ----------------
insert into public.settings (key,value) values
 ('min_deposit','3000'),('max_deposit','5000000'),
 ('min_withdrawal','2000'),('max_withdrawal','3000000'),
 ('withdrawal_fee','8'),('withdrawals_per_day','2'),
 ('referral_l1','10'),('referral_l2','3'),('referral_l3','1'),
 ('income_days','30'),('income_drop_days','1,2,3,4,5'),('welcome_bonus','500'),('checkin_bonus','50'),
 ('streak_7','5'),('streak_14','10'),('streak_30','20'),
 ('withdrawal_days','0,1,2,3,4,5,6'),
 ('withdrawal_start','08:00'),('withdrawal_end','18:00'),
 ('withdrawal_mode','review'),
 ('bank_name','Guaranty Trust Bank'),('account_number','0123456789'),
 ('account_name','Opex Logistics Ltd'),
 ('whatsapp_link','https://chat.whatsapp.com/HdKsgo89Oi1LUBqMbI9Rmp?s=cl&p=a&mlu=4&ilr=4&iam=2'),
 ('telegram_link','https://t.me/pinnacleapartments'),
 ('support_link','https://wa.me/2348000000000'),
 ('support_email','care@pinnacleapartments.ng')
on conflict (key) do nothing;

-- ---------------- unit seed ----------------
insert into public.units (slug,name,tier,price,daily_yield,duration_days,purchase_limit,bedrooms,bathrooms,sqm,status,sort_order,amenities,description) values
 ('studio','Studio Suite','Studio',15000,1200,30,5,1,1,34,'live',0,'{"24/7 Power","Fibre WiFi","Secure Parking"}','Fully serviced and professionally managed.'),
 ('one-bed','One-Bedroom Residence','1 Bedroom',45000,3800,45,5,1,1,58,'live',1,'{"24/7 Power","Fibre WiFi","CCTV","Secure Parking"}','Fully serviced and professionally managed.'),
 ('two-bed','Two-Bedroom Terrace','2 Bedroom',120000,10500,60,4,2,2,96,'live',2,'{"24/7 Power","Fibre WiFi","CCTV","Water Treatment"}','Fully serviced and professionally managed.'),
 ('three-bed','Three-Bedroom Maisonette','3 Bedroom',300000,27000,75,3,3,2,142,'live',3,'{"24/7 Power","Fibre WiFi","CCTV","Pool","Gym"}','Fully serviced and professionally managed.'),
 ('duplex','Executive Duplex','Duplex',750000,70000,90,2,4,3,210,'upcoming',4,'{"24/7 Power","Fibre WiFi","CCTV","Pool","Gym","Concierge"}','Fully serviced and professionally managed.'),
 ('penthouse','Sky Penthouse','Penthouse',2000000,195000,120,1,5,4,340,'live',5,'{"24/7 Power","Fibre WiFi","CCTV","Pool","Gym","Concierge"}','Fully serviced and professionally managed.')
on conflict (slug) do nothing;

-- Snapshot the terms active at lease creation so later catalogue edits only
-- affect future purchases.
create or replace function public.snapshot_lease_terms()
returns trigger language plpgsql security definer set search_path = public as $$
declare u public.units%rowtype; v_days text;
begin
  select * into u from public.units where id = new.unit_id;
  if not found then raise exception 'Package not found.'; end if;
  select value into v_days from public.settings where key = 'income_drop_days';
  new.unit_price := u.price;
  new.daily_yield := u.daily_yield;
  new.duration_days := u.duration_days;
  new.income_drop_days := coalesce(u.income_drop_days, v_days, '1,2,3,4,5');
  return new;
end $$;

drop trigger if exists snapshot_lease_terms on public.leases;
create trigger snapshot_lease_terms before insert on public.leases
for each row execute function public.snapshot_lease_terms();

-- ---------------- admin helper (avoids RLS recursion) ----------------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------- signup trigger ----------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text; v_inv text; v_ref uuid; v_u2 uuid; v_u3 uuid; v_bonus numeric;
begin
  loop
    v_code := 'PNC' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,3));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;

  v_inv := nullif(new.raw_user_meta_data->>'invite','');
  if v_inv is not null then
    select id, referred_by, upline_2 into v_ref, v_u2, v_u3
      from public.profiles where referral_code = upper(v_inv) limit 1;
  end if;

  insert into public.profiles (id, full_name, email, phone, referral_code, referred_by, upline_2, upline_3)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name','Member'), new.email,
          coalesce(new.raw_user_meta_data->>'phone',''), v_code, v_ref, v_u2, v_u3);

  insert into public.wallets (user_id) values (new.id) on conflict do nothing;

  select coalesce(value::numeric,0) into v_bonus from public.settings where key='welcome_bonus';
  if v_bonus > 0 then
    insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status)
    values (new.id,'welcome_bonus',v_bonus,0,v_bonus,'Welcome bonus',
            'WEL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'completed');
    update public.wallets set balance = balance + v_bonus where user_id = new.id;
    update public.profiles set welcome_claimed = true where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------- lease ----------------
create or replace function public.lease_unit(p_user uuid, p_unit uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare u public.units%rowtype; w public.wallets%rowtype; v_id uuid; v_cnt int;
begin
  select * into u from public.units where id = p_unit for update;
  if not found then raise exception 'Residence not found.'; end if;
  if u.status <> 'live' then raise exception 'This residence is not open for leasing yet.'; end if;

  select count(*) into v_cnt from public.leases
    where user_id=p_user and unit_id=p_unit and status='active';
  if v_cnt >= u.purchase_limit then
    raise exception 'You have reached the %x limit for this residence.', u.purchase_limit;
  end if;

  select * into w from public.wallets where user_id = p_user for update;
  if not found then raise exception 'Wallet not found.'; end if;
  if w.balance - w.locked < u.price then raise exception 'Insufficient balance.'; end if;

  update public.wallets set balance = balance - u.price, updated_at = now() where user_id = p_user;

  insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status)
  values (p_user,'lease_purchase',u.price,0,u.price,'Leased '||u.name,
          'LSE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'completed');

  insert into public.leases (user_id,unit_id) values (p_user,p_unit) returning id into v_id;
  update public.units set sold = sold + 1 where id = p_unit;
  return v_id;
end $$;

-- ---------------- income sweep ----------------
create or replace function public.sweep_income(p_limit int default 250)
returns table (scanned int, drops_paid int, amount_paid numeric, leases_completed int, remaining int)
language plpgsql security definer set search_path = public as $$
declare
  l record; v_due int; v_target int; v_paid int := 0; v_amt numeric := 0;
  v_done int := 0; v_scan int := 0; v_ref text;
begin
  for l in
    select ls.id, ls.user_id, ls.days_paid, ls.started_at,
           ls.daily_yield, ls.duration_days, ls.income_drop_days, u.name
    from public.leases ls join public.units u on u.id = ls.unit_id
    where ls.status = 'active'
    order by ls.started_at
    limit p_limit
    for update of ls skip locked
  loop
    v_scan := v_scan + 1;
    v_due := floor(extract(epoch from (now() - l.started_at)) / 86400);
    select count(*)::int into v_target
      from generate_series(1, greatest(v_due, 0)) as day_offset
      where position(',' || extract(dow from (l.started_at + (day_offset || ' days')::interval))::int || ','
                     in ',' || l.income_drop_days || ',') > 0;
    v_target := least(v_target, l.duration_days);

    while l.days_paid < v_target loop
      l.days_paid := l.days_paid + 1;
      v_ref := 'INC-' || substr(replace(l.id::text,'-',''),1,8) || '-' || l.days_paid;
      if exists (select 1 from public.transactions where reference = v_ref) then continue; end if;

      insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status,created_at)
      values (l.user_id,'rental_income',l.daily_yield,0,l.daily_yield,
              l.name||' · drop '||l.days_paid, v_ref,'completed',
              l.started_at + (l.days_paid || ' days')::interval);

      update public.wallets set balance = balance + l.daily_yield,
                               income_balance = income_balance + l.daily_yield,
                               updated_at = now() where user_id = l.user_id;
      update public.leases set days_paid = l.days_paid,
                              total_collected = total_collected + l.daily_yield where id = l.id;
      v_paid := v_paid + 1; v_amt := v_amt + l.daily_yield;
    end loop;

    if l.days_paid >= l.duration_days then
      update public.leases set status='completed' where id = l.id;
      v_done := v_done + 1;
    end if;
  end loop;

  select count(*) into remaining
  from public.leases as ls
  where ls.status = 'active'
    and (
      select count(*)::int
      from generate_series(
        1,
        greatest(floor(extract(epoch from (now() - ls.started_at)) / 86400)::int, 0)
      ) as day_offset
      where position(',' || extract(dow from (ls.started_at + (day_offset || ' days')::interval))::int || ','
                     in ',' || ls.income_drop_days || ',') > 0
    ) > ls.days_paid;

  return query select v_scan, v_paid, v_amt, v_done, remaining;
end $$;

-- ---------------- welcome bonus ----------------
create or replace function public.grant_welcome_bonus(p_user uuid, p_amount numeric, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id=p_user and welcome_claimed) then return; end if;
  insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status)
  values (p_user,'welcome_bonus',p_amount,0,p_amount,'Welcome bonus',p_ref,'completed');
  update public.wallets set balance = balance + p_amount where user_id=p_user;
  update public.profiles set welcome_claimed=true where id=p_user;
end $$;

-- ---------------- check-in ----------------
create or replace function public.do_checkin(p_user uuid)
returns table (base numeric, bonus numeric, total numeric, streak int, pct numeric)
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype; v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_base numeric; v_pct numeric := 0; v_bonus numeric; v_streak int;
  s7 numeric; s14 numeric; s30 numeric;
begin
  select * into p from public.profiles where id=p_user for update;
  if exists (select 1 from public.checkins where user_id=p_user and checkin_date=v_today) then
    raise exception 'You have already checked in today.';
  end if;

  select coalesce(value::numeric,0) into v_base from public.settings where key='checkin_bonus';
  select coalesce(value::numeric,0) into s7  from public.settings where key='streak_7';
  select coalesce(value::numeric,0) into s14 from public.settings where key='streak_14';
  select coalesce(value::numeric,0) into s30 from public.settings where key='streak_30';

  v_streak := case when p.last_checkin = v_today - 1 then p.streak_days + 1 else 1 end;
  v_pct := case when v_streak >= 30 then s30 when v_streak >= 14 then s14 when v_streak >= 7 then s7 else 0 end;
  v_bonus := round(v_base * v_pct / 100, 2);

  insert into public.checkins (user_id,checkin_date,base_amount,streak_bonus,total_amount,streak_at_time)
  values (p_user,v_today,v_base,v_bonus,v_base+v_bonus,v_streak);

  insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status)
  values (p_user,'checkin_bonus',v_base+v_bonus,0,v_base+v_bonus,
          'Attendance day '||v_streak||case when v_pct>0 then ' · +'||v_pct||'% streak' else '' end,
          'CHK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'completed');

  update public.wallets set balance = balance + v_base + v_bonus where user_id=p_user;
  update public.profiles set streak_days=v_streak,
                            longest_streak=greatest(longest_streak,v_streak),
                            last_checkin=v_today where id=p_user;

  return query select v_base, v_bonus, v_base+v_bonus, v_streak, v_pct;
end $$;

-- ---------------- deposit approval + 3-level commissions ----------------
create or replace function public.approve_deposit(p_tx uuid, p_admin uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions%rowtype; p public.profiles%rowtype;
        v_rate numeric; v_amt numeric; v_bene uuid; v_lvl int;
begin
  select * into t from public.transactions where id=p_tx and type='deposit' for update;
  if not found then raise exception 'Deposit not found.'; end if;
  if t.status <> 'pending' then raise exception 'This deposit has already been processed.'; end if;

  update public.transactions set status='completed', processed_by=p_admin, admin_note=p_note where id=p_tx;
  update public.wallets set balance = balance + t.net_amount, updated_at=now() where user_id=t.user_id;
  update public.profiles set has_funded=true, total_funded=total_funded+t.net_amount where id=t.user_id;

  select * into p from public.profiles where id=t.user_id;
  for v_lvl in 1..3 loop
    v_bene := case v_lvl when 1 then p.referred_by when 2 then p.upline_2 else p.upline_3 end;
    if v_bene is null then continue; end if;
    select coalesce(value::numeric,0) into v_rate from public.settings where key='referral_l'||v_lvl;
    if v_rate <= 0 then continue; end if;
    if exists (select 1 from public.referral_commissions
               where source_tx_id=p_tx and beneficiary_id=v_bene and level=v_lvl) then continue; end if;
    v_amt := round(t.net_amount * v_rate / 100, 2);
    insert into public.referral_commissions (beneficiary_id,source_user_id,source_tx_id,level,rate,amount)
    values (v_bene,t.user_id,p_tx,v_lvl,v_rate,v_amt);
    insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status)
    values (v_bene,'referral_commission',v_amt,0,v_amt,
            'Level '||v_lvl||' commission · '||coalesce(p.full_name,'Member'),
            'REF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'completed');
    update public.wallets set balance = balance + v_amt where user_id=v_bene;
  end loop;

  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'approve_deposit',p_tx,jsonb_build_object('amount',t.amount));
end $$;

create or replace function public.reject_deposit(p_tx uuid, p_admin uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.transactions set status='rejected', processed_by=p_admin, admin_note=p_note
  where id=p_tx and type='deposit' and status='pending';
  if not found then raise exception 'Deposit is not pending.'; end if;
  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'reject_deposit',p_tx,jsonb_build_object('note',p_note));
end $$;

-- ---------------- withdrawal lifecycle ----------------
create or replace function public.request_withdrawal(
  p_user uuid, p_amount numeric, p_card uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  w public.wallets%rowtype; c public.bank_accounts%rowtype;
  v_fee numeric; v_pct numeric; v_min numeric; v_max numeric; v_cap int;
  v_days text; v_start text; v_end text; v_now record; v_tx uuid; v_used int;
  v_dow int; v_mins int; v_mode text;
begin
  select * into c from public.bank_accounts where id=p_card and user_id=p_user;
  if not found then raise exception 'Save a payout card before withdrawing.'; end if;
  if not exists (select 1 from public.leases where user_id=p_user and status='active') then
    raise exception 'You need at least one active lease to withdraw.';
  end if;

  select coalesce(value::numeric,0) into v_min from public.settings where key='min_withdrawal';
  select coalesce(value::numeric,0) into v_max from public.settings where key='max_withdrawal';
  select coalesce(value::numeric,0) into v_pct from public.settings where key='withdrawal_fee';
  select coalesce(value::int,1)     into v_cap from public.settings where key='withdrawals_per_day';
  select value into v_days  from public.settings where key='withdrawal_days';
  select value into v_start from public.settings where key='withdrawal_start';
  select value into v_end   from public.settings where key='withdrawal_end';
  select case when value in ('gateway','review','manual') then value else 'review' end into v_mode
    from public.settings where key='withdrawal_mode';
  v_mode := coalesce(v_mode, 'review');

  if p_amount < v_min then raise exception 'Minimum withdrawal is %.', v_min; end if;
  if p_amount > v_max then raise exception 'Maximum withdrawal is %.', v_max; end if;

  select * into w from public.wallets where user_id=p_user for update;
  if p_amount > w.balance - w.locked then raise exception 'Insufficient available balance.'; end if;

  if exists (select 1 from public.transactions
             where user_id=p_user and type='withdrawal' and status='pending') then
    raise exception 'You already have a withdrawal awaiting review.';
  end if;

  select count(*) into v_used from public.transactions
    where user_id=p_user and type='withdrawal' and status <> 'rejected'
      and (created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date;
  if v_used >= v_cap then raise exception 'Daily limit reached — % withdrawals per day.', v_cap; end if;

  v_dow  := extract(dow from (now() at time zone 'Africa/Lagos'))::int;
  v_mins := extract(hour from (now() at time zone 'Africa/Lagos'))::int * 60
          + extract(minute from (now() at time zone 'Africa/Lagos'))::int;

  if position(v_dow::text in coalesce(v_days,'')) = 0 then
    raise exception 'Withdrawals are closed today. Allowed days: %.', v_days;
  end if;
  if v_mins < (split_part(v_start,':',1)::int*60 + split_part(v_start,':',2)::int)
     or v_mins >= (split_part(v_end,':',1)::int*60 + split_part(v_end,':',2)::int) then
    raise exception 'Withdrawals are closed. Window: % – % WAT.', v_start, v_end;
  end if;

  v_fee := round(p_amount * v_pct / 100, 2);

  insert into public.transactions
    (user_id,type,amount,fee,net_amount,description,reference,status,bank_name,bank_code,account_number,account_name,processing_mode)
  values (p_user,'withdrawal',p_amount,v_fee,p_amount-v_fee,
          'Withdrawal to '||c.bank_name,
          'WTH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
          'pending',c.bank_name,c.bank_code,c.account_number,c.account_name,v_mode)
  returning id into v_tx;

  update public.wallets set locked = locked + p_amount, updated_at=now() where user_id=p_user;
  return v_tx;
end $$;

create or replace function public.approve_withdrawal(p_tx uuid, p_admin uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions%rowtype;
begin
  select * into t from public.transactions where id=p_tx and type='withdrawal' for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if t.status <> 'pending' then raise exception 'This withdrawal has already been processed.'; end if;

  update public.transactions set status='completed', processed_by=p_admin, admin_note=p_note where id=p_tx;
  update public.wallets
     set balance = balance - t.amount,
         locked  = greatest(0, locked - t.amount),
         updated_at = now()
   where user_id = t.user_id;
  update public.profiles set total_withdrawn = total_withdrawn + t.net_amount where id=t.user_id;

  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'approve_withdrawal',p_tx,jsonb_build_object('gross',t.amount,'net',t.net_amount));
end $$;

create or replace function public.complete_gateway_withdrawal(p_tx uuid, p_admin uuid, p_gateway_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions%rowtype;
begin
  select * into t from public.transactions where id=p_tx and type='withdrawal' for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if t.status <> 'pending' then raise exception 'This withdrawal has already been processed.'; end if;
  update public.transactions set status='completed', processed_by=p_admin,
    gateway_status='submitted', gateway_reference=coalesce(p_gateway_reference,gateway_reference),
    gateway_error=null, gateway_submitted_at=coalesce(gateway_submitted_at, now()) where id=p_tx;
  update public.wallets set balance = balance - t.amount, locked = greatest(0, locked - t.amount), updated_at=now() where user_id=t.user_id;
  update public.profiles set total_withdrawn = total_withdrawn + t.net_amount where id=t.user_id;
  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'gateway_withdrawal_completed',p_tx,jsonb_build_object('gross',t.amount,'net',t.net_amount,'gateway_reference',p_gateway_reference));
end $$;

create or replace function public.record_gateway_withdrawal_failure(p_tx uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.transactions set gateway_status='failed', gateway_attempts=gateway_attempts+1,
    gateway_error=left(coalesce(p_error,'Gateway request failed.'),500) where id=p_tx and type='withdrawal' and status='pending';
  if not found then raise exception 'Pending withdrawal not found.'; end if;
end $$;

create or replace function public.record_gateway_withdrawal_submission(p_tx uuid, p_gateway_reference text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.transactions set gateway_status='submitted', gateway_attempts=gateway_attempts+1,
    gateway_reference=p_gateway_reference, gateway_error=null, gateway_submitted_at=now()
  where id=p_tx and type='withdrawal' and status='pending';
  if not found then raise exception 'Pending withdrawal not found.'; end if;
end $$;

create or replace function public.reject_withdrawal(p_tx uuid, p_admin uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.transactions%rowtype;
begin
  select * into t from public.transactions where id=p_tx and type='withdrawal' for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if t.status <> 'pending' then raise exception 'This withdrawal has already been processed.'; end if;

  update public.transactions set status='rejected', processed_by=p_admin, admin_note=p_note where id=p_tx;
  update public.wallets set locked = greatest(0, locked - t.amount), updated_at=now() where user_id=t.user_id;

  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'reject_withdrawal',p_tx,jsonb_build_object('note',p_note,'refunded',t.amount));
end $$;

-- ---------------- admin wallet + lease tools ----------------
create or replace function public.admin_adjust_wallet(
  p_admin uuid, p_user uuid, p_amount numeric, p_direction text, p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype; v_type text;
begin
  if p_amount <= 0 then raise exception 'Enter an amount greater than zero.'; end if;
  select * into w from public.wallets where user_id=p_user for update;
  if not found then raise exception 'Wallet not found.'; end if;

  if p_direction = 'credit' then
    v_type := 'admin_credit';
    update public.wallets set balance = balance + p_amount, updated_at=now() where user_id=p_user;
  elsif p_direction = 'debit' then
    v_type := 'admin_debit';
    if w.balance - w.locked < p_amount then raise exception 'Amount exceeds the available balance.'; end if;
    update public.wallets set balance = balance - p_amount, updated_at=now() where user_id=p_user;
  else
    raise exception 'Direction must be credit or debit.';
  end if;

  insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status,processed_by,admin_note)
  values (p_user,v_type,p_amount,0,p_amount,
          case when p_direction='credit' then 'Wallet top-up by admin' else 'Wallet deduction by admin' end,
          'ADM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'completed',p_admin,p_note);

  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'adjust_wallet',p_user,jsonb_build_object('direction',p_direction,'amount',p_amount,'note',p_note));
end $$;

create or replace function public.admin_grant_lease(p_admin uuid, p_user uuid, p_unit uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare u public.units%rowtype; v_id uuid;
begin
  select * into u from public.units where id=p_unit;
  if not found then raise exception 'Residence not found.'; end if;

  insert into public.leases (user_id,unit_id,granted_by_admin) values (p_user,p_unit,true) returning id into v_id;
  insert into public.transactions (user_id,type,amount,fee,net_amount,description,reference,status,processed_by)
  values (p_user,'admin_credit',0,0,0,'Residence granted: '||u.name,
          'GRT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'completed',p_admin);
  update public.units set sold = sold + 1 where id=p_unit;

  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'grant_lease',p_user,jsonb_build_object('unit',u.name));
  return v_id;
end $$;

create or replace function public.admin_set_ban(p_admin uuid, p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set is_active = p_active where id = p_user;
  insert into public.audit_log (actor,action,target,meta)
  values (p_admin, case when p_active then 'unban' else 'ban' end, p_user, '{}'::jsonb);
end $$;
create or replace function public.admin_impersonate(p_admin uuid, p_user uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.audit_log (actor,action,target,meta)
  values (p_admin,'impersonate',p_user,jsonb_build_object('at',now())) returning id into v_id;
  return v_id;
end $$;
-- ---------------- RLS ----------------
alter table public.profiles            enable row level security;
alter table public.wallets             enable row level security;
alter table public.units               enable row level security;
alter table public.leases              enable row level security;
alter table public.transactions        enable row level security;
alter table public.bank_accounts       enable row level security;
alter table public.checkins            enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.settings            enable row level security;
alter table public.cron_runs           enable row level security;
alter table public.support_tickets     enable row level security;
alter table public.audit_log           enable row level security;
alter table public.admin_impersonation_sessions enable row level security;

-- profiles
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_team_read on public.profiles;
create policy profiles_team_read on public.profiles for select
  using (referred_by = auth.uid() or upline_2 = auth.uid() or upline_3 = auth.uid());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- wallets
drop policy if exists wallets_self_read on public.wallets;
create policy wallets_self_read on public.wallets for select using (auth.uid() = user_id);
drop policy if exists wallets_admin_read on public.wallets;
create policy wallets_admin_read on public.wallets for select using (public.is_admin());

-- units
drop policy if exists units_public_read on public.units;
create policy units_public_read on public.units for select using (status in ('live','upcoming'));
drop policy if exists units_admin_all on public.units;
create policy units_admin_all on public.units for all using (public.is_admin()) with check (public.is_admin());

-- leases
drop policy if exists leases_self_read on public.leases;
create policy leases_self_read on public.leases for select using (auth.uid() = user_id);
drop policy if exists leases_admin_all on public.leases;
create policy leases_admin_all on public.leases for all using (public.is_admin()) with check (public.is_admin());

-- transactions
drop policy if exists tx_self_read on public.transactions;
create policy tx_self_read on public.transactions for select using (auth.uid() = user_id);
drop policy if exists tx_admin_all on public.transactions;
create policy tx_admin_all on public.transactions for all using (public.is_admin()) with check (public.is_admin());

-- bank accounts
drop policy if exists cards_self_all on public.bank_accounts;
create policy cards_self_all on public.bank_accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists cards_admin_read on public.bank_accounts;
create policy cards_admin_read on public.bank_accounts for select using (public.is_admin());

-- checkins
drop policy if exists checkins_self_read on public.checkins;
create policy checkins_self_read on public.checkins for select using (auth.uid() = user_id);
drop policy if exists checkins_admin_read on public.checkins;
create policy checkins_admin_read on public.checkins for select using (public.is_admin());

-- commissions
drop policy if exists comm_self_read on public.referral_commissions;
create policy comm_self_read on public.referral_commissions for select using (auth.uid() = beneficiary_id);
drop policy if exists comm_admin_read on public.referral_commissions;
create policy comm_admin_read on public.referral_commissions for select using (public.is_admin());

-- settings
drop policy if exists settings_public_read on public.settings;
drop policy if exists settings_member_read on public.settings;
create policy settings_member_read on public.settings for select using (key in (
  'min_deposit','max_deposit','min_withdrawal','max_withdrawal','withdrawal_fee','withdrawals_per_day',
  'income_days','income_drop_days','welcome_bonus','checkin_bonus','streak_7','streak_14','streak_30',
  'withdrawal_days','withdrawal_start','withdrawal_end','withdrawal_mode','deposit_bank_1_name',
  'deposit_bank_1_account_number','deposit_bank_1_account_name','deposit_bank_2_name',
  'deposit_bank_2_account_number','deposit_bank_2_account_name','bank_name','account_number',
  'account_name','whatsapp_link','telegram_link','support_link','support_email'
));
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- cron runs
drop policy if exists cron_admin_read on public.cron_runs;
create policy cron_admin_read on public.cron_runs for select using (public.is_admin());

-- support tickets
drop policy if exists tickets_self_all on public.support_tickets;
drop policy if exists tickets_self_read on public.support_tickets;
create policy tickets_self_read on public.support_tickets for select using (auth.uid() = user_id);
drop policy if exists tickets_self_insert on public.support_tickets;
create policy tickets_self_insert on public.support_tickets for insert with check (auth.uid() = user_id);
drop policy if exists tickets_admin_all on public.support_tickets;
create policy tickets_admin_all on public.support_tickets for all using (public.is_admin()) with check (public.is_admin());

-- audit log
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());

drop policy if exists impersonation_admin_all on public.admin_impersonation_sessions;
create policy impersonation_admin_all on public.admin_impersonation_sessions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------- function grants ----------------
revoke all on function public.sweep_income(int) from public, anon, authenticated;
revoke all on function public.approve_deposit(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.reject_deposit(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.approve_withdrawal(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.complete_gateway_withdrawal(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.record_gateway_withdrawal_failure(uuid,text) from public, anon, authenticated;
revoke all on function public.record_gateway_withdrawal_submission(uuid,text) from public, anon, authenticated;
revoke all on function public.reject_withdrawal(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.admin_adjust_wallet(uuid,uuid,numeric,text,text) from public, anon, authenticated;
revoke all on function public.admin_grant_lease(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.admin_set_ban(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.admin_impersonate(uuid,uuid) from public, anon, authenticated;

revoke all on function public.lease_unit(uuid,uuid) from public, anon, authenticated;
revoke all on function public.do_checkin(uuid) from public, anon, authenticated;
revoke all on function public.request_withdrawal(uuid,numeric,uuid) from public, anon, authenticated;
revoke all on function public.grant_welcome_bonus(uuid,numeric,text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.is_admin() from public, anon;

grant execute on function public.lease_unit(uuid,uuid) to service_role;
grant execute on function public.do_checkin(uuid) to service_role;
grant execute on function public.request_withdrawal(uuid,numeric,uuid) to service_role;
grant execute on function public.grant_welcome_bonus(uuid,numeric,text) to service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.sweep_income(int) to service_role;
grant execute on function public.approve_deposit(uuid,uuid,text) to service_role;
grant execute on function public.reject_deposit(uuid,uuid,text) to service_role;
grant execute on function public.approve_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.complete_gateway_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.record_gateway_withdrawal_failure(uuid,text) to service_role;
grant execute on function public.record_gateway_withdrawal_submission(uuid,text) to service_role;
grant execute on function public.reject_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.admin_adjust_wallet(uuid,uuid,numeric,text,text) to service_role;
grant execute on function public.admin_grant_lease(uuid,uuid,uuid) to service_role;
grant execute on function public.admin_set_ban(uuid,uuid,boolean) to service_role;
grant execute on function public.admin_impersonate(uuid,uuid) to service_role;

-- ---------------- promote your admin ----------------
-- update public.profiles set is_admin = true
-- where email = 'your@email.com';
