# man-hour-cf

工数入力システム [man-hour](https://github.com/kusanaginoturugi/man-hour) (Rails) を Cloudflare Workers に移植したもの。

- Hono + `hono/jsx` によるサーバーサイドレンダリング (クライアント JS なし)
- D1 (SQLite)。全テーブルに `user_id` を持ち、ユーザーごとにデータを分離
- 認証は Cloudflare Access。IdP に authentik (OIDC) を登録し、Worker は Access の JWT を検証して email をユーザー ID にする
- PDF はブラウザの印刷機能で出力 (`/jobs/report/print`、A4 横、ヘッダとページ番号付き)

## ローカル開発

```sh
mise install
npm install
cp .dev.vars.example .dev.vars     # DEV_USER_EMAIL のユーザーとしてログイン扱いになる (localhost のみ)
npm run db:migrate:local
npm run dev                        # http://localhost:8787
npm run typecheck
```

## デプロイ

```sh
npx wrangler login                 # CLOUDFLARE_API_TOKEN が設定済みなら不要
npx wrangler deploy                # D1 データベース man-hour は初回に自動作成され、ID が wrangler.jsonc に入る
npm run db:migrate                 # リモート D1 にマイグレーション適用
npx wrangler secret put ACCESS_TEAM_DOMAIN   # 例: https://<team>.cloudflareaccess.com
npx wrangler secret put ACCESS_AUD           # Access アプリケーションの AUD タグ
```

`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` が未設定のときは全リクエストを 401 で拒否する。

## Cloudflare Access + authentik

1. authentik で OAuth2/OpenID Provider と Application を作る
   - Redirect URI: `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`
   - Scope: `openid` `email` `profile`
2. Cloudflare Zero Trust → Settings → Authentication → Login methods に OpenID Connect を追加
   - Client ID / Secret と、authentik の Auth URL / Token URL / Certificate URL を入れる
   - Cloudflare から authentik に到達できる必要がある (LAN 内だけなら Cloudflare Tunnel などで公開する)
3. Zero Trust → Access → Applications で Self-hosted アプリを作り、Worker のホスト名 (`man-hour-cf.<sub>.workers.dev` かカスタムドメイン) を保護対象にする。Login method は authentik だけにする
   - workers.dev の場合は Worker の Settings → Domains & Routes から Access を有効化してもいい
4. アプリの AUD タグを `ACCESS_AUD` に入れる

ログアウトは `/cdn-cgi/access/logout`。

## 旧版からの主な変更

- 月次集計 (`monthly_summaries`) はテーブルに保存せず毎回計算する
  - 式は旧版と同じ: 繰越 = 前月繰越 + 当月合計 (別予算を除く) − 月予算
  - 旧版は保存時にその月だけ更新していたので、過去月を直しても翌月以降の繰越がずれていた。毎回計算なのでずれない
  - 月予算 (旧版は 18h 固定) と初期繰越は顧客ごとに設定する
  - 最初に作業がある月から途切れなく積み上げる。旧版は作業のない月があると繰越が 0 にリセットされていた (旧版の実装上の都合と判断)
- 月の範囲は `1日 00:00 <= 開始時刻 < 翌月1日 00:00`。旧版の報告書は 1日 00:00 ちょうどの作業を落としていた
- 選択中の顧客は DB (`user_settings`) に保存するので端末をまたいで引き継がれる。表示月は URL (`/jobs?ym=2026-10`) で持つ
- 報告書ヘッダの会社名 (旧版は「冬水社」固定) は設定画面で変更する
- 使われていなかった `cost` / `place` カラムは削除
- 日時は Asia/Tokyo のローカル時刻を `YYYY-MM-DD HH:MM` 文字列で保存する

## フォント

`public/fonts/` の Source Han Sans JP は SIL Open Font License 1.1 (© Adobe)。
印刷ページで Google Fonts のような unicode-range 分割フォントを使うと、Chrome で `@page` のマージンボックス (ヘッダ・ページ番号) が描画されなくなるため、単一ファイルのフォントを自前で配信している。
