# 01 調査：人が遊び続けるゲームと、AIが作るゲームの品質（2026-10-13）

## 要点

- **ルールが一言で言えて、5秒で始められること。** Wordle・スイカゲーム・One Million Checkboxes に共通する条件。ブラウザでそのまま遊べることが「気になる → 遊ぶ」の距離を縮める
- **毎日来る理由は「日替わり」と「ネタバレしないシェア」で作る。** Wordleは1日1回しか遊べず、通知も登録もない。結果は文字を隠した色のグリッドで共有される
- **続けてもらえるかを決めるのは、上達している感覚（有能感）と自分で選べる感覚（自律性）。** 2023年の546人調査では、継続に効いていたのはこの2つで、人とのつながりは効いていなかった
- **「1回もムダにならない」成長が再挑戦を生む。** Vampire Survivors は、負けても持ち帰ったお金で少しずつ永続強化できる。累計すると攻撃力は約2.5倍になるが、プレイヤーは「自分がうまくなった」と感じる
- **くすぶらせる謎は「説明しない」「少しずつ見せる」で作る。** A Dark Room は目的を言わず、世界を少しずつ明かす作りで、iPhone有料アプリの1位になった。日本には「考察」をSNSで語る文化がある
- **みんなでやる楽しさは、伝説が生まれる余地から来る。** Twitch Plays Pokémon では偶然の出来事から「神」（Lord Helix）が生まれ、ファンが二次創作や記録係まで始めた
- **AIが作ったゲームが安っぽく見える原因は、見た目の既定値と手触りの欠如。** 対策は3つ：動きを具体的に指示する、重要度に応じて段階的に「気持ちいい反応」を重ねる、見た目の方向性を最初に決めて守る
- **AIに毎日改修させるなら、自動テストとセーブの互換性が生命線。** 時間を1コマずつ進める関数（`advanceTime`）と、状態を文字で出す関数（`render_game_to_text`）を用意して、Playwrightで実際に遊ばせて確認する

---

## 1. 広まったシンプルなゲームの共通点

| ゲーム | 広まった理由 | 使えるところ |
|---|---|---|
| Wordle | 1日1回だけ。通知も登録もない。文字を隠したグリッドでシェア。2020年11月に90人だったプレイヤーが、2021年1月には30万人に | 日替わりのお題と、ネタバレしない結果シェア |
| スイカゲーム | 配信者・VTuberに遊ばれて爆発。最初はほぼ反応なし | 見ていて面白い、真似したくなる動き |
| One Million Checkboxes | 全員が同じ盤面を見ている。くだらない行為が社会的になる | 「みんなで一つのものを動かしている」感覚 |
| Infinite Craft | 「First Discovery（世界で最初の発見）」が自慢になる。スクショが証拠になる | 希少な発見を見せびらかせる仕組み |
| A Dark Room / Candy Box | 目的を説明しない。少しずつ世界が明かされる。文字だけでもヒット | 謎と段階的な開示 |
| Vampire Survivors | 操作は移動だけで攻撃は自動。1回約30分。負けても永続強化が残る | 片手操作、成長の手応え、ムダにならない1回 |
| Universal Paperclips | 数字が増えるだけの入り口から、仕組みが次々に開いて、物語に変わる | 新しい仕組みの段階的な解放 |

## 2. 遊び続けてもらうための心理

- **有能感・自律性・つながり**（自己決定理論）：継続に効くのは有能感と自律性（2023年・546人の調査）。カジュアル層には「つながり」も効くという別の調査もある
- **外からのご褒美だけだと長続きしない**：連続ログインやアイテムの効き目は短い。上達や発見そのものが楽しい作りにする
- **いつも「次の目標」がある**：放置・インクリメンタル系では、今の仕組みを使いこなしたころに次の層を開く。最初の大きな節目（リセット＋永続強化など）は15〜20分で届くくらいがいい、という開発者の報告がある
- **更新ペースは、毎日の小さな更新と節目の大きな更新を分ける**：毎日大型更新をするとプレイヤーも開発も疲れる。「日替わりの小さな追加」と「週ごとの山場」に分ける

