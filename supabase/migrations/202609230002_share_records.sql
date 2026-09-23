-- 参加者全員の記録を、ログイン済み参加者の地図に表示する。
drop policy if exists "Users can read their own records" on public.onomatopoeia_records;
drop policy if exists "Authenticated users can read all records" on public.onomatopoeia_records;

create policy "Authenticated users can read all records"
on public.onomatopoeia_records
for select
to authenticated
using (true);
