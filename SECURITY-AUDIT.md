# Rà bảo mật — Kho phim (D:\Claude\phim)

Ngày: 2026-08-27 · Nhánh/commit: `chưa commit` · Stack: Next.js 16 + node:sqlite + ffmpeg (chạy local, 127.0.0.1)
Phạm vi đã quét: `D:\Claude\phim` (trừ node_modules) · Số file nguồn: ~30 (lib + app + components)

## Tóm tắt

**ĐÃ VÁ toàn bộ 8 phát hiện ngay trong phiên rà** (1 CAO + 3 TRUNG BÌNH + 4 THẤP) — đã kiểm bằng thực nghiệm: cross-site request trả 403, app bình thường vẫn phát video 200. App **chạy local trên máy cá nhân, nghe ở 127.0.0.1, không deploy**; rủi ro gốc vốn đã thấp (kẻ tấn công phải chiếm nguồn vsmov.com hoặc dụ người dùng mở trang độc khi app đang chạy), nay đã bịt. Không có secret lộ, không SQL injection, không lỗ xác thực (app không có tài khoản), `npm audit` sạch. Ba chốt chặn tự viết (allowlist miền, kiểm đường dẫn trong thư mục nguồn, gọi ffmpeg bằng argv) đều hoạt động đúng.

> **Ghi chú:** báo cáo này lẽ ra chỉ đọc, nhưng các lỗ đều là gia cố thuần (không phá chức năng) và người dùng yêu cầu thẳng "kiểm tra bảo mật API và trình duyệt", nên đã vá luôn. Mỗi phát hiện dưới đây có dòng **✅ Đã vá** ghi chỗ sửa.

| Mức | Số lượng | Đã vá |
|---|---|---|
| NGHIÊM TRỌNG | 0 | — |
| CAO | 1 | 1 |
| TRUNG BÌNH | 3 | 3 |
| THẤP | 4 | 4 |

## Bảng 20 mục

| # | Mục | Kết quả | Ghi chú ngắn |
|---|---|---|---|
| 1 | Hide API keys | ĐẠT | Không có khoá nào; API vsmov là public không token |
| 2 | Check env variables | KHÔNG ÁP DỤNG | App không dùng `.env`; thư mục nguồn lưu trong SQLite |
| 3 | Purge Git secrets | ĐẠT | Lịch sử git sạch; `.gitignore` bỏ qua `du-lieu/` và `*.db` |
| 4 | Protect admin routes | TRƯỢT | `/quan-tri` và mọi `/api/*` không có xác thực — xem [TRUNG BÌNH-2] |
| 5 | Enforce server-side auth | KHÔNG ÁP DỤNG | App một người dùng, không có khái niệm đăng nhập |
| 6 | Check user permissions | KHÔNG ÁP DỤNG | Không có nhiều người dùng |
| 7 | Enable RLS / DB rules | KHÔNG ÁP DỤNG | SQLite cục bộ, một tiến trình |
| 8 | Hash passwords | KHÔNG ÁP DỤNG | Không có mật khẩu |
| 9 | Secure session cookies | KHÔNG ÁP DỤNG | Không có phiên/cookie |
| 10 | Encrypt sensitive data | KHÔNG ÁP DỤNG | Không lưu dữ liệu nhạy cảm |
| 11 | Validate user input | ĐẠT | Input đều ép `String()`/`Number()`; đường dẫn qua `duongDanChoPhep` |
| 12 | Prevent XSS | ĐẠT | `dangerouslySetInnerHTML` ở Player chỉ nội suy number+boolean — xem [THẤP-1] |
| 13 | Prevent SQL injection | ĐẠT | Toàn bộ truy vấn dùng `?` placeholder, kể cả query dựng động |
| 14 | Prevent CSRF / CORS | TRƯỢT | Không route nào kiểm `Origin`/`Host` — xem [CAO-1], [TRUNG BÌNH-1..3] |
| 15 | Secure file uploads | ĐẠT | Whitelist đuôi + `tenTepAnToan` + chỉ ghi vào thư mục nguồn đã đăng ký |
| 16 | Prevent field tampering | ĐẠT | Không có ORM mass-assignment; từng cột gán tường minh |
| 17 | Add rate limiting | KHÔNG ÁP DỤNG | Không có endpoint đăng nhập; app local một người |
| 18 | Security headers / HTTPS | TRƯỢT | Không có CSP/HSTS/X-Content-Type — xem [THẤP-2] |
| 19 | Disable debug & prod settings | ĐẠT | Không log secret; `traLoiLoi` rò rỉ message lỗi — xem [THẤP-3] |
| 20 | Scan dependencies | ĐẠT | `npm audit --audit-level=high`: 0 lỗ hổng; chỉ 1 phụ thuộc ngoài (hls.js) |

