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
| `doi-launcher.sh` | Chạy trong Termux: thay màn hình chính Google TV bằng launcher nhẹ cleanyourtv; `kiem` chỉ đọc, `khoi-phuc` trả như cũ |
| `kiem-tra-app.sh` | Chạy trong Termux: tự bấm thử app Kho phim từ đầu tới cuối, đo tốc độ (xem mục Kiểm tra) |
| `kho-phim-app/` | Mã app Kho phim (WebView toàn màn hình), chép từ repo `tvbox-phim` |
| `launcher/` | `cau-hinh.py`: chỉnh sẵn cleanyourtv cho nhà bố mẹ (4 app ngoài màn hình, nút remote, tắt hiệu ứng). Actions build |
| `khoa/` | Khoá ký APK cố định cho app Kho phim + launcher, để lần sau cài đè được (xem `khoa/README.md`) |
| `VIEC-TOI-MAI.md` | Các bước tối ưu thêm trên Chromecast (mức 1–3), làm theo thứ tự |

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

Đẩy code lên nhánh `claude/tv-box-chromecast` (workflow chỉ chạy ở nhánh này, hoặc bấm Run workflow ở tab
Actions) → đợi Actions xong (~10 phút) → trên box:
`bash cai-tren-box.sh` (tải lại tệp này trước nếu chính nó đổi). Lịch sử xem, yêu thích, duyệt 18+ giữ nguyên;
bản cũ để ở `~/phim.cu`, script hỏi rồi mới xoá.

## Khác với box Xiaomi

- Chỉ nghe `127.0.0.1`: không bật chế độ LAN, không mật khẩu. Điện thoại trong nhà không vào được, đúng ý.
- Không có ffmpeg (8 GB không đủ chỗ): mất tải phim về, chuyển mã `.mkv`, ảnh xem trước khi tua.
  Phim trực tuyến xem bình thường.
  Ảnh poster thu nhỏ bằng `djpeg`/`cjpeg` (gói `libjpeg-turbo-progs`, `cai-tren-box.sh` tự cài) thay cho
  ffmpeg. Thiếu nó thì thẻ phim nhận ảnh gốc 1920×1080: đo 29/10/2026 trang chủ ngốn ~595 MB RAM chỉ cho
  ảnh (có nó: ~39 MB), trang thể loại bấm Xuống là giật.
- Tắt app hệ thống theo từng nhóm, có kiểm sau mỗi nhóm (`tat-goi.sh`); thay launcher là bước riêng, có
  kiểm trước/sau và tự trả lại nếu hỏng (`doi-launcher.sh`). Rủi ro còn lại: launcher hỏng ngay lúc khởi
  động (Gỡ lỗi không dây đã tự tắt) thì chỉ còn khôi phục cài đặt gốc — nên thử kỹ trước khi khởi động lại.
- Máy chủ phim chạy với `KHO_PHIM_BOX=1` (đặt trong `~/.termux/boot/kho-phim`): cập nhật kho 6 giờ/lần
  thay vì 30 phút, quét 18+ chỉ lúc 1–5 giờ sáng — đỡ giành CPU lúc đang xem.
- App Kho phim 1.1 tự dựng lại WebView khi nó chết (thiếu RAM), và chờ máy chủ quá lâu thì nhờ Termux
  chạy lại `~/.termux/boot/kho-phim` (RUN_COMMAND; `allow-external-apps = true` trong `~/.termux/termux.properties`,
  quyền cấp ở `thiet-lap-box.sh`). Script tự chạy có chốt pid nên gọi thừa cũng không chạy hai máy chủ.

## Gỡ hết

`adb uninstall vn.khophim.tv`, gỡ Termux:Boot và Termux trong Cài đặt → Ứng dụng (mất luôn `~/phim`),
rồi trong Termux trước khi gỡ: `adb -s 127.0.0.1:5555 shell settings put global settings_enable_monitor_phantom_procs true`.

## App trên TV khác bản laptop chỗ nào

Trang nhận ra app Kho phim trên TV nhờ user agent có chữ "KhoPhimTV" (`data-nhe` trong `lib/che-do.ts`):

- Không hiệu ứng nào: không mờ nền, không chuyển động, không bóng đổ, cuộn nhảy thẳng, thẻ được chọn
  chỉ có khung trắng (không phóng to). Giữ vòng xoay chờ tải; thông báo âm lượng/tua hiện rồi tắt phụt.
- Chữ to hơn ~1,25 lần. Giấu mục không dùng được hoặc dễ bấm nhầm: Tải về (cần ffmpeg), Kho của tôi,
  Ghép điện thoại (máy chủ chỉ nghe 127.0.0.1), Quản trị (có nút Xoá kho — vẫn vào được bằng /quan-tri),
  nút tìm bằng giọng nói (Trợ lý Google đã tắt), nút đổi chế độ PC/TV.
- Trang chủ: mỗi hàng 15 phim (có "Xem tất cả"), banner một ảnh đứng yên.
- Trình phát bật sẵn "Tăng âm lượng" + "Rõ lời thoại", phụ đề to hơn một nấc (chỉnh trong Cài đặt thì giữ theo đó).
- Không tải trước trang của mọi phim lướt qua; chỉ tải trước phim mà ô chọn dừng lại 0,6 giây,
  và trang tập sau khi tập đang xem đã quá 80%.
- Trình phát: Xuống ở hàng nút dưới cùng mở danh sách tập (phim bộ) / máy chủ (phim lẻ); có nút
  Đổi máy chủ; Trái/Phải tua liên tục, OK dừng/phát.
- **Ưu tiên máy chủ Thuyết minh / Lồng tiếng** ở mọi chỗ: mở phim mà không chọn máy chủ thì vào nó,
  trang phim xếp danh sách tập của nó lên đầu, tự đổi máy chủ khi lỗi thì thử nó trước (cài đặt
  `uu_tien_thuyet_minh`, mặc định bật cho app TV, tắt trên laptop). Đổi trên box (qua SSH):
  ```
  cd ~/phim && node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('du-lieu/phim.db').prepare(\"insert into cai_dat (khoa, gia_tri) values ('uu_tien_thuyet_minh', ?) on conflict(khoa) do update set gia_tri = excluded.gia_tri\").run(process.argv[1])" tat
  ```
  (`tat` = luôn Vietsub, `bat` = luôn ưu tiên thuyết minh.)
- **Đọc trước đoạn video** (`lib/doc-truoc.ts`, cài đặt `doc_truoc_doan`, mặc định TẮT): khi trình phát lấy
  một đoạn, máy chủ phim tải sẵn 3 đoạn kế tiếp song song, giữ trong RAM 3 phút (tối đa 8 đoạn). Có ích khi
  mạng tới nguồn chậm theo từng kết nối — `kiem-tra-app.sh` in "3 luồng" lớn hơn hẳn "1 luồng". Bật bằng
  lệnh trên, thay `uu_tien_thuyet_minh` → `doc_truoc_doan` và `tat` → `bat`. Không cần khởi động lại.

## Kiểm tra

`bash kiem-tra-app.sh [cổng adb]` trên box: mở app → lướt → mở phim → phát → tua → dừng/phát → về →
tìm kiếm, kèm lỗi JS/mạng, RAM, CPU và tốc độ tải đoạn video (1 luồng / 3 luồng tới nguồn).
