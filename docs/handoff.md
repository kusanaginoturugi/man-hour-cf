# 引き継ぎ

- 現状: https://man-hour-cf.kusanaginoturugi.workers.dev にデプロイ済み。Access 未設定なので全リクエスト 401
- 認証は `CLOUDFLARE_API_TOKEN` 環境変数 (wrangler login は不要)
- 次にやること: `docs/plan.md` の残タスク
- 注意
  - `DEV_USER_EMAIL` は localhost からのアクセスでしか効かないが、本番の vars/secret には入れないこと
  - `ACCESS_*` 未設定だと全部 401 (fail closed)
  - `worker-configuration.d.ts` は `npm run typecheck` で生成する (git 管理外)
  - npm の install scripts は `package.json` の `allowScripts` で esbuild / workerd だけ許可している
