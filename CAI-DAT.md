# Cài trên máy mới (laptop nối TV)

Trang xem phim chạy trên máy. Gộp hai nguồn trực tuyến với kho phim trên ổ cứng.
Đã chặn nội dung 18+ và khử trùng phim giữa các nguồn.

---

## 1. Cần có trước

| Thứ | Cách cài | Vì sao |
|---|---|---|
| **Node.js 22+** (khuyên 24) | https://nodejs.org | Bắt buộc — `node:sqlite` chỉ có từ bản 22. Kiểm bằng `node -v`. `cai-dat.cmd` cũng chặn ở mốc 22 |
| **ffmpeg** | `winget install Gyan.FFmpeg` | Tải phim về, phát `.mkv` lạ codec, ảnh xem trước khi tua |

Không có ffmpeg thì app vẫn chạy, chỉ mất mấy tính năng đó.

## 2. Cài

```bash
git clone https://github.com/kazesanaei/phim.git
```

Bản mới chưa gộp vào `main` (đang nằm ở một nhánh riêng) thì clone thẳng nhánh đó:

```bash
git clone -b <tên-nhánh> https://github.com/kazesanaei/phim.git
```

Rồi **bấm đúp `cai-dat.cmd`** trong thư mục vừa clone. Nó kiểm Node, cài gói, dựng sẵn
kho đệm 18.719 phim từ `kho-dem/`, build, rồi mở trang.

Bấm lại nhiều lần không sao — các bước đã làm thì bỏ qua, và nó **không bao giờ đè lên**
`du-lieu/phim.db` (lịch sử xem nằm ở đó). Lần sau chỉ cần `chay.cmd`.

Muốn làm bằng tay thì:

```bash
cd phim
npm install
npm run chay
```

`npm run chay` = build một lần rồi khởi động. **Lần sau chỉ cần `npm start`.**

Mở `http://127.0.0.1:3000`.

### Việc nên làm một lần sau khi cài

1. **Quản trị → Lọc 18+ → Quét lại sổ đen 18+** (cần mạng). Sổ đen trong kho dựng sẵn
   chặn mù cả thể loại 18+ của nguồn, lẫn cả phim kinh dị / phim đàng hoàng. Quét lại
   thì app xem thể loại của từng phim: phim tình dục thì chặn, phim còn lại chỉ gắn mác 18+.
2. Không cần làm gì cho kho đệm: app tự dọn phim bị chặn khỏi kho lúc khởi động lần đầu,
   và **tự cập nhật phim mới** 30 phút một lần khi đang chạy (bật/tắt ở Quản trị → Kho đệm).

> **Đừng dùng `npm run dev` để xem phim.** Đo thực tế: trang chủ production ~0,04s
> so với dev 1–4s (chênh 50–100 lần). `dev` chỉ để sửa code.

### Máy đã cài rồi: lên bản mới mà giữ nguyên dữ liệu

Kho đệm, lịch sử xem, yêu thích, mốc intro, mật khẩu LAN đều nằm trong
`du-lieu/phim.db` — thư mục này nằm trong `.gitignore`, git **không bao giờ** đụng tới.
Nên **đừng clone sang thư mục mới**: bản clone mới không có `du-lieu/`, `cai-dat.cmd` sẽ
dựng lại kho từ bản zip cũ, còn kho bạn đã cập nhật nằm lại ở thư mục cũ.

Cập nhật ngay trong thư mục đang dùng:

```bash
# 1. Tắt app (đóng cửa sổ chay.cmd) — build lúc app đang chạy sẽ lỗi trên Windows
cd đường\dẫn\tới\phim

# 2. Sao lưu cho chắc (chỉ chép, không xoá gì)
copy du-lieu\phim.db du-lieu\phim-sao-luu.db

# 3. Lấy bản mới
git status                 # có tệp sửa dở (thường là AGENTS.md do next dev ghi) thì báo trước khi làm tiếp
git fetch origin
git checkout <tên-nhánh>   # hoặc: git pull   nếu bản mới đã gộp vào main

# 4. Cài gói mới (nếu có) và build lại
npm install
npm run build
```

Rồi mở bằng `chay.cmd` như mọi khi. Lần khởi động đầu, app tự thêm các cột mới vào DB
và **rút khỏi kho đệm những phim bị chặn theo lưới 18+ mới** (chỉ bảng kho phim; lịch sử
xem và yêu thích giữ nguyên). Kho bạn đã cập nhật vẫn còn đủ phần còn lại.

Lỡ clone sang thư mục mới rồi thì: tắt app ở thư mục cũ, chép cả thư mục `du-lieu/` cũ
(gồm `phim.db` và nếu có thì `phim.db-wal`, `phim.db-shm`) sang thư mục mới, **rồi** mới
chạy `cai-dat.cmd` — nó thấy đã có `phim.db` thì bỏ qua bước giải nén, không đè lên.

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

### Chọn máy làm máy chủ — KHÔNG dùng laptop công ty

Máy chạy app là máy chủ: nó tải và chuyển tiếp video, giữ kho phim và lịch sử xem. **Đừng
dùng laptop công ty** cho việc này: cài phần mềm mở đường vào từ xa (Tailscale, Cloudflare
Tunnel, ngrok...) thường trái quy định IT, và lưu lượng phim đi qua máy công ty có thể bị
phần mềm giám sát ghi lại. Laptop công ty chỉ nên là **máy xem** (mở trình duyệt).

