# 引き継ぎ

- 現状: https://man-hour-cf.kusanaginoturugi.workers.dev で稼働中。Cloudflare Access (チーム showway) で保護済み
  - Access の AUD は workers.dev の Access 有効化で自動作成されたアプリのもの
  - Login method はまだ authentik に絞っていない
- 認証は `CLOUDFLARE_API_TOKEN` 環境変数 (wrangler login は不要)
- 次にやること: `docs/plan.md` の残タスク
- 注意
  - `DEV_USER_EMAIL` は localhost からのアクセスでしか効かないが、本番の vars/secret には入れないこと
  - `ACCESS_*` 未設定だと全部 401 (fail closed)
  - `worker-configuration.d.ts` は `npm run typecheck` で生成する (git 管理外)
  - npm の install scripts は `package.json` の `allowScripts` で esbuild / workerd だけ許可している
  - `wrangler.jsonc` に `database_id` を入れたのでローカル D1 は別ファイルになった。ローカルで `no such table` が出たら `npm run db:migrate:local`
