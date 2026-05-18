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

## MVP仕様

- 週表示のみ
- 日曜始まり
- 各日を「予定」「実績」の2レーンに分割
- 予定カレンダーは読み取り専用
- 実績カレンダーはドラッグ選択で新規作成
- 実績の編集・削除はGoogle Calendar側で実施

FullCalendar Scheduler/Premiumを使います。個人利用・評価用途を超える場合はライセンスを確認してください。
