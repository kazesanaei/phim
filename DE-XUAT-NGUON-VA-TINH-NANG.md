# Đề xuất đợt 2 — Thêm nguồn phim, bảo mật đi kèm, tính năng còn thiếu

> Viết ngày 18/10/2026. Đợt 1 (`DE-XUAT-TINH-NANG.md`) đã làm xong gần hết, nên tệp này
> chỉ đề xuất những thứ **chưa có**. Ký hiệu công sức giữ như đợt 1:
> 🟢 dưới nửa buổi · 🟡 một buổi · 🔴 nhiều buổi. ⚠️ = có rào cản thật, đọc kỹ trước khi chọn.

**Giới hạn của bản đề xuất này:** máy dựng đề xuất bị chặn mạng tới mọi nguồn phim, nên các
endpoint ở mục A1 viết theo hiểu biết về họ API này, **chưa đo lại được**. Trước khi viết
adapter, chạy thử từng URL trên máy thật — đúng cách đã làm với vsmov và KKPhim.

---

## A. Nguồn API

### A1. Nguồn phát — cùng họ API với vsmov / KKPhim

Cùng kiểu JSON (`items`, `pagination`, `movie`, `episodes[].server_data[]`), nên mỗi nguồn
chỉ là **một adapter cỡ `lib/nguon-kkphim.ts`** (~180 dòng) cộng với một dòng trong `NGUON` của
`lib/nguon.ts`. Khử trùng theo slug, gộp server, chặn 18+ và kho đệm tự hoạt động.

| Nguồn | Gốc API (cần đo lại) | Vì sao đáng thêm | Công sức |
|---|---|---|---|
| **OPhim** | `https://ophim1.com` — `/danh-sach/phim-moi-cap-nhat`, `/phim/{slug}`, `/v1/api/tim-kiem?keyword=` | Kho lớn, hệ gốc của cả họ API này. Theo kinh nghiệm cùng họ, slug trùng nhiều với vsmov → thêm **server dự phòng** cho phim sẵn có hơn là thêm phim mới | 🟡 |
| **NguonC** | `https://phim.nguonc.com/api` — `/films/phim-moi-cap-nhat`, `/film/{slug}`, `/films/search?keyword=` | Kho **độc lập** (không cùng hệ slug) → nhiều phim không có ở hai nguồn kia, nhất là phim Trung/Hàn mới. Bù lại: slug khác nên **không khử trùng được theo slug**, phải ghép theo tên gốc + năm | 🟡 |

⚠️ **Rào cản chung:**
- Các nguồn này là trang tổng hợp **không có bản quyền phân phối**. App đang dùng đúng loại
  nguồn này, nên thêm nguồn không làm rủi ro pháp lý khác đi — nhưng đây là lý do app nên
  tiếp tục **chỉ chạy trong nhà**, không mở ra internet.
- Mỗi nguồn có **cạm bẫy riêng** dù trông giống nhau. KKPhim gắn trường ảnh ngược với vsmov
  (bẫy đã trả giá ở README). Phải đo bằng `ffprobe` và ghi vào bộ kiểm trước khi tin.
- Nguồn hay **chèn quảng cáo vào giữa playlist** (đoạn `#EXT-X-DISCONTINUITY` lạ). Nếu gặp,
  lọc ở `/api/tep` lúc viết lại m3u8, đừng lọc ở trình phát.

### A2. Metadata hợp pháp — làm giàu phim sẵn có

Không phát phim, chỉ cho **thông tin**. Đây là nhóm đáng làm nhất vì giải đúng những chỗ đợt 1
đành bỏ ("trailer_url hầu hết rỗng").

| API | Cần | Cho thêm được gì | Công sức |
|---|---|---|---|
| **TMDB** (`api.themoviedb.org/3`) | API key miễn phí cho dùng phi thương mại; **bắt buộc ghi nguồn TMDB** và logo nhỏ hơn logo của mình | **Trailer YouTube** (`/videos`), ảnh diễn viên, phim tương tự, **bộ sưu tập** (gom phần chính xác hơn tách tên), ngày chiếu → hàng "Sắp ra mắt". Dữ liệu nguồn vốn đã kèm `tmdb.id` nên khỏi phải tra tên | 🟡 |
| **Jikan v4** (`api.jikan.moe/v4`, MyAnimeList) | Không cần key; tôn trọng giới hạn ~3 yêu cầu/giây | **Lịch phát sóng anime theo mùa**, tên Romaji/tiếng Nhật để tìm khớp, điểm MAL | 🟢 |
| **OMDb** (`omdbapi.com`) | Key miễn phí, hạn mức theo ngày | Điểm IMDb + Rotten Tomatoes cạnh điểm TMDB | 🟢 |

