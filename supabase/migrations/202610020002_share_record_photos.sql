-- 写真バケットは非公開のまま、ログイン済み参加者が全参加者の投稿写真を閲覧できるようにする。
drop policy if exists "Users can read their own record photos" on storage.objects;
drop policy if exists "Authenticated users can read record photos" on storage.objects;

create policy "Authenticated users can read record photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'record-photos');
