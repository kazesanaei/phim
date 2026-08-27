# Kho phim — trang xem phim chạy trên máy

Next.js 16 + SQLite (`node:sqlite`, có sẵn trong Node 24) + ffmpeg. Gộp hai nguồn vào một
thư viện: **API vsmov.com** và **file phim trên ổ cứng**. Dùng cá nhân, phi thương mại.

## Chạy hằng ngày — dùng bản production, KHÔNG dùng `npm run dev`

```bash
npm run chay      # build một lần rồi khởi động; lần sau chỉ cần npm start
```

Mở `http://127.0.0.1:3000`, vào **Quản trị → Thư mục nguồn**, dán đường dẫn thư mục phim,
bấm **Quét lại**. Không cần `.env`.

**Vì sao không `npm run dev`:** đo thực tế trên chính máy này — trang chủ **production 0.04s
so với dev 1–4s** (chênh 50–100 lần). `npm run dev` biên dịch on-demand và không cache đủ,
nên chậm và giật. Chỉ dùng `dev` khi đang sửa code. Xem hết mượt là chuyện của production.

- `npm run chay` = `build` + `start` (build lại + khởi động, dùng khi vừa đổi code).
- `npm start` = chỉ khởi động bản đã build (dùng mỗi lần mở app hằng ngày).
- Cả hai bind `127.0.0.1` — app KHÔNG lộ ra LAN. Nếu cố tình mở ra mạng, đọc mục bảo mật dưới.

```bash
npm run kiem
```

Bộ kiểm nguồn (9 phép, gồm cả chốt chặn CSRF). Chạy khi thấy phim không phát được — nó chỉ thẳng nguồn đã đổi chỗ nào.

---

## Có gì

| | |
|---|---|
| Duyệt | thể loại · quốc gia · năm · danh sách (lẻ/bộ/mới) · lọc kết hợp · phân trang |
| Tìm | không dấu ("nguoi nhen" ra "Người Nhện"), tìm cả nguồn lẫn kho local, phím `/` |
| Player | phụ đề nhiều thứ tiếng · kéo thả `.srt` · dời độ trễ · cỡ chữ · tốc độ · PiP · toàn màn hình · phím tắt · tiếp tục xem · tự sang tập sau |
| Bộ sưu tập | yêu thích · xem sau · lịch sử xem |
| Tải offline | remux sang MP4 không mã hoá lại, **phụ đề nhúng sẵn trong file** (`mov_text`), hàng đợi có tiến độ |
| Kho local | quét thư mục · gom phim bộ · phụ đề rời · tra metadata từ vsmov · trích poster từ video · phát được `.mkv` lạ codec nhờ chuyển mã |
| Quản trị | thư mục nguồn · kéo thả tải file lên · sửa metadata · gom tập |
| Gom phần | các season của cùng một phim gộp thành **một thẻ** kèm huy hiệu "N phần"; trang chi tiết có dải chọn phần đầy đủ |

Phim tải xong nằm trong thư mục đã đánh dấu "thư mục tải về" — thư mục đó cũng là một
thư mục nguồn, nên phim **tự xuất hiện trong Kho của tôi**, và trang xem sẽ phát bản
trong máy thay vì gọi mạng.

---

## 12 cái bẫy đã trả giá — đọc trước khi sửa

### Nguồn phát

1. **API chỉ trả `link_embed`, không có `link_m3u8`.** Suy ra theo quy luật:
   `https://<host>/video/<hash>` → `https://<host>/stream/<hash>/master.m3u8`.
   **Host thay đổi theo phim** (v10, v11...) nên luôn lấy từ chính `link_embed`,
   đừng viết cứng. Xem `lib/nguon-phat.ts`.

2. **Segment HLS KHÔNG có header CORS** ⇒ hls.js trong trình duyệt không tải thẳng được.
   Bắt buộc đi qua `/api/tep?u=`, và route đó phải **viết lại playlist** để mọi dòng URL
   segment cũng trỏ về proxy. Bỏ proxy đi là phim đứng im ở `readyState 0`.

