# 引き継ぎ

- 現状: ローカル (`wrangler dev`) で一通り動作確認済み。まだデプロイしていない
- 次にやること: `docs/plan.md` の残タスク
- 注意
  - `DEV_USER_EMAIL` は localhost からのアクセスでしか効かないが、本番の vars/secret には入れないこと
  - `ACCESS_*` 未設定だと全部 401 (fail closed)
  - `worker-configuration.d.ts` は `npm run typecheck` で生成する (git 管理外)
  - npm の install scripts は `package.json` の `allowScripts` で esbuild / workerd だけ許可している
