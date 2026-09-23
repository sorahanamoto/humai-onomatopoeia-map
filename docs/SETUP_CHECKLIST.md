# 公開までのセットアップ・チェックリスト

アプリ本体の初期実装後に、運営者が行う作業です。上から順に進めれば公開できます。

## 1. Supabaseを用意する

1. Supabaseで新しいプロジェクトを作成する。
2. SQL Editorを開き、`supabase/migrations/202609230001_initial_schema.sql`の内容を実行する。
3. Project Settings > APIから、Project URLとPublishable key（またはanon public key）を控える。
4. Authentication > ProvidersでEmailを有効にする。
5. 本番運用前にCustom SMTPを設定する。

メール認証は、パスワードを覚える必要がない6桁OTP方式です。Googleログインは初期版には入れず、設定項目を減らしています。

## 2. 同意文を登録する

次の内容を決定してから、SQL Editorで同意文を登録します。

- 調査・研究の目的
- 収集する情報（メールアドレス、位置情報、入力文、任意写真、時刻、プロジェクトコード）
- 記録を閲覧できる人
- 保存期間と削除方針
- 問い合わせ先
- 同意撤回・アカウント削除の方法
- 未成年者の参加条件

登録例：

```sql
insert into public.consent_versions (version, title, body, is_active)
values (
  '2026-01',
  '調査参加への同意',
  'ここに確定した同意文を入力してください。',
  true
);
```

新しい同意文を公開するときは、以前の版を`is_active = false`にしてから新しい版を追加します。参加者の同意履歴は版ごとにアカウントへ紐づきます。

## 3. プロジェクトコードを登録する

参加者へ配布するコードを決め、SQL Editorで登録します。

```sql
insert into public.projects (name, code_hash)
values (
  'HUMAI 実証実験 2026',
  crypt('配布するコード', gen_salt('bf'))
);
```

コードは任意入力です。未入力でも一般参加者として利用できます。不正なコードを入力した場合は、訂正または空欄への変更を求めます。データベースにはコードそのものではなくハッシュを保存します。

## 4. 地図を用意する

1. MapTilerでAPIキーを作成する。
2. 公開URLが決まったら、キーのURL制限を設定する。

開発中はMapLibreのデモ地図でも確認できますが、一般公開ではMapTilerキーを設定してください。

## 5. Vercelで公開する

1. VercelでGitHubリポジトリ`humai-onomatopoeia-map`をImportする。
2. Framework PresetがViteになっていることを確認する。
3. Environment Variablesへ次を登録する。

```text
VITE_SUPABASE_URL=SupabaseのProject URL
VITE_SUPABASE_ANON_KEY=SupabaseのPublishable keyまたはanon public key
VITE_MAPTILER_KEY=MapTilerのAPIキー
```

4. Deployする。
5. 公開URLをSupabaseのAuthentication > URL ConfigurationのSite URLへ登録する。
6. Redirect URLsにも公開URLを登録する。

## 6. スマートフォンで受け入れ確認する

- 新しいメールアドレスでOTPを受け取れる。
- プロジェクトコードあり／なしの両方で登録できる。
- 同意しない限り地図へ進めない。
- 同意日時と同意文の版が保存される。
- 位置情報を許可すると現在地が表示される。
- オノマトペだけで記録できる。
- 説明と写真を任意で追加できる。
- 位置情報を拒否した場合に案内が表示される。
- iPhone SafariとAndroid Chromeの双方で確認する。

## 仕様確定が必要な項目

初期版では安全側に寄せ、参加者は自分の記録だけを閲覧できます。次の実装へ進む前に決定が必要です。

1. 他の参加者の記録を地図に表示するか。
2. 表示する場合、同じプロジェクト内だけか、全参加者を対象にするか。
3. 写真も他の参加者へ公開するか。
4. 記録・アカウントの保存期間と削除方法。
5. プロジェクトコードを後から追加・変更できるようにするか。
