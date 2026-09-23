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

## 現在のプライバシー方針

- 参加者の記録は本人だけが閲覧できます。
- 写真は非公開Storageへ保存されます。
- 他参加者への記録公開は、仕様確定後にRLSとUIを追加します。
- プロジェクトコードは平文保存せず、データベース内でハッシュ照合します。
