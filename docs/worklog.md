# 作業記録

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