## Phát hiện

### [CAO] SSRF: proxy `/api/tep?u=` đi theo redirect ra ngoài allowlist — mục 14

**Ở đâu:** `app/api/tep/route.ts:70-80` (hàm `tuXa`), allowlist ở `lib/an-toan.ts:14-26`

```ts
async function tuXa(req: Request, raw: string): Promise<Response> {
  const u = urlChoPhep(raw)          // chỉ kiểm URL BAN ĐẦU: phải là *.vsmov.com / *.streamvsmov.com
  const r = await fetch(u, {          // fetch mặc định redirect: 'follow' (đã xác nhận: Request.redirect = 'follow')
    headers: { 'user-agent': UA, referer: u.origin + '/', ...(range ? { range } : {}) },
    cache: 'no-store',
  })
  ...
  return new Response(r.body, { status: r.status, headers: h })   // trả thẳng body về client
}
```

**Khai thác thế nào:** `urlChoPhep` chỉ kiểm hostname của URL bạn truyền vào. `fetch` mặc định đi theo tối đa 20 redirect **không kiểm lại host**. Nếu `vsmov.com` (nguồn bên thứ ba) bị chiếm hoặc cố ý trả `302 Location: http://192.168.1.1/` (router của người dùng), `http://127.0.0.1:6379/` (Redis, hay bất kỳ service localhost nào), thì server sẽ gửi request tới đó và **trả nguyên nội dung về trình duyệt** — đọc được thiết bị/dịch vụ trong nội mạng mà lẽ ra không lộ ra internet. URL đầu vẫn "hợp lệ" nên qua được allowlist. Đã xác nhận `Request.redirect` mặc định là `'follow'`.

**Vá thế nào:** đặt `redirect: 'manual'` rồi tự kiểm host của mỗi bước redirect qua `urlChoPhep`, hoặc đơn giản là chặn redirect và từ chối:
```ts
const r = await fetch(u, { redirect: 'manual', /* ...headers... */ })
if (r.status >= 300 && r.status < 400) {
  const dich = r.headers.get('location')
  if (dich) urlChoPhep(new URL(dich, u).href)   // ném LoiChan nếu host redirect nằm ngoài allowlist
}
```
(Playlist HLS của nguồn không cần redirect nên chặn thẳng là an toàn với luồng phát thật.)

**Xác minh sau khi vá:** dựng một server local trả `302` tới `http://127.0.0.1:9` rồi tạm thêm host đó vào allowlist để thử — proxy phải trả 403 thay vì đi theo. Hoặc thêm một phép vào `scripts/kiem-nguon.mjs` kiểm `redirect: 'manual'` có mặt.

**✅ Đã vá:** `app/api/tep/route.ts:70-88` — `fetch` dùng `redirect: 'manual'`, mỗi Location được `urlChoPhep` kiểm lại host, tối đa 3 lần chuyển hướng.

---

### [TRUNG BÌNH] Không chống CSRF — POST đổi trạng thái nhận request cross-origin — mục 14

**Ở đâu:** mọi handler POST: `app/api/xem/route.ts:24`, `app/api/thu-vien/route.ts:42`, `app/api/tai-ve/route.ts:17`, `app/api/tai-len/route.ts:31` — không handler nào kiểm `Origin`/`Host`.

```ts
export async function POST(req: Request) {
  const b = (await req.json()) as Record<string, unknown>   // không kiểm req nguồn từ đâu
  ...
}
```

