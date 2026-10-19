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

## Tìm kiếm và tự cập nhật phim mới (18/10)

**Triệu chứng:** gõ "A love other than yours" (phim Hàn chiếu từ 12/09/2026) mà không ra gì.

**Ba nguyên nhân chồng nhau:**
1. `/tim-kiem` của nguồn khớp **nguyên cụm** từ khoá. Tên tiếng Anh dài chỉ cần nguồn lưu hơi
   khác (thiếu mạo từ "A", tên Việt khác hẳn) là ra rỗng, dù phim có thật.
2. Kho đệm là **ảnh chụp** lúc quét / lúc dựng bản zip. Phim ra sau đó không có trong kho, nên
   ô gợi ý (chỉ đọc kho) không bao giờ thấy.
3. Trang tìm chỉ đọc kho đệm khi bật bộ lọc — tìm thường thì bỏ qua kho hoàn toàn.

**Cách sửa:**

| Việc | Ở đâu |
|---|---|
| Từ khoá gốc rỗng thì đoán thẳng slug (`a-love-other-than-yours`) và hỏi lại bằng biến thể lỏng hơn (bỏ dấu, bỏ mạo từ, cắt ngắn), chỉ giữ phim chứa đủ các từ có nghĩa | `lib/tu-khoa.ts`, `timKiem()` trong `lib/nguon.ts` |
| Kho tìm theo **từng từ** trên tên Việt + tên gốc + slug; phim khớp nguyên cụm vẫn đứng đầu | `locKho()` trong `lib/kho-nguon.ts` |
| Trang tìm luôn hiện thêm khối **Trong kho đệm** (phim nguồn không trả về) | `app/tim-kiem/page.tsx` |
| **Tự cập nhật phim mới**: đọc `phim-moi-cap-nhat` của mọi nguồn đang bật, ghi vào kho, gặp trang toàn phim đã biết thì dừng. Bộ hẹn giờ trong máy chủ chạy 1 phút sau khi khởi động rồi 30 phút một lần, **kể cả khi không ai mở app**; mở trang chủ / trang tìm cũng kích hoạt. Máy tắt quá 3 ngày thì lần sau tự đi sâu hơn để khỏi hụt phim. Bật/tắt và bấm chạy tay ở **Quản trị → Kho đệm** | `lib/cap-nhat-moi.ts`, `instrumentation.ts` |
| Phim tìm được qua nguồn được ghi luôn vào kho, lần sau ô gợi ý cũng ra | `ghiVaoKho()` trong `lib/nguon.ts` |

Cột `cap_nhat` của kho giờ là **giờ nguồn cập nhật** (`modified.time`), không phải giờ ghi —
sắp "mới nhất" trong kho đúng là phim mới lên tập.

### Ba cái bẫy mới

21. **Đừng ghi kho đệm trong `danhSach()`/`duyet()`.** Trang chủ gọi chúng lúc prerender, mà
    `next build` chạy song song nhiều tiến trình → "database is locked". Chỉ trang tìm (luôn
    động) và vòng cập nhật nền mới ghi.
22. **Phim 18+ phải bị loại TRƯỚC khi đếm "phim mới".** `luuPhimVaoKho()` không bao giờ ghi
    chúng, nên để lại thì lần nào chúng cũng là "mới" và vòng cập nhật không bao giờ dừng sớm.
23. **Bộ hẹn giờ trong `instrumentation.ts` phải bỏ qua lúc `next build`** (`NEXT_PHASE`) và
    phải `unref()`. Không bỏ qua thì 15 tiến trình build cùng hẹn giờ ghi SQLite; không
    `unref()` thì tiến trình nào nạp phải module (bộ kiểm, script) sẽ treo không thoát.

## Tăng âm và "Rõ lời thoại" (18/10)

**Triệu chứng:** bật tăng âm, kéo quá 100% mà nghe không khác mấy.

**Không phải lỗi nối đồ thị** — đo bằng máy đo gắn vào trang `/xem` thật trong Chromium, tiếng
có đi qua GainNode. Lý do nằm ở bản chất tín hiệu: phim có đỉnh sát 0 dBFS, mà số không vượt
được 0 dBFS. Nhân lên thì phần to bị bộ giới hạn đè lại, chỉ phần nhỏ to thêm; tai người phải
+10 dB mới nghe "to gấp đôi".