## 3. 「くすぶらせる」要素の作り方

- **説明しない**：目的を言わずに始める。プレイヤーが自分で気づくと、それが語りたくなる体験になる（A Dark Room）
- **手がかりを分散させる**：ゲーム内の断片、日替わりの更新履歴、SNSの投稿など、複数の場所に手がかりを置く。持ち寄ると答えに近づく
- **解釈の余白を残す**：答えを確定させすぎない。考察が続く
- **偶然から伝説が生まれる余地**：TPPの「Lord Helix」のように、プレイヤーが名前や意味をつけられる余白を残す
- **隠し要素を日替わりで1つ仕込む**：見つけた人がXで自慢でき、まだの人は探しに来る

## 4. AIが作るゲームの品質を一段上げるやり方

### 調べた公式・定番のスキル（中身を読んで、このプロジェクトのルールに取り込む）

| 出どころ | 中身 | 取り込むこと |
|---|---|---|
| Phaser公式（phaserjs/phaser の `skills/`、28個、MIT） | Phaser 4 の各機能（tween、パーティクル、カメラ、スケール、入力など） | ゲームエンジンにPhaserを使うなら、これを丸ごと参照する |
| OpenAI系の develop-web-game（trailofbits/skills-curated で配布） | 「小さく実装 → Playwrightで操作 → スクショと状態を確認 → 直す」の繰り返し。`advanceTime(ms)` と `render_game_to_text()` を用意する | テストの仕組みの土台 |
| gamedev-skills の game-feel（Apache-2.0） | 1回の気持ちいい当たりは、5〜8個の小さな反応（音・粒・一瞬の停止・光・ノックバック・揺れ・数字）が約100ミリ秒以内に重なってできている。重要度で3段階に分ける。揺れは減衰させる | 手触りのルール |
| gamedev-skills の game-ui-ux / audio-design / save-systems / prototype-fast | 画面端の安全領域、音はバス単位で管理して同じ音の連打は音程を少し揺らす、セーブにはバージョン番号を必ず入れる、試作には「捨てる基準」を先に決める | 画面・音・セーブ・試作のルール |
| Anthropic公式の frontend-design | AIっぽい既定デザイン（クリーム地＋テラコッタ、黒地＋蛍光1色、同じ角丸カードの羅列など）を避ける。色・書体・レイアウトを先に決めて、1か所だけ大胆にする | 見た目の方向性 |
| Anthropic公式の webapp-testing | Playwrightでローカルのページを開いて操作・確認する手順 | テストの手順 |

### 記事から拾った実務のコツ
- 「敵が追ってくる」程度は一発でできるが、個性のある挙動は具体的に指示しないと出ない（パックマンの4匹のゴーストの例）
- 絵と音は、コード用のAIの苦手分野。図形・ベクター・コードで作る音に寄せて、方向性を固定する
- 30分ごとに動く状態でコミットする。AIの「できました」は信じず、実際に遊んで確かめる
- 規模が大きくなるほど壊れやすい。仕組みを小さく分けて、毎日の追加は決まった差し込み口からだけ行う

### テストの考え方
- `advanceTime(ms)` で時間を決まった分だけ進め、`render_game_to_text()` で状態を読む。これでPlaywrightのテストが安定する
- 同じシード（乱数の種）でボットに何百回も遊ばせて、勝率・生存時間・成長の曲線を前日版と比べる → 毎日の追加でバランスが壊れていないかを機械的に見張る
- 気持ちよさは人間（と、くろの目視）で確かめる

## 5. 日本の市場
- 2025年のApp Storeのカジュアルゲーム上位191作品のうち、パズルが46.6%、脱出・謎解きが18.8%（スパイスマート調べ）
- スマホゲームを遊ぶ理由は「ひまつぶし」「手軽」が3〜4割（クロス・マーケティング、2026年6月、1,200人）