3. **Segment bị phủ header PNG THẬT ~501 byte** để nguỵ trang thành ảnh; MPEG-TS mới bắt
   đầu sau đó. hls.js tự dò byte đồng bộ nên không hề hấn, nhưng **ffmpeg nhận ra PNG rồi
   bỏ cuộc** với `Invalid data found`. Vì vậy bộ tải không đưa m3u8 cho ffmpeg mà tự tải
   từng segment, gọi `bocVoTS()` rồi bơm TS vào `stdin` của ffmpeg. Xem `lib/hls.ts`.

4. **ffmpeg 9 chặn segment có đuôi lạ** (`allowed_segment_extensions`). Nếu có lúc nào
   quay lại cho ffmpeg đọc thẳng m3u8 thì phải thêm `-extension_picky 0` — nhưng cách
   hiện tại (bơm stdin) không dính vấn đề này.

5. **File `.vtt` của nguồn gắn nhãn `WEBVTT` nhưng mốc thời gian dùng dấu phẩy kiểu SRT**
   (`00:00:17,750`). WebVTT bắt buộc dấu chấm ⇒ trình duyệt phân tích ra **0 cue**, phụ
   đề im lặng không báo lỗi gì. Vì thế **luôn** chạy `srtSangVtt()` cho mọi phụ đề, kể cả
   file đã tên `.vtt`. Đừng "tối ưu" bằng cách kiểm dòng đầu rồi bỏ qua.

6. **Chrome trả `"maybe"` cho `canPlayType('application/vnd.apple.mpegurl')` nhưng không
   phát được HLS.** Thứ tự đúng: thử `Hls.isSupported()` TRƯỚC, native HLS chỉ là đường
   lui cho Safari. Tin `canPlayType` là video đứng im, không một dòng lỗi.

### API metadata

7. **Hai kiểu envelope.** `/danh-sach/*` và `/tim-kiem` trả `items` ở gốc; ba endpoint
   danh mục trần `/the-loai`, `/quoc-gia`, `/nam` trả `data.items`. Chuẩn hoá ở
   `lib/vsmov.ts`, đừng rải rác.

8. **`/danh-sach/*` BỎ QUA mọi tham số lọc** — thêm `category`/`country`/`year` vào mà
   `totalItems` không đổi. Muốn lọc phải đi qua `/the-loai/{slug}`, `/quoc-gia/{slug}`
   hoặc `/nam/{year}`. Hàm `duyet()` chọn endpoint theo trục lọc chính; đừng gộp lại
   "cho gọn" — lọc sẽ sai âm thầm.

9. **Chỉ có 4 slug `danh-sach` hợp lệ**: `phim-moi-cap-nhat`, `phim-le`, `phim-bo`,
   `subteam`. `hoat-hinh`, `tv-shows`, `phim-vietsub`... đều 404 — "Hoạt hình" là *thể
   loại*, lấy qua `/the-loai/hoat-hinh`.

### Công cụ

10. **`ffmpeg -ss <giây> -frames:v 1` vượt quá độ dài phim thì thoát mã 0 nhưng KHÔNG
    sinh ảnh.** Phim ngắn sẽ trống poster mà không báo lỗi. `trichKhungHinh()` vì vậy
    luôn thử lại ở giây 0.

11. **`node:sqlite` cần `@types/node` >= 22.** Với bản 20 mặc định của create-next-app,
    TypeScript báo `Cannot find module 'node:sqlite'`.

12. **Bộ kiểm chạy bằng Node thuần nên import phải có đuôi `.ts` tường minh**, và không
    được kéo theo module mở SQLite. Đó là lý do `bocVoTS`/`docSegment` nằm ở `lib/hls.ts`
    không phụ thuộc gì, thay vì nằm chung trong `lib/ffmpeg.ts`.

---

## Bốn chốt chặn an toàn — đừng gỡ

App nghe ở `127.0.0.1` và không có đăng nhập, nhưng `/api/tep` vẫn là proxy và là đường
đọc file, nên:

- `?u=` chỉ nhận `vsmov.com` và `*.streamvsmov.com` — bỏ là thành proxy mở cho cả internet.
- `?f=` và `?ma=` phải nằm trong thư mục nguồn đã đăng ký (`realpath` + so tiền tố, chặn
  `..` và symlink).
