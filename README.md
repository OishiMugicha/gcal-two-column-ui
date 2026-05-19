# 予定・実績カレンダー

Google Calendar の「予定」と「実績」を、週表示の各日2レーンで横並び比較するWebアプリです。

## セットアップ

1. Google Cloud ConsoleでGoogle Calendar APIを有効化します。
2. OAuthクライアントID（Webアプリ）を作成し、承認済みのリダイレクトURIに `/api/auth/google/callback` のURLを追加します。
3. `.env.example` を参考に `.env.local` を作成します。
4. 依存関係をインストールして起動します。

```powershell
npm install
vercel dev
```

## Vercel デプロイ

このアプリは Vite の静的アプリとして Vercel にデプロイできます。

1. GitHub リポジトリを公開リポジトリにします。
2. Vercel で GitHub リポジトリをインポートします。
3. Framework Preset は `Vite` を選択します。
4. Build Command は `npm run build`、Output Directory は `dist` を設定します。
5. Environment Variables に以下を設定します。
   - `VITE_FULLCALENDAR_LICENSE_KEY=GPL-My-Project-Is-Open-Source`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `SESSION_SECRET`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
6. Vercel の本番URLが確定したら、Google Cloud Console の OAuth クライアントで「承認済みのリダイレクト URI」に `https://your-domain.vercel.app/api/auth/google/callback` を追加します。
7. Google OAuth のテストユーザーまたは公開設定で、自分の Google アカウントが利用できる状態にします。

FullCalendar Premium/Scheduler は GPLv3 OSS として利用する前提です。このリポジトリは `GPL-3.0-only` として公開してください。

## ログイン保持

Google OAuth はサーバー側の authorization code flow を使います。`GOOGLE_REDIRECT_URI` は Google Cloud Console の「承認済みのリダイレクト URI」に追加してください。Vercel では `https://your-domain.vercel.app/api/auth/google/callback`、ローカルの Vercel 開発環境では `http://localhost:3000/api/auth/google/callback` を設定します。

refresh token は Vercel KV/Redis に暗号化して保存し、ブラウザには httpOnly Cookie のセッションIDだけを保存します。ローカルで API Routes も含めて動作確認する場合は Vite 単体ではなく Vercel CLI の `vercel dev` を使ってください。

## MVP仕様

- 週表示のみ
- 日曜始まり
- 各日を「予定」「実績」の2レーンに分割
- 予定カレンダーは読み取り専用
- 実績カレンダーはドラッグ選択で新規作成
- 実績の編集・削除はGoogle Calendar側で実施

FullCalendar Scheduler/Premiumを使います。個人利用・評価用途を超える場合はライセンスを確認してください。