| Máy chủ | Hợp khi | Ghi chú |
|---|---|---|
| Máy tính / laptop cũ **cá nhân**, để bật ở nhà | Có sẵn máy | Windows, dùng ngay các script `.cmd` |
| Raspberry Pi 5 / mini PC | Muốn ít tốn điện, chạy 24/7 | Linux, khoảng 5–15 W |
| VPS thuê | Không có máy ở nhà | **Không khuyên dùng**: tốn băng thông, dễ bị khoá, nguồn phim hay chặn IP trung tâm dữ liệu, mất kho phim trên ổ cứng |

Lối vào từ xa, cho máy chủ CÁ NHÂN:

- **Tailscale** (mục dưới): mỗi máy xem cài app Tailscale. Miễn phí, không cần tên miền.
- **Cloudflare Tunnel + Cloudflare Access**: máy xem **không cài gì**, mở trình duyệt vào
  `https://phim.<tên-miền>`, Cloudflare gửi mã về email và chỉ cho email được phép đi qua —
  hợp khi máy xem là máy công ty không cài được phần mềm. Cần tên miền (~250.000 đ/năm); gói
  miễn phí của Cloudflare hạn chế việc dùng chủ yếu để truyền video, dùng cá nhân ít người
  thường không sao nhưng vẫn có rủi ro bị nhắc.

Cả hai đều **không** biến app thành trang công khai: người ngoài không vào được.

### Xem từ xa bằng Tailscale (ở ngoài nhà, nhiều máy)

> Chạy phần này trên **máy chủ cá nhân**, không phải laptop công ty (xem mục trên).

Không phải clone hay cài Node trên máy xem. Laptop ở nhà chạy app như bình thường,
các máy khác vào qua **mạng riêng Tailscale** — chỉ thiết bị đăng nhập **cùng tài khoản
Tailscale của bạn** mới thấy trang, người ngoài internet không vào được.

**Một lần trên máy chủ cá nhân:**

1. Cài Tailscale cho Windows: https://tailscale.com/download, đăng nhập (Google/Microsoft...).
2. Vào https://login.tailscale.com/admin/dns, bật **MagicDNS** và **HTTPS Certificates**.
3. Bấm đúp **`chay-tu-xa.cmd`**. Lần đầu nó hỏi đặt mật khẩu (bắt buộc), rồi in ra địa chỉ
   dạng `https://ten-may.tailxxxx.ts.net`.

Lần sau chỉ cần bấm đúp `chay-tu-xa.cmd`. Đóng cửa sổ là tắt app.

**Trên mỗi máy muốn xem:**

| Máy | Cách |
|---|---|
| Laptop / PC khác | Cài Tailscale, đăng nhập cùng tài khoản, mở trình duyệt vào địa chỉ trên |
| Điện thoại Android / iPhone | Cài app Tailscale từ CH Play / App Store, đăng nhập, mở địa chỉ trên |
| TV Box Android | Cài app Tailscale từ CH Play (có bản Android TV), đăng nhập, mở địa chỉ trên |

Đăng nhập mật khẩu của app một lần là mỗi máy nhớ 1 năm. Lịch sử xem, yêu thích, tiến độ
**dùng chung** giữa các máy vì đều đọc cùng một máy chủ.

**Cần biết:**
- **Laptop ở nhà phải bật** và đang chạy `chay-tu-xa.cmd`. Máy tắt thì link báo lỗi.
- Phim đi qua đường **tải lên** của mạng nhà. Mạng nhà chậm chiều tải lên thì xem từ xa
  có thể giật; mỗi người xem 1080p cần khoảng 4–6 Mbit/s.
- **Tuyệt đối không dùng `tailscale funnel`** — lệnh đó mở trang ra CẢ INTERNET.
  `tailscale serve` (script đang dùng) chỉ mở trong mạng riêng của bạn.
- Tắt hẳn lối vào từ xa: `tailscale serve reset`.
- Mất điện thoại hay muốn đuổi mọi thiết bị: chạy lại `node scripts\dat-mat-khau.mjs --hoi`
  để đặt mật khẩu mới (mọi vé đăng nhập cũ hết hạn ngay), và gỡ máy đó khỏi
  https://login.tailscale.com/admin/machines.

Vì sao không đưa lên internet công khai: phim lấy từ nguồn không có bản quyền phân phối và
đi qua chính máy chủ của bạn, còn trang Quản trị xoá được file thật trên ổ cứng.

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
| Kho đệm phim | Dựng sẵn từ `kho-dem/*.zip`, rồi mỗi máy tự cập nhật phim mới |
| Danh sách Lọc 18+ đặt tay | Đặt lại trên từng máy |
| Mật khẩu LAN, khoá ký HMAC | **Không bao giờ** lên git — đúng như vậy |
| Đường dẫn thư mục phim | Riêng từng máy vì ổ đĩa khác nhau |

## 9. Khi có trục trặc

```bash
npm run kiem
```

Bộ phép kiểm tự động, chạy được cả khi app tắt. Chạy khi phim không phát được — nó
chỉ thẳng nguồn đã đổi chỗ nào thay vì bắt bạn mò trong giao diện.

Các tài liệu khác:

- [README.md](README.md) — 20 cạm bẫy kỹ thuật đã trả giá, đọc trước khi sửa code
- [SECURITY-AUDIT.md](SECURITY-AUDIT.md) — rà bảo mật 20 mục
- [DE-XUAT-TINH-NANG.md](DE-XUAT-TINH-NANG.md) — tính năng nào đã làm, cái nào **không nên** làm và vì sao
