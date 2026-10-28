# Tối ưu thêm Chromecast nhà bố mẹ — làm theo thứ tự

Ba mức, giống box Xiaomi phòng mình. Làm đến đâu cũng dừng được: mỗi bước có cách quay lại.
Thời gian khoảng 45–60 phút.

**Mang theo:** iPhone sạc đầy (Termius), remote của box, **mật khẩu Wi-Fi nhà bố mẹ** (bước 7 có thể phải
kết nối lại Wi-Fi).

| Mức | Bước | Được gì |
|---|---|---|
| 1 | 2, 5, 6 | Máy chủ phim giãn việc nền; tắt thêm 7 gói chạy ngầm; hiệu ứng hệ thống về 0; 1080p; CH Play thôi tự cập nhật |
| 2 | 3 | App Kho phim 1.1: WebView chết thì tự dựng lại; máy chủ phim chết lâu thì tự nhờ Termux chạy lại |
| 3 | 7 | Bỏ màn hình chính Google TV (~130 MB RAM, tải gợi ý/quảng cáo liên tục) — dùng launcher nhẹ |
| thêm | 4 | Đọc trước đoạn video: chỉ bật nếu đo thấy có ích |

---

## 0. Chuẩn bị trên TV

1. Mở **Termux** trên TV, gõ `sshd` rồi Enter (từ bước 2 trở đi SSH tự bật mỗi lần khởi động box).
2. Cài đặt → Hệ thống → **Tuỳ chọn cho nhà phát triển** → bật **Gỡ lỗi không dây**.
   (Đã ghép nối từ lần trước, không cần mã nữa. Nó tự tắt mỗi lần khởi động lại box.)

## 1. Vào box từ iPhone

Termius → box `192.168.1.6`, cổng `8022`. Tải hết script một lần:

```
cd ~ && for f in cai-tren-box.sh thiet-lap-box.sh tat-goi.sh doi-launcher.sh kiem-tra-app.sh; do curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/$f || break; done; ls -l *.sh
```

Mong đợi: 5 tệp `.sh` được liệt kê, tệp nào cũng mới (ngày hôm nay).

## 2. Lên bản máy chủ phim mới — mức 1

```
bash cai-tren-box.sh
```

- Nếu hỏi *"Xoá ~/phim.cu để cập nhật tiếp?"* → gõ `c` (đó là bản của lần cập nhật trước nữa).
- Mong đợi: `XONG: máy chủ phim chạy ở http://127.0.0.1:3000`.
- Câu hỏi cuối *"Mở app Kho phim xem thử đã…"*: mở app trên TV xem thử một phim, ổn thì gõ `c` (xoá bản cũ,
  lấy lại ~130 MB). Chưa chắc thì `k`, để dành.

Bản này: cập nhật kho 6 giờ/lần (trước 30 phút), quét 18+ chỉ lúc 1–5 giờ sáng, SSH tự bật khi khởi động
box, cho app Kho phim nhờ Termux chạy lại máy chủ.

**Quay lại:** bản cũ ở `~/phim.cu` (nếu chưa xoá): `pkill -f kho-phim; pkill -f "node server.mjs"; mv ~/phim ~/phim.loi && mv ~/phim.cu ~/phim && mv ~/phim.loi/du-lieu ~/phim/ && nohup ~/.termux/boot/kho-phim >/dev/null 2>&1 &`

## 3. App Kho phim 1.1 — mức 2

```
bash thiet-lap-box.sh
```

- Script tự tìm cổng adb. Báo *"Chưa nối được adb"* → xem lại bước 0.2.
- Sẽ báo *"Bản app Kho phim đang cài ký bằng khoá cũ"* và hỏi gỡ → gõ `c`. **Chỉ lần này** phải gỡ (bản cũ
  ký bằng khoá ngẫu nhiên; từ 1.1 khoá cố định, lần sau cài đè được). Lịch sử xem, yêu thích nằm ở máy chủ
  phim — **không mất**.
- Mong đợi: `Success`, `Đã cấp quyền gọi Termux cho app Kho phim.`, `App Kho phim: bản 1.1`.
- Màn hình chính Google TV có thể mất ô Kho phim (vì vừa gỡ): thêm lại vào mục ưa thích, hoặc bỏ qua nếu
  làm bước 7.

## 4. Đo, quyết định bật đọc trước đoạn video

Mở app Kho phim trên TV trước, rồi:

```
bash kiem-tra-app.sh
```

Script tự bấm thử cả app (TV tự chuyển màn, đừng bấm remote), khoảng 2–3 phút. Chụp màn hình kết quả gửi
mình. Xem dòng:

```
MẠNG TỚI NGUỒN: 1 luồng ___ KB/s | 3 luồng cùng lúc ___ KB/s tổng
```

- **3 luồng gấp đôi 1 luồng trở lên** → bật đọc trước (nguồn bóp tốc độ từng kết nối; thử ở máy mình: bộ
  đệm từ 0–2 giây lên ~30 giây, tua nhanh hơn hẳn):
  ```
  cd ~/phim && node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('du-lieu/phim.db').prepare(\"insert into cai_dat (khoa, gia_tri) values ('doc_truoc_doan', ?) on conflict(khoa) do update set gia_tri = excluded.gia_tri\").run(process.argv[1])" bat; cd ~
  ```
  Có hiệu lực ngay, không cần khởi động lại. Tắt: chạy lại lệnh, thay `bat` cuối dòng bằng `tat`.
- Hai số gần bằng nhau → **không bật** (chỉ tốn thêm mạng, không nhanh hơn).