Nguồn của các thông tin trên: [điều khoản TMDB (FAQ ghi phi thương mại + ghi nguồn)](https://apidog.com/blog/tmdb-api-key/),
[tổng hợp giới hạn TMDB](https://zuplo.com/learning-center/best-movie-api-imdb-vs-omdb-vs-tmdb). Con số giới hạn
tần suất của TMDB mỗi nơi ghi một khác — cứ coi HTTP 429 là tín hiệu lùi lại, đừng dựa vào một con số cứng.

OpenSubtitles **đã có** (`lib/phu-de-ngoai.ts`). Lưu ý hạn mức tải của tài khoản miễn phí rất
thấp và mỗi nguồn ghi một khác ([Jellyfin](https://forum.jellyfin.org/t-opensubtitles-limitations),
[Plank](https://www.mintlify.com/logscore/plank/integrations/opensubtitles)) — giữ nguyên cách "chỉ tải khi bấm".

---

## B. Bảo mật đi kèm khi thêm nguồn

Ba chốt chặn hiện có (allowlist miền, chặn redirect ở proxy, kiểm đường dẫn) đã đúng. Thêm
nguồn mới thì **mở rộng đúng ba chốt đó, không mở đường tắt**. Danh sách việc cho mỗi nguồn:

| # | Việc | Ở đâu | Vì sao |
|---|---|---|---|
| B1 | Thêm host phát vào `MIEN_CHO_PHEP`/`MAU_MIEN`, host ảnh vào `MIEN_ANH` — **tách riêng**, mẫu chặt (như `kkphimplayer\d{1,2}\.com`) | `lib/an-toan.ts` | Nới một bên không được nới luôn bên kia. Tuyệt đối không dựng allowlist từ dữ liệu nguồn trả về |
| B2 | **Đặt hạn chờ cho mọi lệnh gọi nguồn** (`signal: AbortSignal.timeout(8000)`) | `goi()` trong `lib/vsmov.ts`, `lib/nguon-kkphim.ts`, adapter mới | **Phát hiện khi rà lần này:** hiện KHÔNG có hạn chờ nào. Một nguồn treo (không chết hẳn) giữ cả trang chủ đứng chờ, vì `anToan()` chỉ bắt lỗi chứ không bắt treo. Càng nhiều nguồn càng dễ dính. 🟢 |
| B3 | Giới hạn kích thước JSON nhận về (vd. từ chối > 5 MB) | cùng chỗ B2 | Nguồn bị chiếm có thể trả JSON khổng lồ làm tràn bộ nhớ máy chủ |
| B4 | Ép kiểu từng trường bằng `chuoi()` / `soHoacNull()`, lột thẻ HTML bằng `lotThe()` | adapter mới | Đã trả giá: 360 poster "[object Object]". Mô tả phim là HTML của người ngoài — không bao giờ nhúng thô |
| B5 | Quét **thể loại người lớn của nguồn mới** vào sổ đen; mọi đường ra vẫn qua `locSach()` | `lib/loc-18.ts`, `quetSlug18` | Mỗi nguồn đặt slug thể loại 18+ khác nhau; vsmov thậm chí không gắn nhãn (README) |
| B6 | API key (TMDB/OMDb) lưu trong `cai_dat` phía máy chủ, **không gửi xuống trình duyệt**, che bớt khi hiện trong Quản trị | như khoá OpenSubtitles | Key lộ ra trình duyệt là ai trong LAN cũng lấy được |
| B7 | Lùi lại khi gặp 429/5xx, nghỉ giữa các lượt như vòng quét kho | adapter + `lib/cap-nhat-moi.ts` | Bị nguồn chặn IP thì mất luôn nguồn đó |
| B8 | Thêm phép kiểm cho mỗi nguồn vào `npm run kiem` | `scripts/kiem-nguon.mjs` | Nguồn đổi cấu trúc là biết ngay, không phải mò trong giao diện |

Hai việc gia cố chung, không phụ thuộc nguồn:
- **B9 🟢 Nút "Đăng xuất mọi thiết bị"** — đổi khoá ký HMAC trong `cai_dat`. Vé đăng nhập ở
  chế độ LAN sống 365 ngày, hiện mất TV Box hay cho mượn điện thoại thì không thu hồi được
  (README đã ghi: đổi mật khẩu không đuổi được thiết bị nào).
- **B10 🟢 Chạy `npm audit` trong bộ kiểm** — hiện 0 lỗ hổng; đưa vào bộ kiểm để lần nâng
  Next sau không lọt.

---

## C. Tính năng còn thiếu cho web phim

### Nhóm 1 — Nên làm trước

**C1. ✅ ĐÃ LÀM 18/10 — Tự đổi máy chủ khi phát lỗi** (xem README).
~~🟡 Tự đổi máy chủ khi phát lỗi.~~ Hiện lỗi thì hiện nút "Đổi sang …" để bấm tay. Thêm
nguồn càng nhiều càng nên tự thử lần lượt các máy chủ còn lại (đếm ngược 3 giây, có nút Huỷ),
nhớ máy chủ nào hay chết để xếp xuống cuối.

**C2. 🟢 Bảng sức khoẻ nguồn trong Quản trị.** Mỗi nguồn: lần gọi gần nhất thành công lúc nào,
thời gian phản hồi, tỉ lệ lỗi 24 giờ. Thiếu nó thì có 4 nguồn cũng không biết nguồn nào đang kéo chậm cả trang.

**C3. 🟢 Sao lưu / khôi phục dữ liệu cá nhân.** Xuất lịch sử xem, yêu thích, theo dõi, mốc
intro ra một tệp JSON; nhập lại trên máy mới. Kho đệm dựng lại được, nhưng mấy bảng này thì
không — và `kho-dem/README.md` đã cảnh báo đè DB là mất sạch.

**C4. 🟡 Trailer** (cần A2 · TMDB). Nút xem trailer ở trang chi tiết, phát trong hộp thoại.
Đợt 1 bỏ vì `trailer_url` của nguồn hầu hết rỗng; TMDB thì có cho đa số phim.

### Nhóm 2 — Đáng làm

**C5. 🟡 Lịch "Sắp ra mắt" và lịch anime theo mùa** (cần A2 · TMDB/Jikan). Bấm "Nhắc tôi" thì
nối vào cơ chế theo dõi sẵn có (`lib/tap-moi.ts`): phim lên nguồn là hiện huy hiệu.

**C6. 🟡 Chế độ trẻ em có mã PIN.** Không phải "nhiều hồ sơ" (đã quyết không làm) — chỉ một
công tắc: bật thì giấu thể loại kinh dị/18+ ở mọi nơi, muốn tắt phải nhập PIN. Hợp với chế độ
TV Box trong phòng khách.

**C7. 🔴 Thông báo đẩy khi có tập mới (Web Push).** Chế độ LAN đã có HTTPS nên làm được, nhưng
phải thêm service worker và chỉ chạy khi laptop bật. Cân nhắc: huy hiệu trong app có thể đã đủ.

### Không nên làm

- **Gộp thêm nguồn kiểu "bóc HTML"** (như `cobephim.lat` đã khảo sát) — giòn, gãy mỗi lần
  trang đổi giao diện; chỉ nhận nguồn có JSON API.
- **Tự dịch phụ đề bằng AI** — tốn chi phí theo lượt, chất lượng thua phụ đề có sẵn của nguồn.

---

## Gợi ý nếu chọn một gói

**Gói "chắc chân" (khoảng một buổi):** B2 (hạn chờ — nên làm dù không thêm nguồn) + C2 (sức
khoẻ nguồn) + C3 (sao lưu) + B9 (đăng xuất mọi thiết bị).

**Gói "thêm nguồn" (một đến hai buổi):** đo thật OPhim và NguonC trên máy → viết adapter kèm
B1, B3–B8 → C1 (tự đổi máy chủ). Làm C1 ngay sau khi thêm nguồn thì mới thấy được lợi của nhiều nguồn.

**Gói "giàu thông tin" (một buổi, cần key TMDB):** A2 · TMDB → C4 (trailer) → C5 (sắp ra mắt).
