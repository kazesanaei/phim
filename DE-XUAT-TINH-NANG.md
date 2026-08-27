# Đề xuất tính năng — Kho phim

> **Cập nhật 27/08: các mục 1–13 và 18 ĐÃ LÀM XONG.** Mục 14–17 (xem cùng nhau, nhiều hồ
> sơ, đánh giá cá nhân, bộ sưu tập tự tạo) chủ dự án quyết định không cần. Phần dưới giữ
> nguyên để tra lại lý do từng quyết định.

Xếp theo **giá trị ÷ công sức**. Mỗi mục ghi rõ cần gì và vướng gì, để anh/chị tích chọn
thay vì phải đoán. Công sức tính bằng buổi làm việc: 🟢 dưới nửa buổi · 🟡 một buổi ·
🔴 nhiều buổi.

Ký hiệu ⚠️ = có rào cản thật từ nguồn dữ liệu, đọc kỹ trước khi chọn.

---

## Đã có rồi (để khỏi đề xuất trùng)

Banner xoay · thẻ nở khi rê chuột · Top N điểm cao · đầu trang trong suốt→đặc · gom phần/season ·
tiếp tục xem + gỡ khỏi danh sách · yêu thích / xem sau / lịch sử · phụ đề nhiều thứ tiếng +
kéo thả .srt + dời độ trễ + cỡ chữ · phím tắt đầy đủ · PiP · tốc độ phát · tự sang tập sau ·
tải offline nhúng phụ đề · kho local (quét, gom bộ, chuyển mã .mkv) · quản trị 4 tab.

---

## Nhóm 1 — Nên làm trước (giá trị cao, công sức thấp)

### 1. 🟢 Xem ngẫu nhiên ("Play something")
Một nút ở đầu trang bốc ngẫu nhiên trong danh sách yêu thích / thể loại hay xem rồi phát luôn.
Netflix có, và đây là nút được bấm nhiều nhất khi không biết xem gì.
*Cần:* một route `/ngau-nhien` chọn ngẫu nhiên rồi `redirect()`. Không cần dữ liệu mới.

### 2. 🟢 Bỏ qua intro / nhạc hiệu
Đang xem, bấm một phím để đánh dấu "intro bắt đầu / kết thúc"; các tập sau của **cùng phim bộ**
tự hiện nút **Bỏ qua intro** ở đúng đoạn đó. Với phim bộ dài tập thì đây là tính năng tiết kiệm
thời gian nhất.
*Cần:* thêm bảng `moc_intro(phim_slug, batDau, ketThuc)`. Không cần phân tích video.
*Vì sao không tự dò:* dò intro tự động phải so khớp âm thanh giữa các tập — tốn CPU hàng phút
mỗi tập, không đáng so với việc bấm một phím đúng một lần cho cả bộ.

