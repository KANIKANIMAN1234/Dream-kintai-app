# Dream-kintai-app

勤怠登録端末（T-xx）向けの Web アプリです。  
仕様書 `T-00〜T-05` の遷移と、Supabase への打刻登録を実装しています。

## 必須環境変数

`.env.local` に以下を設定してください。

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 開発起動

```bash
npm install
npm run dev
```

## 画面仕様対応

- T-00: 待機画面（時計表示 / タップで開始）
- T-01/T-02: 4桁社員コード入力・認証エラー
- T-03: 打刻区分選択（出動 / 退動 / 外出 / 業務）
- T-04: 確認画面
- T-05: 完了画面（5秒後自動復帰）

## API

- `POST /api/employee`  
  4桁社員コードで `m_employees` を照会し、本日打刻履歴を返却
- `POST /api/attendance`  
  `t_attendance_logs` に打刻を登録（`input_channel=terminal_only`）