- **Gọi ffmpeg bằng mảng argv, không bao giờ nối chuỗi qua shell** — tên file phim là dữ
  liệu người dùng đặt.
- Tải lên: lọc theo đuôi, làm sạch tên file, chỉ ghi vào thư mục nguồn.

Phép kiểm 7 và 7b trong `npm run kiem` canh ba lối vào này và chốt chặn CSRF. Nếu mở app ra LAN thì phải
thêm xác thực trước.

---

## Bản đồ mã

```
lib/vsmov.ts      gọi API + chuẩn hoá 2 envelope + chọn endpoint theo bộ lọc
lib/nguon-phat.ts link_embed -> m3u8 + danh sách phụ đề
lib/hls.ts        bóc vỏ PNG, đọc segment (thuần, không phụ thuộc)
lib/ffmpeg.ts     tìm ffmpeg, ffprobe, tải HLS->MP4, chuyển mã, trích poster
lib/tai-ve.ts     hàng đợi tải offline
lib/quet.ts       quét thư mục, tách tên/năm, gom bộ, tra metadata
lib/thu-vien.ts   đọc kho local
lib/theo-doi.ts   tiến độ xem, yêu thích, xem sau
lib/an-toan.ts    chốt chặn URL và đường dẫn
lib/phu-de.ts     SRT <-> VTT, dời thời gian
lib/db.ts         node:sqlite, lược đồ bảng

app/api/tep       ống dẫn byte duy nhất: proxy / file local / chuyển mã
app/api/nguon     giải mã embed cho player
app/api/thu-vien  quản trị kho local
app/api/tai-ve    hàng đợi tải
app/api/tai-len   nhận file kéo thả (ghi theo luồng)
app/api/xem       tiến độ xem, đánh dấu
```

## Giới hạn đã biết

- Nguồn chỉ phát **một chất lượng** (playlist không có `#EXT-X-STREAM-INF`) nên không có
  menu chọn 720/1080.
- **Huỷ tải giữa chừng = làm lại từ đầu.** Tải tiếp dở dang cho HLS phải tự theo dõi từng
  segment; chỉ đáng làm nếu hay bị đứt mạng.
- **Chuyển mã `.mkv` lạ codec ăn CPU**, và tua sẽ giết tiến trình rồi chạy lại từ mốc mới
  nên trễ 1–2 giây.
- Không có ảnh xem trước khi tua (nguồn không có, tự sinh thì mỗi phim tốn hàng phút).

---

## Hiệu năng — đã tối ưu và đo

Đo bằng `curl -w time_total` trên production build, mỗi route nhiều lần:

| Route | Production | Ghi chú |
|---|---|---|
| `/` (trang chủ, 8 lệnh gọi vsmov) | **~0.04s** | fetch vsmov lấy từ cache, không đi mạng |
| `/duyet?the-loai=...` | ~0.02s | |
| `/phim/[slug]` | ~0.03s | |
| `/tim-kiem` | ~0.02s | |

Những gì đã sửa:

1. **Trang chủ dùng `connection()` thay cho `force-dynamic`** (`app/page.tsx`). `force-dynamic`
   ép `cache: 'no-store'` lên MỌI fetch nên 8 lệnh gọi vsmov phải đi mạng lại mỗi lần tải —
   đó là lý do trang chủ từng chậm và thỉnh thoảng vọt 1s+ theo độ trễ vsmov. `connection()`
   đặt ranh giới: fetch phía trên vẫn cache 600s, chỉ phần đọc SQLite ("Tiếp tục xem") chạy
   tại request-time nên vẫn luôn tươi.
2. **`loading.tsx` cho mọi route** (`app/**/loading.tsx`) — khung xương hiện ngay khi điều
   hướng, không còn màn trắng chờ RSC render xong.
3. **`/duyet` gọi song song** `duyet()` + `layDanhMuc()` thay vì tuần tự (`app/duyet/page.tsx`).
4. **Poster trang chi tiết có `aspect-[2/3]`** (`app/phim/[slug]/page.tsx`) — không nhảy layout
   (CLS) khi ảnh tải xong.