**Cách sửa:** thêm công tắc **Rõ lời thoại** trong bảng Cài đặt của trình phát — cắt siêu trầm
(90 Hz) → nhấn dải lời nói (2,5 kHz, +4 dB) → nén dải động → rồi mới nhân và chặn đỉnh. Dùng
được cả khi không bật tăng âm.

Đo trên phim thử (thoại -26 dBFS xen tiếng nổ -1 dBFS), mức lời thoại so với 100% gốc:

| Mức | Tăng âm thường | + Rõ lời thoại | Đỉnh ra loa (có Rõ lời thoại) |
|---|---|---|---|
| 100% | 0 dB | **+10,2 dB** | -3,9 dBFS |
| 200% | +5,9 dB | **+16,2 dB** | -0,7 dBFS |
| 300% | +9,5 dB | **+19,7 dB** | -0,1 dBFS |

Đổi thêm: hạ `1/BU_CHAN` **sau** bộ giới hạn thay vì chia trước — cùng tỉ lệ (180% ra 1,76 lần)
nhưng đỉnh ra loa thấp hơn ~1 dB.

## Tự đổi máy chủ + lọc 18+ hai mức (18/10)

### Tự đổi máy chủ khi lỗi

Máy chủ đang phát lỗi thì đếm ngược 4 giây rồi sang máy chủ kế tiếp **chưa thử**, có nút
Đổi ngay / Huỷ, và phát tiếp đúng giây đang xem (`?tu=`). Máy chủ đã lỗi nhớ theo **phim + số
tập** trong `sessionStorage`: thử mỗi máy chủ đúng một lần rồi dừng, báo "Đã thử cả N máy chủ".

Ba lỗi tìm ra khi thử bằng nguồn giả (mọi máy chủ trả 404):
- **Có từ trước:** playlist 404 thì hls.js gọi `startLoad()` — lệnh này không tải lại playlist,
  nên trình phát **xoay vòng tải mãi**, không bao giờ hiện lỗi hay nút đổi máy chủ. Giờ 4xx là
  báo lỗi ngay (máy chủ không có tập này, thử lại vô ích); lỗi playlist khác thì `loadSource()` lại.
- **Có từ trước:** đổi máy chủ mà slug tập khác nhau (vsmov `tap-1`, KKPhim `tap-01`) là bị đá
  về **tập 1**. Trang xem giờ tìm đúng tập ở từng máy chủ theo slug → tên → số tập, máy chủ
  không có tập đó thì không đưa vào danh sách đổi.
- Khoá nhớ máy chủ lỗi lúc đầu dùng slug tập → mỗi máy chủ một khoá → **vòng A → B → A**.
  Giờ dùng số tập chung (`maTapChung`).

### Lọc 18+ hai mức

| Mức | Dành cho | Hiển thị |
|---|---|---|
| **Chặn** | phim toàn bộ thiên về tình dục | ẩn khỏi mọi nơi, trang chi tiết không tìm thấy |
| **Gắn mác 18+** | phim có cảnh nóng / kinh dị / bạo lực, phim tài liệu về ngành phim người lớn | mác đỏ trên thẻ và trang chi tiết; trang xem hiện **bảng cảnh báo**, đồng ý mới dựng trình phát (nhớ theo phim) |

- Lưới tên tách hai mức ở `lib/ten-18.ts`. Đo trên kho 18.719 phim: **0 phim kinh dị** bị
  bắt; lưới cũ chặn oan phim tài liệu/nghệ thuật (giờ chỉ gắn mác) và **để lọt 7 phim AV**
  có mã kiểu `SONE-852` ở đầu tên gốc (giờ chặn). Kết quả: 9 chặn, 18 gắn mác.
- Thể loại `phim-18` của KKPhim lẫn phim đàng hoàng (Kiều, Sa Mạc Namibia, Tra Tấn...). Khi
  quét, app xem từng phim (`mucTheoTheLoai`): tên là mã AV / "phim sex"... thì **ẩn** dù gắn
  thể loại gì; còn là kinh dị / hình sự / hành động / tài liệu... thì **gắn mác**; phim chiếu
  rạp phổ biến (từ 300 phiếu TMDB, như Sắc, Giới) thì **gắn mác**; còn lại **ẩn**.

### Quét và duyệt 18+ (19/10)

- **Quét chạy nền** (`lib/quet-18.ts`): ~20 trang danh sách + một lượt gọi chi tiết mỗi phim,
  mất vài phút; Quản trị hỏi tiến độ mỗi 2 giây, đóng tab cũng không mất. Bấm lần nữa khi đang
  quét thì không chạy chồng.
