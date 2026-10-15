# セキュリティについて / Security Policy

## 脆弱性を見つけたら
このリポジトリの **Security → Report a vulnerability**（非公開の脆弱性報告）から知らせてください。
Issue・X・その他の公開の場には書かないでください。確認して、修正したらお知らせします。

Please report vulnerabilities privately via **Security → Report a vulnerability**. Do not open public issues.

## このゲームの前提
- 静的なページだけで動きます。サーバーの処理、ログイン、入力フォームはありません
- 個人情報を集めません。セーブはあなたの端末（ブラウザの localStorage）の中だけです
- 外部との通信をしません（Content-Security-Policy で `connect-src 'none'`）。外部のスクリプト・広告・アクセス解析はありません

## 対象
公開中の最新版（`main` ブランチ）。