## 出典
- [Wordle（Wikipedia）](https://en.wikipedia.org/wiki/Wordle) ／ [Smithsonian：Why Wordle went viral](https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/) ／ [Dinogame：Why is Wordle so popular](https://dinogame.gg/blog/why-is-wordle-so-popular/)
- [Suika Game（Wikipedia）](https://en.wikipedia.org/wiki/Suika_Game) ／ [Nintendo Life](https://www.nintendolife.com/news/2023/10/random-switch-exclusive-watermelon-game-goes-viral-eshop-downloads-skyrocket)
- [One Million Checkboxes（Wikipedia）](https://en.wikipedia.org/wiki/One_Million_Checkboxes) ／ [Bryan Braun](https://www.bryanbraun.com/2024/08/10/one-million-checkboxes-and-the-fear-of-viral-success/)
- [Infinite Craft（Wikipedia）](https://en.wikipedia.org/wiki/Infinite_Craft) ／ [Prima Games：First Discovery](https://primagames.com/tips/what-does-first-discovery-mean-in-infinite-craft-answered)
- [Interface Lessons from A Dark Room（InformIT）](https://informit.com/articles/article.aspx?p=2228802) ／ [Cult of Mac](https://www.cultofmac.com/?p=277035)
- [The Secret Sauce of Vampire Survivors](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors)
- [Universal Paperclips（Eludamos）](https://eludamos.org/index.php/eludamos/article/view/vol10no1-7) ／ [Gamezebo review](https://www.gamezebo.com/reviews/universal-paperclips-review-filling-office-space/)
- [Game engagement theory（Wikipedia）](https://en.wikipedia.org/wiki/Game_engagement_theory) ／ [PolyU 2023 study](https://ira.lib.polyu.edu.hk/handle/10397/108587) ／ [UvA study](https://dare.uva.nl/id/dafce591-e552-4050-b979-3a2f04ec3cb8)
- [Twitch Plays Pokémon（Fanlore）](https://fanlore.org/wiki/Twitch_Plays_Pokemon) ／ [BMC：crowd behavior](https://blogs.biomedcentral.com/on-society/2019/06/25/what-twitch-plays-pokemon-tells-us-about-crowd-behavior/)
- [考察とは（flier）](https://www.flierinc.com/summary/4379) ／ [ファミ通](https://www.famitsu.com/article/202602/65620)
- [How to design an idle or incremental game（bugnet）](https://bugnet.io/blog/how-to-design-an-idle-or-incremental-game) ／ [Aura, Data and Prestige（DEV）](https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f)
- [Live Ops 101（firstlook）](https://firstlook.gg/blog/live-ops-101-player-retention) ／ [Early access retention（wayline）](https://www.wayline.io/blog/dream-game-early-access-retention)
- [Research: Making a juicy game](https://rpgplayground.com/research-making-a-juicy-game/)
- [phaserjs/phaser skills](https://github.com/phaserjs/phaser) ／ [trailofbits/skills-curated](https://github.com/trailofbits/skills-curated) ／ [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) ／ [anthropics/skills](https://github.com/anthropics/skills)
- [XDA：vibe-coded game that doesn't look vibe-coded](https://www.xda-developers.com/i-vibe-coded-a-fully-functional-game-with-claude-code-and-it-doesnt-look-vibe-coded-at-all/) ／ [wotai：10 arcade games](https://wotai.co/blog/wotai-games-vibe-coded-arcade-classics) ／ [sorceress：you need more than code](https://sorceress.games/blog/claude-vibe-coding-for-games-you-need-more-than-code) ／ [Claude Code for Game Development（Medium）](https://chierhu.medium.com/claude-code-for-game-development-7a88fcd19992)
- [Exploring Gameplay With AI Agents（arXiv）](https://arxiv.org/pdf/1811.06962v1.pdf)
- [gamebiz：カジュアルゲーム市場のジャンル構成](https://gamebiz.jp/news/423894) ／ [クロス・マーケティング 2026](https://www.cross-m.co.jp/report/20260722game)