## 5. Tắt thêm gói chạy ngầm — mức 1

```
bash tat-goi.sh 5
```

Tắt (không gỡ) 7 gói: ghi log remote, chẩn đoán mạng, quảng cáo/cá nhân hoá, ảnh nền màn hình chờ; hiệu
ứng chuyển cảnh hệ thống về 0. Danh sách theo mẫu Chromecast 4K của cleanyourtv, đúng bản Android của box.

- Mong đợi 3 dòng `[OK]`: Màn hình chính, Có mạng, Máy chủ phim.
- Có `[LỖI]` → script in sẵn lệnh bật lại nhóm 5; hoặc `bash tat-goi.sh khoi-phuc` (bật lại MỌI nhóm 1–5).

## 6. Làm tay trên TV — mức 1

1. **Độ phân giải 1080p:** Cài đặt → Hiển thị và âm thanh → Nâng cao (hoặc Độ phân giải) → **1080p 60 Hz**.
   Phim trên nguồn tối đa 1080p; xuất 4K chỉ thêm việc phóng hình cho box. TV chỉ có 1080p thì bỏ qua.
2. **CH Play thôi tự cập nhật:** mở CH Play → ảnh đại diện góc phải → Cài đặt → Tự động cập nhật ứng dụng →
   **Không tự động cập nhật ứng dụng**. Thỉnh thoảng (vài tháng) vào cập nhật tay VTVgo, TV360 cho khỏi hỏng.

## 7. Thay màn hình chính — mức 3

Bước nặng nhất. Làm sau khi 2–6 đã ổn.

**Rủi ro thật:** sau khi khởi động lại, Gỡ lỗi không dây tự tắt. Nếu launcher mới hỏng *ngay lúc khởi động*
(không ra màn hình, không vào được Cài đặt) thì không còn adb để cứu → cách cuối cùng là **khôi phục cài đặt
gốc** (giữ nút ở lưng Chromecast) và cài lại từ đầu. Vì vậy script kiểm rất kỹ và bắt thử đủ trước khi khởi
động lại. Ở box Xiaomi và trên máy của người viết launcher (cùng mẫu, cùng bản Android) đã chạy ổn.

1. Xem trước, không đổi gì:
   ```
   bash doi-launcher.sh kiem
   ```
2. Làm:
   ```
   bash doi-launcher.sh
   ```
   - Nếu `[DỪNG] Mạng Wi-Fi đang dùng do setupwraith tạo` → trên TV: Cài đặt → Mạng và Internet → chọn mạng
     nhà → **Bỏ qua mạng**, rồi kết nối lại (gõ mật khẩu Wi-Fi). SSH sẽ rớt: chờ box có mạng lại, SSH vào lại,
     bật lại Gỡ lỗi không dây, chạy lại lệnh trên.
   - Script cài launcher, **mở thử cho TV hiện nó**, rồi hỏi *"Làm tiếp?"* → nhìn TV thấy màn hình mới thì gõ `c`.
   - Mong đợi: `[OK] Bấm Home ra launcher mới.`, `[OK] Còn mạng`. Hỏng thì script **tự trả lại** Google TV.
3. Thử bằng remote (script in lại danh sách này):
   - Home → màn hình mới có Kho phim · VTVgo · TV360 · SmartTube.
   - Mở Kho phim xem một phim; Back; mở VTVgo.
   - Nút **YouTube** trên remote → Kho phim; nút **Netflix** → VTVgo.
   - Vào được **Cài đặt** → Hệ thống → Tuỳ chọn cho nhà phát triển (đường cứu nếu cần).
   Có gì sai: `bash doi-launcher.sh khoi-phuc`.
4. Ổn hết → **rút điện box, cắm lại**. Sau khi bật:
   - Màn hình mới tự lên, Kho phim mở được, xem được phim.
   - SSH từ iPhone vào được ngay (không cần gõ `sshd` trên TV) — đây là đường cứu từ xa.
   - Muốn kiểm qua adb: bật lại Gỡ lỗi không dây, `bash doi-launcher.sh kiem`.

**Quay lại** lúc nào cũng được (cần Gỡ lỗi không dây đang bật): `bash doi-launcher.sh khoi-phuc`.

## 8. Dọn cuối

- Cài đặt → Tuỳ chọn cho nhà phát triển → tắt **Gỡ lỗi không dây** và **Gỡ lỗi USB**.
  **Không tắt cả mục "Tuỳ chọn cho nhà phát triển"** — tắt mục đó là Android đặt lại một số cài đặt bên trong
  (như hiệu ứng chuyển cảnh vừa đặt về 0).
- Gửi mình ảnh kết quả bước 4 (`kiem-tra-app.sh`) và bất kỳ dòng `[LỖI]`/`[DỪNG]` nào.

## Bảng quay lại

| Đã làm | Lệnh trả lại |
|---|---|
| Bước 2 (máy chủ mới) | xem "Quay lại" ở bước 2 (cần `~/phim.cu` chưa xoá) |
| Bước 3 (app 1.1) | không cần — app 1.1 dùng y như cũ |
| Bước 4 (đọc trước) | lệnh ở bước 4 với `tat` |
| Bước 5 (nhóm 5) | `bash tat-goi.sh khoi-phuc` (bật lại cả nhóm 1–5, hiệu ứng về 1) |
| Bước 6 | chỉnh lại tay trong Cài đặt / CH Play |
| Bước 7 (launcher) | `bash doi-launcher.sh khoi-phuc` |
