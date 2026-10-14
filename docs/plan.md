# 作業計画

## 目的

Rails 版 man-hour を Cloudflare Workers に移植し、authentik SSO でユーザーごとのデータにする。

## 方針 (2026-10-14 決定)

- 言語: TypeScript + Hono (Workers ネイティブで一番素直)
- DB: D1
- 認証: Cloudflare Access の IdP に authentik を OIDC 登録。Worker は Access JWT を検証するだけ
- PDF: ブラウザの印刷機能。ダメなら Cloudflare Browser Rendering に切り替える → 印刷で問題なかったので不要
- リポジトリ: kusanaginoturugi/man-hour-cf (public)

## 残タスク

- [x] `wrangler deploy` (2026-10-14、https://man-hour-cf.kusanaginoturugi.workers.dev 、D1 man-hour 自動作成)
- [ ] リモート D1 マイグレーション (`npm run db:migrate`)
- [ ] authentik と Cloudflare Access の設定 (README 参照)、`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` を secret に登録
- [ ] 実ブラウザ (Arch の Chromium / Windows 11 の Edge) で印刷プレビューのヘッダ・ページ番号を確認
- [ ] 旧版の本番データがあれば移行 (手元の development.sqlite3 は空だった)
