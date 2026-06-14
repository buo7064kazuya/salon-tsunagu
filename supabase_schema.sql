-- salon-tsunagu Supabase スキーマ
-- Supabase の SQL Editor で実行してください

create table if not exists staff (
  id        bigserial primary key,
  name      text      not null,
  role      text      not null default '',
  color     text      not null default '#C9A96E',
  created_at timestamptz default now()
);

create table if not exists menus (
  id        bigserial primary key,
  name      text      not null,
  price     integer   not null default 0,
  duration  integer   not null default 60,
  category  text      not null default 'その他',
  created_at timestamptz default now()
);

create table if not exists customers (
  id          bigserial primary key,
  name        text      not null,
  phone       text      not null default '',
  email       text      not null default '',
  notes       text      not null default '',
  visit_count integer   not null default 0,
  created_at  timestamptz default now()
);

create table if not exists appointments (
  id          bigserial primary key,
  customer_id bigint    not null references customers(id) on delete cascade,
  staff_id    bigint    not null references staff(id) on delete cascade,
  menu_id     bigint    not null references menus(id) on delete cascade,
  date        date      not null,
  time        text      not null,
  duration    integer   not null default 60,
  notes       text      not null default '',
  status      text      not null default 'confirmed',
  created_at  timestamptz default now()
);

-- Row Level Security (RLS) を有効化
alter table staff        enable row level security;
alter table menus        enable row level security;
alter table customers    enable row level security;
alter table appointments enable row level security;

-- 開発用: 全操作を許可するポリシー（本番では認証ポリシーに変更してください）
create policy "allow_all_staff"        on staff        for all using (true) with check (true);
create policy "allow_all_menus"        on menus        for all using (true) with check (true);
create policy "allow_all_customers"    on customers    for all using (true) with check (true);
create policy "allow_all_appointments" on appointments for all using (true) with check (true);

-- サンプルデータ（任意）
insert into staff (name, role, color) values
  ('田中 花子', 'シニアスタイリスト', '#C9A96E'),
  ('鈴木 美咲', 'スタイリスト',       '#8B6F9E'),
  ('佐藤 優子', 'アシスタント',       '#5CA89E');

insert into menus (name, price, duration, category) values
  ('カット',         5500,  60, 'カット'),
  ('カラー',         8800,  90, 'カラー'),
  ('パーマ',        11000, 120, 'パーマ'),
  ('トリートメント',  3300,  30, 'ケア'),
  ('ヘッドスパ',      4400,  45, 'ケア'),
  ('カット+カラー',  13200, 150, 'セット');

insert into customers (name, phone, email, notes, visit_count) values
  ('山田 太郎',   '090-1234-5678', 'yamada@example.com',   'アレルギーあり',     5),
  ('伊藤 花子',   '080-2345-6789', 'ito@example.com',      '',                  12),
  ('佐々木 健太', '070-3456-7890', 'sasaki@example.com',   'ショートカット希望',  3),
  ('中村 恵子',   '090-4567-8901', 'nakamura@example.com', '',                   8);
