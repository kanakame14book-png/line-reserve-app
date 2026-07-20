# line-reserve-app

山梨大学生協による **新入生（合格者）向けの来場予約・受付システム** です。
受験生・新入生は LINE ミニアプリ（LIFF）からイベントの登録・予約を行い、当日はスタッフが QR コードを読み取って受付します。

## 主な機能

- **LINE（LIFF）上での登録・予約フォーム** … 学部・学科・入試区分を選ぶと、合格発表日を基準に自動でモードが切り替わります。
  - **登録**（合格発表前）… 志望情報とアンケートのみの事前登録。
  - **予約**（合格発表後）… 来場日時の枠を選び、氏名・連絡先などを入力して来場予約を確定。
- **受付票（QRコード）の発行** … 予約確定時に LINE トークへ受付票 URL を送信。スマホで提示できます。
- **QRコード受付** … スタッフがカメラで QR を読み取り、ステータスを「受付済」に更新。読み取り結果に応じて効果音が鳴ります。
- **管理画面** … 予約一覧の絞り込み／並べ替え、予約枠の作成、当日の受付管理、学部ごとの班分け（A/B/C班）自動振り分け。

## ステータスの流れ

予約データ（`reservations.status`）は次の3つの状態を持ちます。

| ステータス | 意味 |
| --- | --- |
| `登録` | 合格発表前の事前登録。来場日時は未確定。 |
| `予約` | 合格発表後に来場日時まで確定した状態。受付票を発行できる。 |
| `受付済` | 当日、QR受付を完了した状態。 |

> ※ `登録` のみの状態では当日の受付はできません（予約への移行が必要）。

## 技術スタック

- [Next.js](https://nextjs.org) 16（App Router）/ React 19 / TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com)（データベース＋管理者認証）
- [LINE LIFF](https://developers.line.biz/ja/docs/liff/)（LINEミニアプリ）
- [@yudiel/react-qr-scanner](https://github.com/yudielcurbelo/react-qr-scanner)（QR読み取り）

## ディレクトリ / 画面構成

| パス | 説明 |
| --- | --- |
| `app/page.tsx` | 受験生向けの登録・予約フォーム（LIFF内で起動） |
| `app/admin/page.tsx` | 管理画面（要ログイン）。予約一覧・枠管理・受付・班分け |
| `app/admin/scanner/page.tsx` | QRコード受付（カメラでスキャン） |
| `app/admin/ticket/page.tsx` | 受付票（QRコード）の表示・印刷 |
| `data/options.ts` | 学部・学科・入試区分・合格発表日などのマスタ定義 |
| `supabase.ts` | Supabaseクライアントの初期化 |

## データベース（Supabase）

主なテーブルは以下の2つです。

- **`reservations`** … 予約・登録データ（氏名、連絡先、学部・学科、`status`、`slot_id`、`group_name`、`attendee_count` など）
- **`slots`** … 来場予約枠（`start_time`、`capacity`、`event_type`（対面／オンライン）など）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクト直下に `.env.local` を作成し、Supabase の値を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
```

> LIFF ID は現在 `app/page.tsx` 内に直書きされています。別の LINE ミニアプリで動かす場合は該当箇所を差し替えてください。

### 3. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと表示されます（※フォームは LINE の LIFF 環境での動作を前提としています）。

## その他のコマンド

```bash
npm run build   # 本番ビルド
npm run start   # ビルド済みアプリの起動
npm run lint    # ESLint による静的解析
```

## 効果音の差し替え

QR受付時の効果音は `public/sounds/` に配置した mp3 を再生しています。

- `public/sounds/success.mp3` … 読み取り成功時（ピロリン♪）
- `public/sounds/error.mp3` … 読み取り失敗・未予約時（ブブッ）

好きな音に変えたい場合は、同じファイル名で mp3 を上書きしてください。

## デプロイ

[Vercel](https://vercel.com) へのデプロイを想定しています。Vercel のプロジェクト設定で上記の環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）を登録してください。
