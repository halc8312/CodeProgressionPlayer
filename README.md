# Code Progression Player

コード進行を打ち込むと、歪みギター・ドラム・ルート弾きベースでバンドのデモ演奏をループ再生できる、ブラウザ完結（サーバー不要）の Web アプリです。音は [Tone.js](https://tonejs.github.io/)（Web Audio API）でリアルタイム生成しています。

## 主な機能

- **コード進行入力**: `Am F C G` のようにスペース／`|` 区切りで入力。`maj7`/`m7`/`7`/`sus4`/`dim`/`aug`/`add9`/パワーコード(`E5`)/オンコード(`G/B`) などに対応。
- **ギター**: アンプ種別（クリーン / オーバードライブ / ディストーション）、歪み量、トーン、リズム（伸ばし・4分・8分刻み）。ストラム（弦をずらして鳴らす）＋キャビネット風 EQ で簡易的な音作り。
- **ベース**: コードのルート弾き（全音符 / 4分 / 8分）。
- **ドラム**: 8ビート / 16ビート / ハーフタイム / 4つ打ち。
- 再生中もテンポ・ツマミ・コード進行をリアルタイムに変更可能。
- プリセット進行をワンクリック呼び出し。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # 本番ビルド (dist/)
npm run preview    # ビルド結果のプレビュー
npm run typecheck  # 型チェック
npm run lint       # ESLint
```

## GitHub Pages へのデプロイ

`main` ブランチへの push で `.github/workflows/deploy.yml` が動き、`dist/` を GitHub Pages へ自動デプロイします。

初回のみ、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。公開 URL は `https://<ユーザー名>.github.io/CodeProgressionPlayer/` です。

Vite の `base` は CI 上で `/CodeProgressionPlayer/` に設定されます（`vite.config.ts`）。リポジトリ名を変更した場合は `base` も合わせて更新してください。

## 構成

| ファイル | 役割 |
| --- | --- |
| `src/audio/theory.ts` | コード記号のパースとボイシング生成 |
| `src/audio/instruments.ts` | ギターアンプ／ベース／ドラム／マスターバスの音源チェーン |
| `src/audio/engine.ts` | Tone.Transport によるパターン編成・スケジューリング |
| `src/main.ts` | UI と音源エンジンの接続 |