Đã **không** đụng tới: kích thước bundle (baseline ~181KB gzip = React+Next, không có thư viện
lạ; `hls.js` tách đúng, chỉ tải ở `/xem`), ảnh (đã `loading="lazy"`, đúng cỡ từ CDN). Đo cho
thấy JS không phải nút thắt của app này.

## Bảo mật — đã rà 20 mục và vá

Xem `SECURITY-AUDIT.md`. Tóm tắt: đã vá 1 CAO (SSRF qua redirect ở proxy) + 3 TRUNG BÌNH
(chống CSRF cho mọi POST đổi trạng thái) + 4 THẤP. Các chốt chặn:

- **`chanCheoTrang()`** (`lib/an-toan.ts`) — chặn request từ trang khác (`Sec-Fetch-Site`),
  gọi đầu mọi POST và ở proxy GET. Bộ kiểm có phép hồi quy cho nó.
- **Proxy `/api/tep?u=` chặn redirect** (`redirect: 'manual'` + kiểm lại host mỗi bước).
- **Security headers** (`next.config.ts`): CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`. CSP cho `img-src` gồm `vsmov.com`, `media-src`/`worker-src` gồm `blob:`
  để hls.js phát được — đừng siết lại mấy dòng này kẻo player gãy.
- App bind `127.0.0.1`. **Mở ra LAN thì phải thêm xác thực trước** — lúc đó các lỗ CSRF/SSRF
  lên hạng nghiêm trọng.

---

## Gom phần / season

Nguồn coi mỗi season là một phim riêng, nên lưới duyệt từng bị lặp cùng một poster
(«Gia Đình Heck - Phần 1..9» = 9 ô). Giờ:

- **Lưới và các hàng** gom lại thành một thẻ, huy hiệu «N phần». Đo thật trên trang Phim bộ:
  20 mục thô còn **14 thẻ**.
- **Trang chi tiết** có dải «Các phần (N)» — tra lại nguồn bằng tìm kiếm nên ra **đủ mọi
  phần** kể cả những phần không nằm trong trang đang duyệt (Gia Đình Heck: lưới thấy 5,
  trang chi tiết liệt kê đủ 9). Phần nào đang xem dở có chấm đỏ.
- Tên phim tách thành «Gia Đình Heck» + nhãn «Phần 5» riêng, thay vì nhồi hết vào tiêu đề.

**Cách tách** ở `lib/ten-phan.ts` (cố ý không phụ thuộc gì để bộ kiểm nạp được). Tách theo
**tên tiếng Việt** chứ không theo `origin_name`: tên Việt luôn sạch («- Phần 4»), tên gốc lắm
khi lằng nhằng («4th Season: Second Year, First Semester»).

Hai chốt chặn chống cắt nhầm, có phép kiểm hồi quy trong `npm run kiem`:
- Neo cuối chuỗi + đòi `index > 0`, nên «Phần Mềm Diệt Virus» và «Season 1» **không** bị cắt.
- Tên có dấu hai chấm bên trong vẫn đúng: «Luật Pháp Và Trật Tự: Nạn Nhân Đặc Biệt - Phần 16».

**Giới hạn:** `gomPhan()` chỉ gom trong phạm vi danh sách được truyền vào (một trang kết quả).
Nguồn sắp theo thời gian cập nhật nên các phần thường nằm cạnh nhau; phần rơi sang trang khác
sẽ hiện thành thẻ riêng. Muốn gom tuyệt đối thì phải quét toàn bộ 781 trang — không đáng.
Danh sách phần đầy đủ đã có ở trang chi tiết rồi.

---

## Đợt tính năng 27/08 (mục 1–13 + 18 của DE-XUAT-TINH-NANG.md)

| # | Tính năng | Ở đâu |
|---|---|---|
| 1 | **Xem ngẫu nhiên** — bốc theo thể loại hay xem, bỏ phim đã xem xong | `app/ngau-nhien/route.ts` |
| 2 | **Bỏ qua intro** — bấm `I` ở đầu và cuối intro, cả phim dùng chung; nút hiện đúng đoạn, phím `S` để bỏ qua | bảng `moc_intro`, `Player.tsx` |
| 3 | **Sắp xếp + lọc nhiều thể loại** — thứ nguồn KHÔNG hỗ trợ, chạy được nhờ kho đệm | `lib/kho-nguon.ts`, `ThanhLoc.tsx` |
| 4 | **Thống kê** — giờ xem, biểu đồ nhiệt 17 tuần, thể loại hay xem, xem nhiều nhất | `/thong-ke` |
| 5 | **Hẹn giờ tắt** 15–90 phút / "hết tập này", + hỏi "còn xem không" sau 3 tập tự chuyển | `Player.tsx` |
| 6 | **Cài như app (PWA)** — icon sinh bằng ffmpeg | `app/manifest.ts` |
| 7 | **Gợi ý "Vì bạn hay xem …"** theo thể loại trong lịch sử | `lib/goi-y.ts` |
| 8 | **Theo dõi phim bộ + báo tập mới** — so `episode_current`, kiểm mỗi 6 giờ | `lib/tap-moi.ts` |
| 9 | **Ảnh xem trước khi tua** — sprite 10×10 sinh bằng ffmpeg, chỉ cho file trong máy | `lib/anh-tua.ts` |
| 10 | **Chọn track tiếng** cho `.mkv` nhiều thứ tiếng | `lib/ffmpeg.ts`, `Player.tsx` |
| 11 | **Tự tìm phụ đề** từ OpenSubtitles (cần API key miễn phí) | `lib/phu-de-ngoai.ts` |
| 12 | **Kho đệm metadata** — quét theo thể loại, chạy nền, tạm dừng/tiếp được | `lib/kho-nguon.ts`, Quản trị → Kho đệm |
| 13 | **Chế độ LAN** cho TV Box + xác thực | `proxy.ts`, `lib/xac-thuc.ts` |
| 18 | **Xem nhanh trong hộp thoại** (intercepting route) | `app/@modal/(.)phim/[slug]` |

### Xem trên TV Box / điện thoại

```bash
npm run mat-khau <mật-khẩu>   # đặt mật khẩu + bật chế độ LAN, in ra địa chỉ
npm run tv                    # build + chạy, nghe cả mạng nội bộ
```

**Laptop phải bật.** TV Box chỉ là màn hình — mọi thứ nặng (phục vụ trang, proxy HLS, đọc ổ
cứng, chuyển mã) đều chạy trên laptop. Nhưng **không cần cài gì trên TV Box**, chỉ mở trình
duyệt vào `http://<ip-laptop>:3000`.