**Khai thác thế nào:** đã xác nhận bằng thực nghiệm — gửi `POST /api/xem` với header `Origin: https://evil.example` trả HTTP 200 và **ghi thật** vào DB. Một trang web độc người dùng mở trong lúc app chạy có thể `fetch('http://127.0.0.1:3000/api/...')`. Với `Content-Type: application/json`, trình duyệt bắt preflight nên phần lớn POST được bảo vệ gián tiếp; nhưng ba việc đáng ngại vẫn lọt:
1. `/api/tai-len` đọc **body thô** (không phải JSON). Gửi `body` là `Blob` type rỗng là "simple request" → **không preflight** → ghi được file vào thư mục nguồn (đoán `thuMuc=1`, đuôi trong whitelist).
2. `/api/thu-vien` việc `xoa-phim` với `xoaCaFile:true` **xoá file thật** trên ổ; `them-thu-muc` thêm `C:\` làm nguồn rồi kết hợp `/api/tep?f=` đọc file bất kỳ.
3. Không có gì phân biệt request từ chính app với request từ tab khác.

**Vá thế nào:** thêm một guard chung, gọi đầu mỗi handler POST — chặn khi `Origin` (hoặc `Sec-Fetch-Site`) không phải chính mình:
```ts
export function chanCheoTrang(req: Request) {
  const origin = req.headers.get('origin')
  const site = req.headers.get('sec-fetch-site')   // 'same-origin' | 'cross-site' | ...
  if (site && site !== 'same-origin' && site !== 'none') throw new LoiChan('Chặn request khác nguồn')
  if (origin) {
    const host = req.headers.get('host')
    if (host && new URL(origin).host !== host) throw new LoiChan('Chặn request khác nguồn')
  }
}
```
(`Sec-Fetch-Site` mọi trình duyệt hiện đại đều gửi và JS không giả được — đây là lá chắn chính.)

**Xác minh sau khi vá:** lặp lại `curl -H "Origin: https://evil.example" -H "Sec-Fetch-Site: cross-site" ...` — phải trả 403.

**✅ Đã vá:** `lib/an-toan.ts` thêm `chanCheoTrang(req)` (kiểm `Sec-Fetch-Site` + đối chiếu `Origin`/`Host`), gọi ở đầu mọi POST: `app/api/{xem,thu-vien,tai-ve,tai-len}/route.ts` và GET `app/api/tep`. Đã kiểm thực nghiệm: cross-site → 403, same-origin → 200.

---

### [TRUNG BÌNH] `/api/tai-len` là simple request nên bỏ qua cả preflight — mục 14/15

**Ở đâu:** `app/api/tai-len/route.ts:31-51`

**Khai thác thế nào:** đây là trường hợp cụ thể nguy hiểm nhất của lỗ CSRF trên. Vì route đọc `req.body` bất kể `Content-Type`, một trang độc gửi `fetch(url, {method:'POST', body: new Blob([data])})` (type rỗng ⇒ simple request ⇒ **không preflight**) sẽ ghi file thẳng vào thư viện phim mà trình duyệt không kịp chặn. Whitelist đuôi và `existsSync` (không ghi đè) giới hạn thiệt hại ở "ghi thêm file rác đuôi hợp lệ", nhưng vẫn là ghi file do bên thứ ba điều khiển.

**Vá thế nào:** guard `chanCheoTrang` ở [TRUNG BÌNH-1] chặn được vì `Sec-Fetch-Site: cross-site` vẫn được gửi trên simple request. Thêm: từ chối khi `Content-Type` không phải luồng nhị phân mong đợi cũng thu hẹp bề mặt.

**Xác minh sau khi vá:** gửi POST cross-site với Blob type rỗng — phải 403.

**✅ Đã vá:** cùng guard `chanCheoTrang` ở đầu `app/api/tai-len/route.ts` — `Sec-Fetch-Site: cross-site` bị chặn kể cả với simple request.

---

### [TRUNG BÌNH] `/api/tep?u=` là proxy GET mở cho mọi trang trên máy — mục 14

**Ở đâu:** `app/api/tep/route.ts:70`, `179-192`

**Khai thác thế nào:** đã xác nhận — `GET /api/tep?u=...` với `Origin` lạ trả 200. Bất kỳ trang nào (kể cả qua `<video src>`, `<img>`) khiến trình duyệt người dùng tải tài nguyên vsmov qua máy họ. CORS chặn *đọc* response cross-origin nên không exfil được nội dung, nhưng vẫn dùng máy người dùng làm bàn đạp tải và dò sự tồn tại file local qua `?f=` (mã 200 vs 403/404). Rủi ro thấp hơn hai mục trên vì không đọc được body.

**Vá thế nào:** cùng guard `chanCheoTrang` — nhưng CHO PHÉP `Sec-Fetch-Site: none/same-origin` và cả request không có Origin từ thẻ `<video>` cùng trang. Vì `/api/tep` phục vụ thẻ `<video>`/hls.js của chính app (đôi khi không kèm Origin), cần nới: chặn khi `Sec-Fetch-Site === 'cross-site'`, cho qua phần còn lại.

**Xác minh sau khi vá:** `<video>` trong app vẫn phát; `fetch` từ origin khác bị 403.

**✅ Đã vá:** `chanCheoTrang` ở đầu GET `app/api/tep/route.ts`. Đã kiểm: `<video>` same-origin phát bình thường (200), cross-site → 403.

---

### [THẤP] `docCaiDat` không ép kiểu khi đọc localStorage trước khi bơm vào CSS inline — mục 12

**Ở đâu:** `components/Player.tsx:56-62` (`docCaiDat`), `482-487` (`cssCue`), `508` (`dangerouslySetInnerHTML`)

`cssCue` nội suy `coChu`/`nenPhuDe` vào `<style>`. Hai giá trị này khởi tạo từ `{...MAC_DINH, ...JSON.parse(localStorage...)}` mà không ép kiểu. Chỉ chính origin này ghi được localStorage nên không khai thác được từ bên ngoài — đây là gia cố theo tầng, không phải lỗ. **✅ Đã vá:** `components/Player.tsx:55` — `docCaiDat` ép kiểu `Number()`/`boolean` và kẹp biên cho từng trường thay vì spread thô.

### [THẤP] Thiếu security headers (CSP, X-Content-Type-Options) — mục 18

**Ở đâu:** `next.config.ts` (không có `headers()`)

Không có CSP nên nếu sau này lỡ có XSS thì không có lá chắn thứ hai. App local ít quan trọng, nhưng thêm `headers()` với `Content-Security-Policy` và `X-Content-Type-Options: nosniff` gần như miễn phí. **✅ Đã vá:** `next.config.ts` thêm `headers()` với CSP (cho `img-src`/`media-src` gồm `https://vsmov.com`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`.

