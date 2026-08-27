# Cài trên máy mới (laptop nối TV)

Trang xem phim chạy trên máy. Gộp hai nguồn trực tuyến với kho phim trên ổ cứng.
Đã chặn nội dung 18+ và khử trùng phim giữa các nguồn.

---

## 1. Cần có trước

| Thứ | Cách cài | Vì sao |
|---|---|---|
| **Node.js 24+** | https://nodejs.org | Bắt buộc — `node:sqlite` chỉ có từ bản 22/24. Kiểm bằng `node -v` |
| **ffmpeg** | `winget install Gyan.FFmpeg` | Tải phim về, phát `.mkv` lạ codec, ảnh xem trước khi tua |

Không có ffmpeg thì app vẫn chạy, chỉ mất mấy tính năng đó.

## 2. Cài

```bash
git clone https://github.com/kazesanaei/phim.git
cd phim
npm install
npm run chay
```

`npm run chay` = build một lần rồi khởi động. **Lần sau chỉ cần `npm start`.**

Mở `http://127.0.0.1:3000`.

> **Đừng dùng `npm run dev` để xem phim.** Đo thực tế: trang chủ production ~0,04s
> so với dev 1–4s (chênh 50–100 lần). `dev` chỉ để sửa code.

## 3. Thêm kho phim trên ổ cứng

Vào **Quản trị → Thư mục nguồn**:

1. Dán đường dẫn thư mục chứa phim (ví dụ `D:\Phim`), bấm **Kiểm tra** rồi **Thêm**
2. Tick một thư mục làm nơi lưu phim tải về
3. Bấm **Quét lại**

App tự tách tên/năm từ tên file, gom phim bộ, dò phụ đề `.srt` nằm cạnh, tra poster
từ nguồn, và đọc codec để biết file nào cần chuyển mã.

## 4. Kho đệm metadata — nên làm

Vào **Quản trị → Kho đệm** bấm **Bắt đầu quét**. Khoảng **45 phút**, chạy nền, tạm
dừng và chạy tiếp được. Cứ bấm rồi đi làm việc khác.

Có kho rồi thì làm được ba thứ nguồn **không hỗ trợ**:

- Sắp xếp theo điểm (xếp hạng có trọng số, không phải điểm thô) hoặc theo năm
- Lọc nhiều thể loại cùng lúc
- Gom các phần của một phim triệt để trên toàn danh mục (238 phim có nhiều phần)

> **Đừng sửa file trong dự án khi đang quét** — hot-reload sẽ ngắt vòng lặp. App tự
> phát hiện và chạy lại sau ~90 giây, nhưng mất thời gian.

## 5. Xem trên TV

**Laptop phải bật và đang chạy app.** TV Box chỉ là màn hình — phục vụ trang, proxy,
đọc ổ cứng, chuyển mã đều chạy trên laptop. Tắt laptop là link chết.

Nhưng **không cần cài gì trên TV Box**, chỉ mở trình duyệt.

```bash
npm run mat-khau <mật-khẩu-của-bạn>   # đặt mật khẩu, bật LAN, in ra địa chỉ IP
npm run tv                            # build + chạy, nghe cả mạng nội bộ
```

Trên TV Box mở trình duyệt vào địa chỉ vừa in ra, ví dụ `http://192.168.1.15:3000`,
nhập mật khẩu.

**Quên mật khẩu:** chạy `npm run mat-khau` trên chính laptop. Trang Quản trị nằm sau
cửa xác thực nên không tự cứu được.

**Quay lại chỉ chạy riêng laptop:** `npm run mat-khau --xoa` rồi `npm start`.

## 6. Phím tắt khi xem

| Phím | Việc |
|---|---|
| `Space` `K` | Phát / dừng |
| `J` `L` hoặc `←` `→` | Lùi / tiến 10 giây |
| `↑` `↓` | Âm lượng |
| `F` | Toàn màn hình |
| `M` | Tắt tiếng |
| `C` | Bật tắt phụ đề |
| `P` | Cửa sổ nhỏ |
| `N` | Tập sau |
| `0`–`9` | Nhảy theo phần trăm |
| `[` `]` | Đổi tốc độ |
| `I` | Đánh dấu đầu và cuối intro (dùng chung cho cả phim bộ) |
| `S` | Bỏ qua intro |
| `/` | Nhảy vào ô tìm kiếm |

Kéo thẳng file `.srt` vào khung hình để gắn phụ đề riêng.

## 7. An toàn

Mặc định app chỉ nghe `127.0.0.1` — máy khác không vào được. Bật chế độ LAN thì
**bắt buộc có mật khẩu** (app không cho bật nếu chưa đặt).

Đã có sẵn: chặn request từ trang khác, chặn proxy đi ra ngoài miền cho phép, chặn đọc
file ngoài thư mục nguồn đã đăng ký, và các header bảo mật. Chi tiết ở
[SECURITY-AUDIT.md](SECURITY-AUDIT.md).

**Đừng mở ra internet** (không chỉ LAN). App không được thiết kế cho việc đó.

## 8. Dữ liệu không đi theo git

`du-lieu/` nằm trong `.gitignore`, cố ý. Mỗi máy giữ riêng:

| Thứ | Hệ quả |
|---|---|
| Lịch sử xem, yêu thích, mốc intro | Không đồng bộ giữa các máy |
| Kho đệm phim | Mỗi máy tự quét (~45 phút) |
| Mật khẩu LAN, khoá ký HMAC | **Không bao giờ** lên git — đúng như vậy |
| Đường dẫn thư mục phim | Riêng từng máy vì ổ đĩa khác nhau |

## 9. Khi có trục trặc

```bash
npm run kiem
```

11 phép kiểm tự động, chạy được cả khi app tắt. Chạy khi phim không phát được — nó
chỉ thẳng nguồn đã đổi chỗ nào thay vì bắt bạn mò trong giao diện.

Các tài liệu khác:

- [README.md](README.md) — 20 cạm bẫy kỹ thuật đã trả giá, đọc trước khi sửa code
- [SECURITY-AUDIT.md](SECURITY-AUDIT.md) — rà bảo mật 20 mục
- [DE-XUAT-TINH-NANG.md](DE-XUAT-TINH-NANG.md) — tính năng nào đã làm, cái nào **không nên** làm và vì sao
