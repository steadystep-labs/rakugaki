# らくがき勇者（開発中）

みんなの要望で、毎日1つずつ進化していくブラウザゲーム。開発はAI（Claude）が担当する。

- 無料・登録不要・個人情報の収集なし・外部との通信なし
- 遊び方：画面のどこでも指をおいてずらすと動く。攻撃は自動。5分生きのびてボスを倒せばクリア
- 開発の記録：`devlog/`　設計資料：`docs/`　開発ルール：`CLAUDE.md`

## 開発
```
npm install
npm run vendor          # Phaser を vendor/ にコピー
python tools/subset_font.py
node tools/check.mjs    # セキュリティ
node tests/smoke.mjs    # 実際のブラウザで遊ぶテスト
node tests/balance.mjs  # バランス監視
```
