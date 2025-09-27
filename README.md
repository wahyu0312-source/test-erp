/erp/
 ├─ index.html         (Dashboard)
 ├─ plan.html          (生産計画)
 ├─ ship.html          (出荷計画)
 ├─ confirm.html       (出荷予定／出荷確認書 ＝ print layout)
 ├─ scan.html          (QRスキャン＋NG登録)
 ├─ ticket.html        (生産現品票 ＝ print layout)
 ├─ charts.html        (統計チャート：在庫、NG、出荷 顧客別 月次/年次 ＋ Pie & Pareto)
 ├─ app.js
 └─ style.css


11) Alur Pemakaian (operasional)
A. Login & Role

User buka aplikasi → login (username/password dari sheet USERS).

Role:

管理者: semua akses.

生産管理部: buat/edit hapus 生産計画, buat 出荷計画, 出荷確認書 & export Excel, sinkronisasi.

製造部 / 検査部: update proses/status via QRスキャン (tidak bisa edit master plan).

B. PPIC membuat 生産計画 (plan.html)

Klik ＋新規 → pilih 得意先 → pilih 図番 → 品名 auto-fill dari sheet MASTER.

Isi 製造番号, 開始, プロセス awal (mis. レーザ工程), 場所, ステータス (計画/進行中/保留/完了).

保存 → data muncul di tabel. Bisa 編集/削除 (sesuai izin).

Ticket (生産現品票) tersedia via tombol 票.

C. Produksi update status (scan.html)

Di 生産現品票 (ticket), ada QR berisi 製造番号|品番.

Di QRスキャン: scan QR → otomatis tampil pasangan 製造番号|品番.

Pilih 工程/ステータス → 更新.
Tidak ada kamera? Gunakan 手入力 (製造番号 & 品番) lalu 更新.

Update terekam (kolom 更新 menampilkan jam & siapa user-nya).

D. 検査 (Kensa)

Proses terakhir 検査工程. Bila NG, ganti status ke 保留 atau tulis keterangan pada kertas.
Flow NG → kembali ke produksi untuk repair → scan lagi sampai 完了.

E. 出荷計画 (ship.html)

Buat jadwal kirim (＋新規), pilih customer & item (auto dari MASTER), isi qty & status (出荷準備).

Saat barang dikirim, tekan 準備→出荷済に更新 atau edit satu-per-satu.

Dashboard otomatis menghitung 完成品在庫 = 完成数量 − 出荷数量.

F. 出荷確認書 (confirm.html)

Pilih 日付 + optional 得意先 → 作成.

Bisa 印刷 atau Excel出力 (XLSX).
Template meniru yang Anda minta (kolom No/得意先/品名/品番/数量/備考).

G. 同期 Google Sheets

シートから取得: tarik data PLAN/SHIP/MASTER/PICS dari server (Apps Script).

シートへ送信: kirim semua record lokal satu-per-satu ke Apps Script (append).

自動（30秒毎）: auto-pull berkala.

ローカル削除: hapus cache browser (berguna bila layout/data berantakan).

H. MASTER & USERS

flowchart TD
  A[PPIC: 生産計画 立案<br/>入力: 得意先/製造番号/図番(→品名自動)/開始] --> B{MASTER参照}
  B -->|図番一致| A1[品名 自動入力]
  B -->|見つからない| A2[手入力 or MASTER追加]

  A --> C[票を発行: 生産現品票<br/>(QR: 製造番号|品番)]
  C --> D[製造: 工程処理<br/>レーザ → 曲げ → 外枠組立 → ... → 外注 → 組立]
  D --> E[検査: 検査工程]
  E -->|合格| G[完成数量 反映]
  E -->|不合格(NG)| F[検査保留/リペア → 製造へ戻す]

  G --> H[PPIC: 出荷計画 作成]
  H --> I[出荷確認書 印刷/Excel出力]
  I --> J[物流: 出荷準備 → 出荷済 更新]
  J --> K[在庫 = 完成数量 − 出荷数量 更新]

  %% QR 更新
  C -.QRスキャン.-> D
  D -.QRスキャン.-> E
  E -.QRスキャン.-> H


MASTER: mapping 得意先 / 品番 / 品名 (aktifkan dengan kolom 有効 = TRUE). Dipakai untuk dropdown & auto-fill.

PICS: daftar PIC per 部署 (opsional untuk stamp/assignment).

USERS: ユーザー | 部署 | パスワード | 有効 (role/otorisasi).