Quên mật khẩu thì chạy `npm run mat-khau` trên chính máy chủ — trang Quản trị nằm sau cửa
xác thực nên không tự cứu được.

### Bốn cái bẫy mới trả giá trong đợt này

13. **Next 16 đổi `middleware.ts` thành `proxy.ts`**, và `proxy.ts` mặc định chạy **Node.js
    runtime** — nhờ vậy đọc thẳng được SQLite để biết đã bật chế độ LAN chưa. Middleware
    edge của các bản trước không làm được.
14. **`node:sqlite` chỉ nhận null/number/string/bigint/Uint8Array.** Lọt một `undefined` là
    ném `cannot be bound to SQLite parameter N` — mà N KHÔNG cho biết trường nào. Vì thế
    `luuPhimVaoKho()` ép kiểu tường minh từng giá trị. Đây là lỗi làm chết cả vòng quét kho
    đệm ngay trang đầu.
15. **`create table if not exists` KHÔNG thêm cột vào bảng đã có.** DB cũ sẽ thiếu cột mới và
    truy vấn ném lỗi. Xem `COT_THEM` trong `lib/db.ts` — thêm cột mới thì khai báo ở đó.
16. **Đừng sắp xếp thẳng theo `diem`.** Đo thật trên kho: top toàn phim 10 điểm từ 1–2 phiếu.
    Phải dùng xếp hạng có trọng số kiểu IMDb (`bieuThucHang` trong `lib/kho-nguon.ts`) — nó
    không loại phim ít phiếu mà kéo về gần trung bình, nên phim Việt/châu Á ít phiếu TMDB
    vẫn có cửa.

### Bảng nở khi rê chuột phải vẽ bằng portal