### 3. 🟢 Sắp xếp và lọc nâng cao ở trang Duyệt
Thêm sắp xếp theo **điểm TMDB / năm / mới cập nhật**, và cho chọn **nhiều thể loại** cùng lúc.
*⚠️ Rào cản:* nguồn vsmov **không nhận** `sort_field` (đã đo, xem README bẫy #8) và chỉ lọc
được một thể loại. Nên phải **sắp xếp phía mình** trong phạm vi trang đang xem, hoặc quét sẵn
vài chục trang vào SQLite rồi lọc tại chỗ (đó là mục 12).

### 4. 🟢 Thống kê xem phim
Trang nhỏ: tổng số giờ đã xem, thể loại xem nhiều nhất, phim xem nhiều nhất, biểu đồ nhiệt theo
ngày. Dữ liệu **đã nằm sẵn** trong bảng `xem` — chỉ là truy vấn và vẽ.

### 5. 🟢 Hẹn giờ tắt + tự dừng khi ngủ gật
Hẹn giờ tắt (30/60/90 phút hoặc "hết tập này"), và hộp thoại "Bạn còn xem không?" sau 3 tập liên
tiếp không chạm chuột — chống phát cả đêm.

### 6. 🟢 Cài như ứng dụng (PWA)
Thêm manifest + icon để mở từ màn hình nền như app riêng, không thanh địa chỉ trình duyệt.
*Cần:* một file `manifest.json` + vài icon. Chạy offline thì không (nội dung ở trên mạng).

---

## Nhóm 2 — Đáng làm (giá trị cao, công sức vừa)

### 7. 🟡 Gợi ý "Vì bạn đã xem …"
Nhìn thể loại/quốc gia của những phim đã xem, dựng hàng gợi ý trên trang chủ.
*Cần:* đếm thể loại trong lịch sử → gọi `/the-loai/{slug}` cho vài thể loại nổi nhất → lọc bỏ
phim đã xem. Dữ liệu lịch sử đã có; chỉ thêm 2-3 lệnh gọi API đã được cache.

### 8. 🟡 Theo dõi phim bộ + báo tập mới
Đánh dấu "đang theo dõi" một phim bộ; nền định kỳ hỏi nguồn xem `episode_current` có tăng không,
có tập mới thì hiện huy hiệu ở đầu trang và một hàng "Tập mới cho bạn".
*Cần:* bảng `theo_doi`, một việc chạy nền theo nhịp. Rất hợp với thói quen xem phim bộ.

### 9. 🟡 Ảnh xem trước khi tua (thumbnail trên thanh tua)
Rê chuột trên thanh tua thì hiện khung hình tại thời điểm đó.
*⚠️ Rào cản:* nguồn **không cung cấp** sprite. Phải tự sinh bằng ffmpeg — mỗi phim tốn **hàng
phút CPU**. Đề nghị: chỉ sinh cho **phim trong máy** và **phim đã tải về**, chạy nền sau khi quét.
Phim xem trực tuyến thì bỏ qua.

### 10. 🟡 Nhiều track âm thanh + phụ đề mềm cho file trong máy
File `.mkv` thường có 2-3 track tiếng và vài phụ đề nhúng. Hiện app chỉ lấy track đầu.
*Cần:* `ffprobe` đã đọc được danh sách track (code sẵn có); thêm menu chọn, và khi chuyển mã thì
`-map` đúng track người dùng chọn.

### 11. 🟡 Tự tìm phụ đề từ nguồn ngoài
Phim trong máy không có phụ đề thì bấm "Tìm phụ đề" để tải từ OpenSubtitles theo tên + năm.
*⚠️ Cần:* đăng ký API key miễn phí của OpenSubtitles và dán vào phần Quản trị.

### 12. 🟡 Kho đệm metadata (nền tảng cho lọc nâng cao)
Quét sẵn vài chục nghìn phim từ nguồn vào SQLite, chạy nền. Sau đó **lọc/sắp xếp/tìm kiếm hoàn
toàn tại chỗ** — nhanh tức thì, gộp phần **triệt để** (không còn giới hạn "chỉ gom trong một
trang"), và làm được những thứ nguồn không hỗ trợ (sắp xếp theo điểm, lọc nhiều thể loại).
*Đây là thứ mở khoá cho mục 3 và cải thiện mục 7.* Tốn khoảng 780 lệnh gọi API, chạy nền một lần.

---

## Nhóm 3 — Cân nhắc (giá trị tuỳ thói quen)

### 13. 🟡 Phát lên TV (Chromecast / DLNA)
Đẩy phim sang TV trong nhà.
*⚠️ Vướng với ràng buộc hiện tại:* app cố tình chỉ nghe `127.0.0.1`. TV nằm ở máy khác nên
**bắt buộc phải mở ra LAN** — lúc đó phải thêm xác thực trước (xem `SECURITY-AUDIT.md`).
Cần cân nhắc đánh đổi.

### 14. 🟡 Xem cùng nhau (watch party)
Hai máy xem đồng bộ, có chat. Cùng vướng mắc mở ra mạng như mục 13, và phức tạp hơn nhiều.

### 15. 🟢 Nhiều hồ sơ người xem
Mỗi người một lịch sử + danh sách riêng. Chỉ đáng làm nếu có người khác cùng dùng máy — một
mình thì chỉ thêm một bước bấm vô ích.

### 16. 🟢 Đánh giá và ghi chú cá nhân
Chấm sao, viết vài dòng cảm nhận, đánh dấu "xem lại lần nữa". Hợp với người xem nhiều và hay quên
đã xem gì.

### 17. 🟢 Bộ sưu tập tự tạo
Tự gom phim vào danh sách đặt tên ("Xem cuối tuần", "Phim cho con"), sắp thứ tự tay.

### 18. 🟡 Xem chi tiết trong hộp thoại (modal) thay vì chuyển trang
Bấm thẻ phim thì mở hộp thoại đè lên, đóng lại là về đúng chỗ cũ trong lưới — đúng hành vi
Netflix.
*Cần:* dùng intercepting routes của Next (`@modal/(.)phim/[slug]`). Đây là thay đổi kiến trúc
định tuyến, nên xếp ở đây dù nhìn thì "chỉ là UI".

---

## Không nên làm (và lý do)

- **Chọn chất lượng 720/1080** — nguồn chỉ phát **một** rendition (playlist không có
  `#EXT-X-STREAM-INF`). Không có gì để chọn. Muốn có thì phải tự chuyển mã nhiều mức, tốn CPU
  khổng lồ mà chất lượng chỉ giảm đi.
- **Trailer tự phát khi rê chuột** — nguồn có trường `trailer_url` nhưng **hầu hết là rỗng**
  (kiểm phim mẫu: `null`). Làm xong sẽ im lặng không chạy ở đa số phim.
- **Tải tiếp khi đứt giữa chừng** — với HLS phải tự theo dõi từng mảnh đã xong. Chỉ đáng làm nếu
  thực tế hay bị đứt mạng; hiện tải lại từ đầu vẫn nhanh (367 MB ≈ 80 giây).
- **Đăng nhập / tài khoản** — thừa khi app chỉ chạy `127.0.0.1` một người. Chỉ cần khi mở ra LAN.

---

## Gợi ý của tôi nếu chọn một gói

**Gói "làm ngay, thấy liền" (khoảng một buổi):** mục 1 (xem ngẫu nhiên) + 2 (bỏ qua intro) +
4 (thống kê) + 5 (hẹn giờ tắt). Bốn thứ này đều dùng dữ liệu đã có, không đụng kiến trúc, và
đều là thứ dùng hằng ngày.

**Gói "nâng chất" (vài buổi):** mục 12 (kho đệm metadata) trước, rồi 3 (lọc nâng cao) và
7 (gợi ý) — vì cả hai đều phụ thuộc mục 12 mới làm tử tế được.
