# man-hour-cf

工数入力システム (旧 Rails 版 man-hour) の Cloudflare Workers 版。開発者かつ唯一のユーザーは自分。

- TypeScript は薄く書く。クラスや抽象化は増やさず、関数とテンプレート (`hono/jsx`) だけで済ませる
- 構成: `src/index.tsx` ルーティングと SQL / `src/views.tsx` 画面 / `src/lib.ts` 日時・月次集計・認証 / `migrations/` D1 スキーマ
- すべてのクエリに `user_id` 条件を付ける。顧客・ジョブ種類の ID をフォームから受けるときは所有者を確認する
- 日時は JST ローカル時刻の文字列 (`YYYY-MM-DD HH:MM`)。`Date` の getMonth() などローカルタイム依存の API は使わない
- 月次集計は保存しない。`buildSummaries` で毎回計算する
- 確認: `npm run typecheck`、`npm run dev` で localhost:8787 (`.dev.vars` の `DEV_USER_EMAIL` でログイン扱い)
- 作業計画・作業記録・引き継ぎは `docs/` に置き、push 前に更新する
