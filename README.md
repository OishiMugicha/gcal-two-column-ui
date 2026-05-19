# 予定・実績カレンダー

Google Calendar の「予定」と「実績」を、週表示の2列で比較・編集する Web アプリです。

## ローカル動作確認

Google OAuth と Calendar API を含めて確認する場合は、Vite 単体の `npm run dev` ではなく Vercel CLI 経由で起動します。`api/` 配下の Vercel Functions も同じ `localhost:3000` で動きます。

### 1. Google Cloud を設定する

1. Google Cloud Console で Google Calendar API を有効化します。
2. OAuth クライアント ID を作成します。
   - アプリケーションの種類: Web アプリケーション
   - 承認済みのリダイレクト URI: `http://localhost:3000/api/auth/google/callback`
3. OAuth 同意画面がテスト公開の場合は、利用する Google アカウントをテストユーザーに追加します。

### 2. KV を用意する

ログイン後の refresh token は、暗号化して KV に保存します。ローカル確認用に Upstash Redis または Vercel KV 互換の REST API URL/token を用意してください。

必要な値:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### 3. 環境変数を設定する

`.env.example` を参考に `.env.local` を作成し、実値を設定します。

```env
VITE_FULLCALENDAR_LICENSE_KEY=GPL-My-Project-Is-Open-Source
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SESSION_SECRET=replace-with-a-long-random-secret
KV_REST_API_URL=https://your-kv-instance.upstash.io
KV_REST_API_TOKEN=your-kv-rest-api-token
```

`SESSION_SECRET` は十分に長いランダム文字列にしてください。`.env.local` は Git 管理しません。

### 4. 起動する

```powershell
npm install
npm run check:local-env
npm run dev:vercel
```

ブラウザで `http://localhost:3000` を開きます。

### 5. 確認する項目

- Google でログインできる
- カレンダー一覧が表示される
- 予定カレンダーと実績カレンダーを選択できる
- 週表示で予定と実績が2列に分かれて表示される
- 予定を作成、編集、削除できる
- 変更が Google Calendar 側にも反映される

## npm scripts

- `npm run dev`: Vite 単体で起動します。API は動かないため、Google 連携の確認には使いません。
- `npm run dev:vercel`: Vercel CLI でフロントエンドと API を起動します。
- `npm run check:local-env`: ローカル確認に必要な環境変数の不足を確認します。
- `npm test`: Vitest を実行します。
- `npm run build`: TypeScript と Vite の本番ビルドを実行します。

## Vercel デプロイ

Vercel にデプロイする場合は、Framework Preset に `Vite` を選び、Build Command を `npm run build`、Output Directory を `dist` にします。

本番環境にも次の環境変数を設定します。

- `VITE_FULLCALENDAR_LICENSE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `SESSION_SECRET`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

本番 URL が確定したら、Google Cloud Console の OAuth クライアントに次の形式のリダイレクト URI を追加してください。

```text
https://your-domain.vercel.app/api/auth/google/callback
```

## ライセンス

このリポジトリは `GPL-3.0-only` です。FullCalendar Scheduler/Premium は GPLv3 OSS として利用する前提です。個人利用・評価用途を超える場合は、FullCalendar のライセンス条件を確認してください。
