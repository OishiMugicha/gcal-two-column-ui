# 予定・実績カレンダー

Google Calendar の「予定」と「実績」を、週表示の各日2レーンで横並び比較するWebアプリです。

## セットアップ

1. Google Cloud ConsoleでGoogle Calendar APIを有効化します。
2. OAuthクライアントID（Webアプリ）を作成し、承認済みJavaScript生成元に開発サーバーのURLを追加します。
3. `.env.example` を参考に `.env.local` を作成します。
4. 依存関係をインストールして起動します。

```powershell
npm install
npm run dev
```

## Vercel デプロイ

このアプリは Vite の静的アプリとして Vercel にデプロイできます。

1. GitHub リポジトリを公開リポジトリにします。
2. Vercel で GitHub リポジトリをインポートします。
3. Framework Preset は `Vite` を選択します。
4. Build Command は `npm run build`、Output Directory は `dist` を設定します。
5. Environment Variables に以下を設定します。
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_FULLCALENDAR_LICENSE_KEY=GPL-My-Project-Is-Open-Source`
6. Vercel の本番URLが確定したら、Google Cloud Console の OAuth クライアントで「承認済み JavaScript 生成元」にその URL を追加します。
7. Google OAuth のテストユーザーまたは公開設定で、自分の Google アカウントが利用できる状態にします。

FullCalendar Premium/Scheduler は GPLv3 OSS として利用する前提です。このリポジトリは `GPL-3.0-only` として公開してください。

## MVP仕様

- 週表示のみ
- 日曜始まり
- 各日を「予定」「実績」の2レーンに分割
- 予定カレンダーは読み取り専用
- 実績カレンダーはドラッグ選択で新規作成
- 実績の編集・削除はGoogle Calendar側で実施

FullCalendar Scheduler/Premiumを使います。個人利用・評価用途を超える場合はライセンスを確認してください。
