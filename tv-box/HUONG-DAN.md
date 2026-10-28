# Kho phim trên TV box — không cần laptop

Máy chủ phim chạy ngay trên box (Termux), app **Kho phim** mở `http://127.0.0.1:3000`.
Mọi thứ phải build thì GitHub Actions build (`.github/workflows/ban-tv-box.yml`) rồi đăng lên
Releases. Box tải bằng một link, người cài chỉ cần điện thoại (kể cả iPhone) để gõ lệnh qua SSH.

Đã dùng cho: **Chromecast with Google TV 4K** (GZRNL, Android TV 14, 2 GB RAM, 8 GB) ở nhà bố mẹ.
Box Xiaomi ở nhà mình vẫn dùng luồng laptop cũ trong repo `tvbox-phim`.

## Trong thư mục này

| Tệp | Việc |
|---|---|
| `dong-goi.sh` | Đóng gói bản gọn (~25 MB nén, ~125 MB giải nén). Actions chạy |
| `cai-tren-box.sh` | Chạy trong Termux: cài lần đầu hoặc lên bản mới, giữ nguyên `du-lieu/` |
| `doc-goi.sh` | Chạy trong Termux: CHỈ ĐỌC — liệt kê gói, Home, chủ Wi-Fi, RAM theo app để lập danh sách tắt |
| `tat-goi.sh` | Chạy trong Termux: tắt từng nhóm gói (không gỡ), kiểm Home + mạng + máy chủ phim sau mỗi nhóm; `xem` chỉ đọc, `khoi-phuc` bật lại hết |
| `thiet-lap-box.sh` | Chạy trong Termux, một lần: adb vào chính box, tắt phantom process killer, cài app Kho phim, in bảng bộ nhớ |
| `kho-phim-app/` | Mã app Kho phim (WebView toàn màn hình), chép từ repo `tvbox-phim` |

## Cài box mới

1. Box: Cài đặt → Hệ thống → Giới thiệu → bấm 7 lần vào "Bản dựng hệ điều hành Android TV" → quay ra
   **Tuỳ chọn cho nhà phát triển** → bật **Gỡ lỗi USB**.
2. CH Play → cài **Downloader**. Dùng Downloader tải và cài (xong thì chọn xoá tệp APK cho đỡ chật):
   - `https://github.com/termux/termux-app/releases/download/v0.118.3/termux-app_v0.118.3+github-debug_armeabi-v7a.apk`
   - `https://github.com/termux/termux-boot/releases/download/v0.8.1/termux-boot-app_v0.8.1+github.debug.apk`
   Box 64-bit thì đổi `armeabi-v7a` thành `arm64-v8a`. Mở Termux:Boot một lần cho Android cho nó tự chạy.
3. Termux trên TV: `pkg install -y openssh`, `passwd`, `sshd`. Từ điện thoại SSH vào `<ip box>` cổng **8022**.
4. Qua SSH:
   ```
   curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/thiet-lap-box.sh && bash thiet-lap-box.sh
   curl -fLO https://github.com/kazesanaei/phim/releases/latest/download/cai-tren-box.sh && bash cai-tren-box.sh
   ```
   Box mở adb cổng 5555 (Xiaomi) thì lúc chạy cái đầu TV hỏi "Cho phép gỡ lỗi": tick "Luôn cho phép" rồi bấm.
   **Chromecast with Google TV không hỏi** (không mở 5555). Dùng Gỡ lỗi không dây:
   Tuỳ chọn nhà phát triển → **Gỡ lỗi không dây** → bật → **Ghép nối thiết bị bằng mã ghép nối**, để nguyên
   màn hình đó rồi qua SSH:
   ```
   pkg install -y android-tools
   adb pair 127.0.0.1:<cổng ghép nối> <mã 6 số>
   bash thiet-lap-box.sh <cổng ở màn Gỡ lỗi không dây>
   ```
   Cổng ghép nối và cổng kết nối là hai số khác nhau; cổng kết nối đổi sau mỗi lần khởi động lại box.

## Lên bản mới

Đẩy code lên `main` (hoặc bấm Run workflow ở tab Actions) → đợi Actions xong (~5 phút) → trên box:
`bash cai-tren-box.sh` (tải lại tệp này trước nếu chính nó đổi). Lịch sử xem, yêu thích, duyệt 18+ giữ nguyên;
bản cũ để ở `~/phim.cu`, script hỏi rồi mới xoá.

## Khác với box Xiaomi

- Chỉ nghe `127.0.0.1`: không bật chế độ LAN, không mật khẩu. Điện thoại trong nhà không vào được, đúng ý.
- Không có ffmpeg (8 GB không đủ chỗ): mất tải phim về, chuyển mã `.mkv`, ảnh xem trước khi tua.
  Phim trực tuyến xem bình thường.
- Không thay launcher, không tắt app hệ thống: nhà bố mẹ không có máy để cứu nếu treo logo.
  Bớt quảng cáo bằng "Chế độ chỉ dùng ứng dụng" trong cài đặt tài khoản Google.

## Gỡ hết

`adb uninstall vn.khophim.tv`, gỡ Termux:Boot và Termux trong Cài đặt → Ứng dụng (mất luôn `~/phim`),
rồi trong Termux trước khi gỡ: `adb -s 127.0.0.1:5555 shell settings put global settings_enable_monitor_phantom_procs true`.

## App trên TV khác bản laptop chỗ nào

Trang nhận ra app Kho phim trên TV nhờ user agent có chữ "KhoPhimTV" (`data-nhe` trong `lib/che-do.ts`):

- Không hiệu ứng nào: không mờ nền, không chuyển động, không bóng đổ, cuộn nhảy thẳng, thẻ được chọn
  chỉ có khung trắng (không phóng to). Giữ vòng xoay chờ tải; thông báo âm lượng/tua hiện rồi tắt phụt.
- Trang chủ: mỗi hàng 15 phim (có "Xem tất cả"), banner một ảnh đứng yên.
- Không tải trước trang của mọi phim lướt qua; chỉ tải trước phim mà ô chọn dừng lại 0,6 giây,
  và trang tập sau khi tập đang xem đã quá 80%.
- Trình phát: Xuống ở hàng nút dưới cùng mở danh sách tập (phim bộ) / máy chủ (phim lẻ); có nút
  Đổi máy chủ; Trái/Phải tua liên tục, OK dừng/phát.
- **Ưu tiên máy chủ Thuyết minh / Lồng tiếng** khi mở phim mà không chọn máy chủ (cài đặt
  `uu_tien_thuyet_minh`, mặc định bật cho app TV, tắt trên laptop). Đổi trên box (qua SSH):
  ```
  cd ~/phim && node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('du-lieu/phim.db').prepare(\"insert into cai_dat (khoa, gia_tri) values ('uu_tien_thuyet_minh', ?) on conflict(khoa) do update set gia_tri = excluded.gia_tri\").run(process.argv[1])" tat
  ```
  (`tat` = luôn Vietsub, `bat` = luôn ưu tiên thuyết minh.)

## Kiểm tra

`bash kiem-tra-app.sh <cổng adb>` trên box: mở app → lướt → mở phim → phát → tua → dừng/phát → về →
tìm kiếm, kèm lỗi JS/mạng, RAM, CPU và tốc độ tải đoạn video (1 luồng / 3 luồng tới nguồn).
