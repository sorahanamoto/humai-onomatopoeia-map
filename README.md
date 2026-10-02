# HUMAI オノマトペウォーク

まち歩き中に感じたオノマトペを、位置情報・説明・任意の写真とともに記録し、参加者同士で地図上に共有するスマートフォン向けWebアプリです。

- 公開アプリ: https://humai-onomatopoeia-map.vercel.app/
- デモ: https://humai-onomatopoeia-map.vercel.app/?demo=1

## 主な機能

- メールアドレスと8桁の確認コードによるパスワードレス登録・ログイン
- 登録時の任意プロジェクトコード入力と、アカウントへの参加プロジェクト紐づけ
- 有効な同意文の表示と、同意日時・同意文バージョンのアカウント単位での保存
- Browser Geolocation APIによる現在地取得
- オノマトペ、必須の説明、任意の写真を現在地へ投稿
- ログイン済み参加者による全参加者の記録閲覧
- 地図マーカーの詳細表示から、他参加者が投稿した写真を閲覧
- 写真のリサイズ・圧縮と非公開Supabase Storageへの保存
- Supabase管理画面から記録データをCSV出力

## 技術構成

| 領域 | 採用技術 |
| --- | --- |
| フロントエンド | React 19 / TypeScript / Vite |
| 地図 | MapLibre GL JS / MapTiler（未設定時はOpenStreetMapタイル） |
| 認証 | Supabase Auth Email OTP |
| データベース | Supabase Postgres / Row Level Security |
| 写真 | Supabase Storage（非公開バケット、期限付きURL） |
| メール送信 | Supabase Custom SMTP / Resend |
| ホスティング | Vercel |

## 利用の流れ

1. メールアドレスと任意のプロジェクトコードを入力する。
2. メールに届いた8桁の確認コードを入力する。
3. 調査への参加同意を確認し、同意する。
4. 位置情報の利用を許可する。
5. 地図上の「この場所で記録」から、オノマトペ・説明・任意の写真を投稿する。
6. 地図上のマーカーを選び、全参加者の説明と投稿写真を確認する。

## ローカル開発

Node.js 20以降を推奨します。

```bash
git clone https://github.com/sorahanamoto/humai-onomatopoeia-map.git
cd humai-onomatopoeia-map
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`へ次の値を設定します。

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_MAPTILER_KEY=YOUR_MAPTILER_KEY
```

`VITE_MAPTILER_KEY`は任意です。未設定時はOpenStreetMapの地図タイルを使用します。

Supabase未設定でも `http://localhost:5173/?demo=1` で登録、8桁コード入力、同意、地図、記録の一連の画面を確認できます。デモ確認コードは `12345678` です。デモ入力はサーバーへ保存されず、再読み込みすると消えます。

## Supabaseセットアップ

新規環境では、SupabaseのSQL Editorで以下をファイル名順に実行します。

1. `supabase/migrations/202609230001_initial_schema.sql`
2. `supabase/migrations/202609230002_share_records.sql`
3. `supabase/migrations/202610020001_require_record_description.sql`
4. `supabase/migrations/202610020002_share_record_photos.sql`

4番目のマイグレーションは、写真バケットを非公開に保ったまま、ログイン済み参加者が全参加者の写真を期限付きURLで閲覧できるようにします。すでに運用中の環境では、このファイルだけを追加実行してください。

続いてSupabase Dashboardで次を設定します。

- Authentication > Providers: Emailを有効化
- Authentication > Email Templates: 確認メールへ `{{ .Token }}` を配置
- Authentication > URL Configuration: Site URLとRedirect URLへ本番URLを登録
- Project Settings > Authentication > SMTP Settings: ResendのSMTP情報を設定
- SQL Editor: 正式な同意文と必要なプロジェクトコードを登録

プロジェクトコードと同意文のSQL例は、初期マイグレーション末尾にあります。運営者向けの詳細は [docs/SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md) も参照してください。

## 写真の閲覧とセキュリティ

`record-photos` バケットは公開しません。ログイン済み参加者だけがStorageのSELECTポリシーを通過でき、ブラウザは有効期限1時間の署名付きURLを取得して写真を表示します。投稿者以外にも写真を共有するため、同意文には「投稿写真を他の参加者が閲覧できること」を明記してください。

投稿はユーザーIDごとのフォルダへ保存し、アップロードと削除は本人のフォルダだけに制限しています。データベースの記録も、作成時のユーザーID・同意履歴・任意のプロジェクトIDに紐づきます。

## Vercelへのデプロイ

1. VercelでこのGitHubリポジトリをImportする。
2. Framework PresetをViteにする。
3. `.env.local`と同じ3つの環境変数をProductionへ登録する。
4. デプロイ後のURLをSupabaseのSite URLとRedirect URLへ登録する。
5. スマートフォンのSafariとChromeで、OTP、同意、位置情報、投稿、他参加者の写真表示を確認する。

`main` ブランチへのpush後はVercelが自動デプロイします。SQLマイグレーションはVercelからは実行されないため、Supabase SQL EditorまたはSupabase CLIで別途適用してください。

## データ出力

投稿データはSupabase DashboardのTable Editorで `onomatopoeia_records` を開き、CSVとして出力できます。写真そのものはStorageへ保存され、CSVの `photo_path` にはファイルの保存先が入ります。調査用データを配布する際は、位置情報・自由記述・写真に個人を特定しうる情報が含まれないか確認してください。

## 開発コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 型チェックと本番ビルド
npm run lint     # 静的解析
npm run preview  # 本番ビルドのローカル確認
```

## データと公開範囲

- 一般参加者はURLを知っていれば登録できます。
- 地図、記録、説明、写真はログインと同意の完了後に閲覧できます。
- ログイン済み参加者には、プロジェクトの違いにかかわらず全参加者の記録を表示します。
- プロジェクトコードは任意で、データベースには平文ではなくハッシュを保存します。
- 写真は非公開Storageへ保存し、期限付きURLで表示します。
- 同意文のバージョンと同意日時をアカウントへ紐づけて保存します。

## 公開前チェック

- 同意文に収集項目、利用目的、閲覧範囲、保存期間、問い合わせ先、撤回・削除方法を記載したか
- 他参加者が説明・位置情報・写真を閲覧することを明記したか
- Resendの送信ドメインとSupabase SMTPが正常に動作するか
- Supabaseの全マイグレーションを適用したか
- Vercelの環境変数とSupabaseのURL Configurationが本番URLに合っているか
- iPhone Safari / Android Chromeで位置情報とカメラ・写真選択が動作するか
- 投稿写真を別アカウントから閲覧できるか

## ライセンス

現時点ではライセンスを指定していません。第三者による再利用・再配布については、プロジェクト管理者へ確認してください。