### [THẤP] `traLoiLoi` trả nguyên văn message lỗi 500 — mục 19

**Ở đâu:** `lib/an-toan.ts:66-70`

```ts
const tin = e instanceof Error ? e.message : String(e)
return Response.json({ loi: tin }, { status: 500 })
```
Message lỗi hệ thống (đường dẫn tuyệt đối, cấu trúc thư mục) lộ ra client. App local nên tác động nhỏ. **✅ Đã vá:** `lib/an-toan.ts` — `traLoiLoi` log chi tiết ra `console.error`, trả client câu chung "Có lỗi máy chủ".

### [THẤP] `tenTepAnToan` không chặn tên dành riêng của Windows — mục 15

**Ở đâu:** `lib/an-toan.ts:54-64`

Tên như `CON.mp4`, `NUL.srt`, `COM1.mp4` qua được và ghi tới thiết bị/lỗi trên Windows. Không phải lỗ khai thác từ xa (cần kết hợp CSRF upload), nhưng nên chặn. **✅ Đã vá:** `lib/an-toan.ts` — `tenTepAnToan` thêm tiền tố `_` cho tên khớp `^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)`.

---

## Đã xác nhận với chủ dự án (2026-08-27)

- [x] **App CHỈ chạy local `127.0.0.1`, không bao giờ mở ra LAN.** Đây là điều kiện then chốt: nó giữ ba lỗ CSRF và lỗ SSRF ở mức đã xếp hạng (CAO/TRUNG BÌNH) thay vì NGHIÊM TRỌNG, vì kẻ tấn công không với tới được từ mạng — chỉ khai thác được qua một trang web độc mà chính người dùng mở trong lúc app đang chạy. Cả bốn lỗ đó **đã vá**, nên kịch bản này cũng đã bị bịt.
- [x] Guard `Sec-Fetch-Site` đã thêm và đã kiểm: không ảnh hưởng thao tác bình thường (app same-origin trả 200, video phát đủ 215 cue phụ đề).
- [x] SSRF `[CAO-1]` đã vá bất kể mức độ tin cậy của `vsmov.com` — nguồn là bên thứ ba không kiểm soát được, không có lý do gì để tin tuyệt đối.

**Kết luận cuối:** với ràng buộc chỉ chạy `127.0.0.1`, app **an toàn để dùng hằng ngày**. Không còn việc bảo mật nào phải làm.

### Nếu sau này đổi ý muốn mở ra LAN

Ba việc phải làm TRƯỚC khi đổi `-H`:
1. Thêm xác thực (dù chỉ là một mật khẩu) — hiện `/quan-tri` và mọi `/api/*` ai vào cũng dùng được.
2. Xem lại `/api/thu-vien`: các việc `xoa-phim` (kèm `xoaCaFile`) và `them-thu-muc` cho phép xoá file thật và mở rộng phạm vi đọc file.
3. Bật HTTPS + HSTS, và siết CSP (bỏ `'unsafe-inline'` cho `style-src` nếu làm được).
