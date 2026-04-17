# Fight Card Display Mock

格闘ゲーム風の演出で対戦カードを表示する、静的 HTML / CSS / JavaScript のモック実装です。

## 概要

このリポジトリには、以下の表示状態を含む VS 画面の最小実装が入っています。

- 待機状態
- シャッフル中
- 確定演出

主な特徴:

- 左右の画像が高速に切り替わるシャッフル演出
- `対戦決定` ボタンで減速しながら停止
- 左右で同一人物が重複しないランダム選出ロジック
- 画像素材がなくても確認できるよう、JavaScript で SVG ダミー画像を自動生成
- GitHub Pages などの静的ホスティングに載せやすい構成

## ファイル構成

```text
.
├─ display.html
├─ style.css
├─ script.js
├─ README.md
└─ .gitignore
```

## 使い方

### 1. ローカルで確認する

`display.html` をブラウザで開くだけで動作します。

```bash
open display.html
```

または VS Code の Live Server などでも確認できます。

### 2. 操作方法

- `シャッフル開始`: 左右の画像が高速切替
- `対戦決定`: 減速しながら停止してカード確定
- `次のカードへ`: 待機状態へ戻す

キーボード操作:

- `Space`: シャッフル開始
- `Enter`: 対戦決定

## 実画像に差し替える方法

現在は `script.js` 内でダミー SVG 画像を生成しています。
実際の参加者写真を使う場合は、`baseParticipants` を次のように差し替えてください。

```js
const participants = [
  { id: "p1", name: "TAKA", image: "./assets/img/participants/taka.jpg" },
  { id: "p2", name: "YUJI", image: "./assets/img/participants/yuji.jpg" },
  { id: "p3", name: "AKIRA", image: "./assets/img/participants/akira.jpg" }
];
```

その場合は `createFighterSvgDataUrl()` を使わない構成に変更できます。

## 今後の拡張候補

- 管理画面の追加
- 参加者の画像アップロード
- 抽選対象 ON / OFF
- 既出カードの除外
- 対戦履歴の保存
- 効果音 / BGM
- GitHub Pages 用のトップページ最適化

## GitHub に初回 push する例

空の GitHub リポジトリを作成した後、ローカルで以下を実行します。

```bash
git init
git add .
git commit -m "Initial commit: fight card display mock"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

## GitHub Pages で公開する例

1. GitHub に push
2. リポジトリの `Settings` → `Pages`
3. `Deploy from a branch` を選択
4. `main` ブランチ / `/ (root)` を指定

これで静的ページとして公開できます。

## ライセンス

必要に応じて MIT License などを追加してください。
