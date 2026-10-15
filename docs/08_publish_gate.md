# 08 公開の判定（どの状態になったら GitHub で公開してよいか）2026-10-15

公的機関・公式の一次情報をもとに、公開してよい条件を決めた。**「必須」がすべて「済」になったら公開してよい。**

## 参考にした一次情報
| 発行元 | 資料 | 使ったところ |
|---|---|---|
| GitHub（公式） | [Quickstart for securing your repository](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository) | 誰が触れるか、SECURITY.md、依存関係のアラート、秘密情報の検出、コードの自動検査 |
| GitHub（公式） | [About push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection) | 秘密情報を含む push を止める機能 |
| GitHub（公式） | [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) | 権限の最小化、コミットSHAでの固定、pull_request_target の危険性 |
| GitHub（公式） | [Configuring private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository) | 脆弱性を非公開で受け付ける窓口 |
| GitHub（公式） | [Requiring 2FA in your organization](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-two-factor-authentication-for-your-organization/requiring-two-factor-authentication-in-your-organization) | 組織の2要素認証の必須化 |
| GitHub（公式） | [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https) | HTTPSの強制、Pagesは公開される・機微な取引に使わない |
| IPA（独立行政法人 情報処理推進機構） | [安全なウェブサイトの作り方 改訂第7版](https://www.ipa.go.jp/security/vuln/websecurity.html) | ウェブの脆弱性11種類（XSS・クリックジャッキングなど）の対策 |
| 総務省 | [外部送信規律](https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu.html) | 利用者の情報を外部へ送る場合の公表義務 |
| 経済産業省 | OSSの利活用及びそのセキュリティ確保に向けた管理手法に関する事例集（2021年・2022年拡充） | 使っているOSSの把握・管理 |
| 個人情報保護委員会 | [ガイドラインQ&A](https://www.ppc.go.jp/personalinfo/faq/APPI_QA/) | 個人情報の定義（XのIDの扱いの判断） |
| 一次情報が見つからず「準ずるもの」 | 大阪府警察の注意喚起（SNS乗っ取り・多要素認証） | アカウントの多要素認証（NISC・IPAの該当ページそのものは見つからなかった） |

## 判定表

### A. コードとページの中身（リポジトリの中）
| # | 必須 | 項目（根拠） | 状態 |
|---|---|---|---|
| A1 | 必須 | 鍵・トークン・パスワードが入っていない（GitHub Quickstart：秘密情報） | **済**（パターン検索で0件。push protection（ユーザー単位）は既定で有効） |
| A2 | 必須 | 個人情報が入っていない。資料の呼び名も中立（個人情報保護委員会） | **済**（「taka」→「オーナー」、作者名は組織名、地名・勤め先なし） |
| A3 | 必須 | 利用者の情報を外部へ送らない（総務省 外部送信規律） | **済**（CSPで `connect-src 'none'`、外部スクリプト・解析・広告なし） |
| A4 | 必須 | XSS対策：外から来た文字をHTMLとして出さない（IPA 1-5） | **済**（innerHTML 等を自動チェックで禁止。文字はCanvasに描く） |
| A5 | 必須 | CSPで読み込み元を自分だけに制限（IPA 1-5 保険的対策） | **済**（`default-src 'self'`、`frame-src`・`worker-src`・`object-src 'none'`、`upgrade-insecure-requests` を追加） |
| A6 | 必須 | 同梱したOSSの把握と改ざん検知（経済産業省 OSS事例集） | **済**（LICENSES.md、Phaser の SHA-256 を自動チェック） |
| A7 | 必須 | 脆弱性の報告窓口（GitHub：SECURITY.md） | **済**（SECURITY.md） |
| A8 | 必須 | プライバシーの説明（総務省 外部送信規律の趣旨・透明性） | **済**（PRIVACY.md） |
| A9 | 必須 | 自動テストの仕組み（Actions：権限は読み取りだけ・SHA固定・pull_request_target 禁止・シークレットなし） | **済**（`.github/workflows/ci.yml`。違反は自動チェックで検出） |
| A10 | 必須 | 依存関係の監視設定（GitHub：Dependabot） | **済**（`.github/dependabot.yml`） |
| A11 | ― | クリックジャッキング対策（IPA 1-9：X-Frame-Options / frame-ancestors） | **対応できない → 受け入れる**。GitHub Pages ではHTTPヘッダーを設定できない。このゲームには「押すと取り返しがつかない操作」（購入・送信・削除など）がなく、被害が起きない |
| A12 | ― | `?test=1` の差し込み口 | **受け入れる**。自分の端末のゲームを早送りできるだけ（サーバーがないので他人に影響しない） |

### B. アカウントと組織（GitHub・X）
| # | 必須 | 項目（根拠） | 状態 |
|---|---|---|---|
| B1 | 必須 | taka-forge（組織のオーナー）が2要素認証を使っている（GitHub 2FA） | **オーナーの確認待ち** |
| B2 | 必須 | 組織で2要素認証を必須にする（GitHub：組織の2FA必須化） | **オーナーの作業待ち**（くろのトークンでは組織の設定を変えられない） |
| B3 | 推奨 | Xアカウントの多要素認証（認証アプリ。SMSは次善）（準ずる資料：大阪府警） | **オーナーの作業待ち** |
| B4 | 必須 | 組織のメンバー表示が Private | **済** |

### C. 公開と同時にやる設定（公開リポジトリでのみ無料で使えるもの）
| # | 必須 | 項目（根拠） | 状態 |
|---|---|---|---|
| C1 | 必須 | 秘密情報の検出＋push protection（リポジトリ単位） | 公開直後にくろが有効化 |
| C2 | 必須 | Dependabot アラートとセキュリティ更新 | 公開直後にくろが有効化 |
| C3 | 推奨 | コードの自動検査（CodeQL の標準設定） | 公開直後にくろが有効化 |
| C4 | 必須 | 非公開の脆弱性報告（Private vulnerability reporting） | 公開直後にくろが有効化 |
| C5 | 必須 | main ブランチの保護（強制pushと削除を禁止） | 公開直後にくろが設定 |
| C6 | 必須 | Issues・Wiki・Projects を無効化（要望の入口はXだけ。外から書ける場所を減らす） | 公開直後にくろが設定 |
| C7 | 必須 | GitHub Pages を有効化し、HTTPSを強制（GitHub Pages HTTPS） | 公開直後にくろが設定 |
| C8 | 必須 | 公開後に、公開URLでスモークテスト・目視（外部通信0・エラー0） | 公開直後にくろが確認 |

**C を先にやれないのは、無料プランでは非公開リポジトリでこれらの機能が使えないため。** 公開から設定完了までは数分。中身は公開前に検査済み（A1〜A10）なので、その数分のリスクは小さい。

## 結論（2026-10-15 時点）
- A（中身）：必須はすべて済
- **B（アカウント）：B1・B2 が残り** → オーナーの対応が終われば公開してよい状態
- C：公開と同時に設定する
