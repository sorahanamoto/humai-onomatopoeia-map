# HUMAI オノマトペマップ

一般参加者が、まち歩き中に感じたオノマトペをGPSと一緒に記録するスマートフォン向けWebアプリです。

## 採用技術

- React + TypeScript + Vite
- Supabase Auth / Postgres / Storage
- MapLibre GL JS + MapTiler
- Vercel

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase未設定でも、`http://localhost:5173/?demo=1`でアカウント登録、確認コード、同意、地図、記録の一連の操作を確認できます。デモの確認コードは`123456`です。入力内容はブラウザを再読み込みすると消えます。

`.env.local`へSupabaseとMapTilerの公開キーを設定してください。

## Supabase

1. Supabaseで新しいプロジェクトを作成します。
2. SQL Editorで`supabase/migrations/202609230001_initial_schema.sql`を実行します。
3. AuthenticationのEmail Providerを有効にします。
4. 一般参加者へメールOTPを送る本番環境ではCustom SMTPを設定します。
5. SQL Editorで正式な同意文と必要なプロジェクトコードを追加します。

プロジェクトコードと同意文を追加するSQL例は、マイグレーション末尾にコメントで記載しています。

公開までの詳しい手順は[`docs/SETUP_CHECKLIST.md`](docs/SETUP_CHECKLIST.md)を参照してください。

## コマンド

```bash
npm run dev
npm run build
npm run lint
```

## 現在の公開方針

- ログイン済み参加者は、全参加者のオノマトペ記録を地図で閲覧できます。
- 写真は非公開Storageへ保存されます。
- 現在の地図では他参加者の写真を表示しません。
- プロジェクトコードは平文保存せず、データベース内でハッシュ照合します。