- **Tự quét mỗi ngày** (bật/tắt trong tab), lần đầu 5 phút sau khi máy chủ lên. Lượt tự quét
  chỉ gọi chi tiết cho phim **chưa phân loại**; lỗi mạng thì 3 giờ sau thử lại.
  **Quét lại toàn bộ** xét lại mọi phim (dùng sau khi đổi luật phân loại).
- **Quản trị → Duyệt 18+**: phim tự phát hiện vào mục **Chờ duyệt** kèm đề xuất (huy hiệu số
  trên tab). Mỗi phim có ảnh, năm, nước, thể loại, lý do; nút **Đồng ý**, **Ẩn**, **Hiện + mác
  18+**, **Hiện, bỏ mác**, **Đưa về chờ duyệt**. Chọn nhiều phim để duyệt một lượt. Ảnh phim
  đang bị ẩn được **làm mờ**, bấm vào mới xem rõ.
- Quyết định đã duyệt nằm ở cột `muc_tay`, luôn thắng và không bị lần quét sau ghi đè.
  "Chờ duyệt" = `muc_tay` rỗng và mức tự động không phải "cho phép".
- Thẻ phim gắn mác: chữ **18+** đỏ viền trắng ở góc trái trên, đo được chiếm ~1,5% diện tích
  ảnh — lướt nhanh vẫn thấy mà không che ảnh.

## Giao diện laptop theo inch màn hình (19/10)