Hàng phim cuộn ngang dùng `overflow-x: auto`, mà chuẩn CSS không cho `overflow-y: visible`
đi kèm — vẽ bảng tại chỗ là bị cắt cụt. `TheePhim.tsx` vì vậy dựng bảng bằng `createPortal`
ra `<body>` và tự tính toạ độ từ `getBoundingClientRect()`, đóng lại khi cuộn.

---

## Nhiều nguồn phim (27/08)

| Nguồn | API | Ghi chú |
|---|---|---|
| **vsmov.com** | `https://vsmov.com/api` | Nguồn gốc. Chỉ có `link_embed`, segment bị phủ header PNG |
| **KKPhim** (`phimapi.com`) | `https://phimapi.com` | Nguồn sau `motchillm.fm`. Trả **thẳng `link_m3u8`**, segment MPEG-TS sạch |

Bật/tắt ở **Quản trị → Nguồn phim**. Tắt hết thì app tự giữ lại vsmov.

**Hai trang đã khảo sát nhưng KHÔNG dùng được:**
- `cobephim.lat` — mọi đường `/api/` đều 404, chỉ trả HTML. Muốn dùng phải bóc HTML, giòn.
- `levebistro.com` — 502 toàn bộ, kể cả `/wp-json/`. Máy chủ đang lỗi hoặc chặn.

### Khử trùng

Khử theo **`slug`** — cả hai nguồn lấy metadata gốc từ cùng một hệ nên slug trùng khi là
cùng phim. Đo thật: 22/72 (31%) phim mới nhất của KKPhim đã có trên vsmov. Phim trùng
**không bị vứt** mà gộp thành nhiều server ở trang chi tiết, nguồn này chết thì đổi nguồn kia.

**Đừng tưởng cùng họ API là cùng kho phim.** Tôi đã đoán vậy và sai: 69% phim mới của KKPhim
không có trên vsmov. Mỗi bên tự gom thư viện riêng.

### Chặn 18+

Hai lớp trong `lib/loc-18.ts`, cố ý chồng nhau:
1. **Sổ đen theo slug** — quét thể loại `phim-18` của KKPhim (79 phim), chặn theo slug.
2. **Lưới theo tên** — bắt phần lọt lưới vì nguồn quên gắn thể loại.

**vsmov CÓ chứa nội dung 18+ dù KHÔNG gắn nhãn thể loại nào.** Đo được 15 phim trong sổ đen
nằm sẵn trong kho vsmov, và **lưới tên bắt được 0/15** — tên phim không lộ dấu hiệu gì. Nên
lớp sổ đen là bắt buộc, lưới tên chỉ là phụ.

Chặn ở **bốn** chỗ, đừng bỏ chỗ nào: lúc ghi vào kho đệm, lúc đọc ra khỏi kho, lúc gộp danh
sách (`gopVaKhuTrung`), và ở trang chi tiết (`layChiTiet` trả `null`). Phép kiểm 7c canh việc này.

### Ba cái bẫy mới

17. **Đừng cache sổ đen trong bộ nhớ module.** Bản đầu tôi cache vào một `Set`, nó được nạp
    (rỗng) TRƯỚC khi quét sổ đen rồi không bao giờ nạp lại — phim 18+ vẫn mở được. Bảng vài
    chục dòng, đọc lại mỗi lần là micro-giây.
18. **`proxy.ts` import `lib/db.ts` làm Turbopack truy vết cả `du-lieu/`** và cố đọc file WAL
    đang bị khoá → build gãy `os error 33`. Đã loại trừ bằng `outputFileTracingExcludes`.
19. **Đổi lược đồ DB thì PHẢI khởi động lại dev server.** Lược đồ chỉ chạy lúc mở kết nối, mà
    kết nối được giữ trong `globalThis` qua các lần hot-reload — bảng mới sẽ không xuất hiện.
20. **Host phát của KKPhim là TÊN MIỀN khác nhau, không phải subdomain** (`kkphimplayer6.com`,
    `kkphimplayer7.com`). Allowlist theo hậu tố không bắt được — xem `MAU_MIEN` trong `an-toan.ts`.
