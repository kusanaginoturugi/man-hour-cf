# 作業記録

## 2026-10-24 脆弱性点検

- `npm audit`: 3件（moderate 2、high 1）→ 0件。`npm audit --omit=dev` は前後とも0件。
- `wrangler` を 4.150.0 → 4.152.0、`jose` を 6.2.12 → 6.2.13 に更新。`typescript` は 7.0.2 が最新版、`hono` は 4.13.13 が最新版。
- 残った指摘は開発依存 `wrangler` → `miniflare` → `undici` 7.29.1 に由来。`undici` 7.30.1 へ override し、全件解消。`miniflare` が修正版 `undici` を直接採用したら override を外す。
- `hono/body-limit` でリクエスト本文を 64 KiB に制限。認証は Access JWT 検証、CSRF は Origin チェック、D1 は bind と所有者条件を使用。外部 URL・ファイルパス入力はない。HTML は JSX のエスケープを使用し、印刷ページの CSS 文字列もエスケープしている。
- `master` 向け CI（型チェック・本番依存監査）、CodeQL、PR の Dependency Review、npm / GitHub Actions の週次 Dependabot 更新を追加。Actions は Node 24 対応版に更新。GitHub の Dependabot 脆弱性アラートを有効化し、GET で HTTP 204、直後の open alert 0件を確認。ブランチ保護設定、security updates、デプロイは変更していない。
- 検証: `npm ci`、`npm run typecheck`、`npx wrangler deploy --dry-run`、`npm audit`、`npm audit --omit=dev --audit-level=high` 成功。ローカルで 65537 バイトの POST は 413、通常の認証なし POST は 403。既存のテスト・ビルドスクリプトはない。

## 2026-10-14 初期移植

- Rails 版の顧客 / ジョブ種類 / 作業 / 月次集計 / 報告書 / 検索を Hono + D1 で再実装
- 全テーブルに `user_id`、所有者チェックを全クエリに入れた
- 月次集計を計算方式に変更、月予算・初期繰越を顧客ごとの設定に
- 削除・更新は POST フォーム、`hono/csrf` で Origin チェック、flash は Cookie
- 印刷ページ: `@page` マージンボックスでヘッダと `n of m` を出す
  - Google Fonts (Noto Sans JP) を読むと Chromium 154 headless でマージンボックスの文字が消えることを確認
  - 単一ファイルの `@font-face` なら出るので、旧リポジトリ `.fonts` の Source Han Sans JP Regular/Bold を `public/fonts` から配信
- 確認したこと (wrangler dev + curl + headless Chromium)
  - CRUD 一式、月次集計の数値 (9月 3h → −15、10月 0.5h → −32.5、別予算除外、1日 00:00 を当月に含む)
  - 他ユーザーの顧客・作業の参照・選択・更新・削除が 404、他ユーザーの顧客/種類 ID での登録が拒否される
  - Origin なしの POST が 403
  - 28 件の月で PDF 3 ページ、全ページにヘッダとページ番号、フォント埋め込み