**Quản trị → Màn hình**: chọn cỡ màn hình (13,3" / 14" / 15,6" / 16" / 17,3" hoặc tự nhập)
và tinh chỉnh 80–130%. App lấy inch + số CSS px của màn (đã tính mức phóng của Windows) ra mật
độ điểm ảnh, so với mốc 110 px/inch (chữ 16px cao ~3,7 mm, vừa mắt ở ~50 cm) rồi phóng cỡ chữ
gốc của `<html>` — mọi rem giãn theo, bố cục giữ nguyên. Lưu ở localStorage **của từng trình
duyệt** (TV Box không ăn theo laptop), áp dụng trước khi vẽ như chế độ PC/TV (`lib/man-hinh.ts`).

| Laptop 14" | Chưa đặt | Đặt 14" |
|---|---|---|
| 1920×1080, Windows 100% | chữ cao 2,6 mm | **3,7 mm** (phóng 143%) |
| 1920×1080, Windows 150% | 3,9 mm | 3,7 mm (95%) |

Màn ≤ 14" còn thu banner về 46vh để thấy được hàng phim đầu.

**Lỗi có từ trước, sửa luôn:** ở bề rộng 1280–1536px (đúng cỡ laptop 14") đầu trang **tràn
mất** ô tìm, nút PC/TV và Quản trị; "Bộ sưu tập", "Tải về" bị giấu mà không còn lối vào nào.
Đầu trang giờ co giãn bằng **container query theo rem** (`@container` + `@min-[..rem]`) thay vì
điểm ngắt màn hình — điểm ngắt màn hình luôn tính theo 16px nên không biết giao diện đang phóng.
Chật thì nút phụ còn biểu tượng, menu giữ 5 mục chính; ba mục bị giấu có lối tắt trong menu
Duyệt. Đo 16 tổ hợp (1024–1920px, có/không phóng, chế độ TV): không chỗ nào tràn hay đè.

## Tua thẳng tới after credit (19/10)

Đánh dấu tay một lần, giống mốc intro — không nguồn nào cho mốc after credit (TMDB chỉ có từ
khoá "aftercreditsstinger": biết CÓ, không biết Ở ĐÂU), còn tự dò chữ chạy thì tốn hàng phút
CPU mỗi phim. Khác intro ở chỗ **lưu theo từng tập** (`slug:tập`, bảng `moc_credit`).

| Phím | Việc |
|---|---|
| `A` | Đánh dấu đầu một cảnh after credit (nhiều cảnh thì bấm ở từng cảnh) |
| `E` | Đánh dấu chỗ chạy chữ bắt đầu — không bắt buộc |
| `S` | Lúc đang chạy chữ: tua tới cảnh after credit kế tiếp (ngoài lúc đó vẫn là bỏ qua intro) |

Nút **"Tới after credit 1"** hiện từ lúc chạy chữ (thiếu mốc đó thì 8 phút trước cảnh 1); xem
cảnh 1 được 60 giây mới hiện **"Tới after credit 2"**, cứ thế tiếp. Nút tập kế nhường chỗ khi
còn cảnh after credit phía trước. Thanh tua có vạch ở mỗi cảnh. Trên TV: Cài đặt → After
credit có đủ nút đánh dấu / tới / xoá. Logic thuần ở `lib/after-credit.ts` (bộ kiểm nạp thẳng).

## Tự đổi máy chủ khi phát chậm (19/10)

Dùng chung cơ chế với tự đổi khi lỗi, thêm phần **phát hiện chậm** (`lib/do-cham.ts`, thuần):

| Kiểu chậm | Ngưỡng |
|---|---|
| Chờ tải liền một lèo trong lúc đang xem | 12 giây |
| Chờ ngay sau khi tua / lúc mới mở (tua tới chỗ chưa tải thì chờ là bình thường) | 20 giây |
| Giật lắt nhắt trong 2 phút (không tính lần chờ do tua) | ≥ 3 lần, cộng ≥ 20 giây |

Chậm thì hiện **dải báo góc trái, không che phim** (video có thể vẫn chạy): "Máy chủ này đang chậm
(lý do). Tự đổi sang … sau 6 giây" kèm **Đổi ngay** / **Ở lại**. Ở lại thì thôi hỏi cho tập đó.
Đổi thì phát tiếp đúng giây đang xem. Đã thử hết máy chủ thì chỉ báo một lần "có thể mạng đang chậm".
Chỉ chạy khi có từ 2 máy chủ trở lên.

Danh sách máy chủ đã thử giờ **tự hết hạn sau 15 phút** thay cho "phát được thì xoá": máy chủ chậm
vẫn phát được, xoá khi phát được thì A chậm → B, quên A, B cũng chậm → về A, vòng mãi.

Thử bằng luồng HLS thật (VP9/Opus fMP4 qua `/api/tep`), máy chủ 1 cố ý chờ 15 giây mỗi đoạn:
phát hiện sau 12 giây chờ, tự sang máy chủ 2 đúng tập, phát tiếp từ đúng giây; "Ở lại" thì đứng yên.

## Mốc tự động cho anime từ AniSkip (19/10)

Web anime có nút "Bỏ qua intro / outro" là nhờ **AniSkip** — cơ sở dữ liệu cộng đồng, mốc
opening (op) và ending (ed) cho từng tập, khoá theo mã MyAnimeList. App dùng nó cho phim là
**anime** (thể loại Hoạt hình + quốc gia Nhật Bản):

    tên gốc ──Jikan (api.jikan.moe)──▶ mã MAL ──AniSkip (api.aniskip.com)──▶ mốc op/ed của tập

| AniSkip có | Trình phát hiện |
|---|---|
| opening | nút **Bỏ qua intro** (thay cho mốc intro tay nếu chưa đánh dấu) |
| ending, sau đó tập còn chạy tiếp | nút **Tới after credit** — phần sau ending chính là cảnh sau credit |
| ending chạy tới hết tập | nút **Bỏ qua ending** sang tập kế (tập cuối thì không có) |

- **Mốc đánh dấu tay luôn thắng** mốc AniSkip.
- **Chỉ nhận anime khớp CHẮC**: một tên trên MAL trùng hẳn tên gốc / tên Việt sau chuẩn hoá;
  nhiều bản trùng tên thì tách bằng năm và kiểu (TV / Movie), vẫn hoà thì bỏ — tua sai chỗ giữa
  tập còn tệ hơn không có nút. Anime đặt tên gốc lạ thì sẽ không có nút tự động.
- Lưu đệm trong SQLite (`anime_mal`, `aniskip_dem`): mã MAL 30 ngày (không chắc thì 3 ngày dò
  lại), mốc tập 7 ngày (chưa có thì 1 ngày hỏi lại). Mọi lệnh gọi có hạn chờ 6 giây.
- Logic thuần ở `lib/aniskip-khop.ts` (bộ kiểm nạp thẳng), gọi mạng ở `lib/aniskip.ts`.

**Chưa thử với AniSkip / Jikan THẬT**: máy dựng bị chặn mạng tới hai dịch vụ này. Định dạng
dữ liệu viết theo cách các công cụ cộng đồng đang gọi, phần đọc dữ liệu chấp nhận cả kiểu v1
lẫn v2. Nếu anime quen thuộc mà không hiện nút, kiểm `/api/aniskip?slug=<slug>&tap=1`.
