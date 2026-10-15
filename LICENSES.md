# 使っているもののライセンス

| もの | ライセンス | 場所 |
|---|---|---|
| Phaser 4.2.1 | MIT | `vendor/phaser.esm.min.js`（`vendor/PHASER-LICENSE.md`） |
| Phaser公式スキル | MIT（Phaser本体に同梱） | `.claude/skills/` |
| Klee One SemiBold（使う文字だけ抜き出し） | SIL Open Font License 1.1 | `assets/fonts/rakugaki.woff`（`assets/fonts/OFL.txt`） |

- 絵はすべてコードで描いている（`src/fx/doodle.js`）。画像素材は使っていない
- 音はすべてWebAudioで合成している（`src/fx/audio.js`）。音声素材は使っていない
- テストにだけ Playwright（Apache-2.0）を使う（公開ページには含まれない）
