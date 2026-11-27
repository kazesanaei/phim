import fs from 'node:fs'
import path from 'node:path'
import { db, thuMucNguon } from './db'
import { laMienCongKhai } from './mien-hoc'
import { mienCuaUrl } from './mien-phat'

/** Lỗi do đầu vào bị chặn — route bắt lỗi này và trả 403. */
export class LoiChan extends Error {}

const MIEN_CHO_PHEP = ['vsmov.com', 'streamvsmov.com', 'phimapi.com', 'kkphim.com']

/**
 * Host phát của KKPhim đánh số và đổi theo thời gian: kkphimplayer6.com,
 * v7.kkphimplayer7.com... Đây là những TÊN MIỀN KHÁC NHAU chứ không phải
 * subdomain, nên allowlist theo hậu tố không bắt được — cần mẫu riêng.
 * Mẫu cố ý chặt: bắt buộc đúng "kkphimplayer<số>.com", không nhận gì khác.
 */
const MAU_MIEN = [/^(?:[a-z0-9-]+\.)?kkphimplayer\d{1,2}\.com$/, /^(?:[a-z0-9-]+\.)?kvp\d{2,4}\.com$/]

/**
 * Tên miền phát HỌC ĐƯỢC từ chính API nguồn (xem lib/mien-hoc.ts vì sao cần).
 *
 * Tin những gì nguồn chỉ tới cũng là mức tin app vốn có: app đã phát mọi thứ
 * nguồn đưa. Cái KHÔNG tin là tham số `u` người gọi /api/tep gửi lên — nên chỉ
 * học ở phía máy chủ, từ dữ liệu nguồn (link_m3u8, link_embed) và từ playlist
 * tải về từ một tên miền đã được phép; không bao giờ học từ request.
 *
 * Lưu trong SQLite (bảng mien_phat) để khởi động lại vẫn nhớ. Bộ nhớ đệm đặt ở
 * globalThis, KHÔNG ở biến module: Next đóng gói mỗi route một bản module, cache
 * module-scope ở route này không thấy cái route kia vừa học (bẫy #17). Đệm chỉ
 * giữ kết quả "được phép" — thứ không bao giờ bị rút lại — nên không thể cũ.
 */
const dem = globalThis as unknown as { __mienPhat?: Set<string> }
function damBaoBang() {
  db.exec(`create table if not exists mien_phat (
    host text primary key, nguon text, hoc_luc text not null default (datetime('now')))`)
}

export function hocMienPhat(raw: string, nguon: string): void {
  const host = mienCuaUrl(raw)
  if (!host || !laMienCongKhai(host)) return
  const s = (dem.__mienPhat ??= new Set())
  if (s.has(host)) return
  try {
    damBaoBang()
    const moi = db.prepare('insert or ignore into mien_phat (host, nguon) values (?, ?)').run(host, nguon).changes
    if (moi) console.log(`[phim] học tên miền phát mới của ${nguon}: ${host}`)
    s.add(host)
  } catch {
    // ghi không được (DB đang khoá) thì lần sau học lại — đừng làm gãy việc dựng trang
  }
}

function daHoc(host: string): boolean {
  const s = (dem.__mienPhat ??= new Set())
  if (s.has(host)) return true
  try {
    damBaoBang()
    if (db.prepare('select 1 from mien_phat where host = ?').get(host)) {
      s.add(host)
      return true
    }
  } catch {
    // bảng lỗi thì coi như chưa học
  }
  return false
}

/** CDN ảnh của các nguồn. Cố ý TÁCH khỏi MIEN_CHO_PHEP: /api/tep (video, phụ
 *  đề) không có việc gì với CDN ảnh, và /api/anh không có việc gì với host phát
 *  video — nới một bên không nên nới luôn bên kia. */
const MIEN_ANH = ['vsmov.com', 'phimapi.com', 'phimimg.com', 'kkphim.com']

function phanTich(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new LoiChan('URL không hợp lệ')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new LoiChan('Chỉ nhận http/https')
  return u
}

/**
 * Chỉ cho proxy tới các miền của nguồn phim. Thiếu hàm này thì /api/tep
 * trở thành một proxy mở cho cả internet.
 */
export function urlChoPhep(raw: string): URL {
  const u = phanTich(raw)
  const host = u.hostname.toLowerCase()
  const ok =
    MIEN_CHO_PHEP.some((m) => host === m || host.endsWith('.' + m)) ||
    MAU_MIEN.some((r) => r.test(host)) ||
    // Host phát mà API nguồn tự trả về (KKPhim đổi tên miền liên tục) — xem lib/mien-hoc.ts
    (laMienCongKhai(host) && daHoc(host))
  if (!ok) throw new LoiChan('Miền không được phép: ' + host)
  return u
}

/**
 * Cửa riêng cho /api/anh. Dữ liệu nguồn thỉnh thoảng trỏ poster sang một CDN
 * lạ hoắc (báo điện tử, ảnh tự đăng...). Những ảnh đó bị chặn và hiện khung
 * chữ cái đầu — chấp nhận được, vì mở allowlist theo dữ liệu người ngoài kiểm
 * soát là biến máy chủ thành công cụ dò mạng nội bộ hộ họ.
 */
export function urlAnhChoPhep(raw: string): URL {
  const u = phanTich(raw)
  const host = u.hostname.toLowerCase()
  if (!MIEN_ANH.some((m) => host === m || host.endsWith('.' + m))) {
    throw new LoiChan('Miền ảnh không được phép: ' + host)
  }
  return u
}

function chuanHoa(p: string): string {
  let d = path.resolve(p)
  try {
    // realpath để symlink không lách được ra ngoài thư mục nguồn
    d = fs.realpathSync.native(d)
  } catch {
    // file chưa tồn tại (đang ghi) thì dùng đường đã resolve
  }
  return process.platform === 'win32' ? d.toLowerCase() : d
}

/** Đường dẫn phải nằm trong một thư mục nguồn đang bật. Chặn `..` và symlink. */
export function duongDanChoPhep(raw: string, chiBat = true): string {
  if (!raw) throw new LoiChan('Thiếu đường dẫn')
  const that = path.resolve(raw)
  const chuan = chuanHoa(that)
  const goc = thuMucNguon(chiBat).map((t) => chuanHoa(t.duong_dan))
  const ok = goc.some((g) => chuan === g || chuan.startsWith(g + path.sep))
  if (!ok) throw new LoiChan('Đường dẫn nằm ngoài thư mục nguồn đã đăng ký')
  return that
}

const GACH_ANH = String.fromCharCode(92)
const KY_TU_CAM = '<>:"/|?*' + GACH_ANH

// Tên thiết bị dành riêng của Windows — ghi file trùng tên này ghi tới thiết bị.
const TEN_DANH_RIENG = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i

/** Bỏ mọi thành phần thư mục và ký tự nguy hiểm khỏi tên file người dùng gửi lên. */
export function tenTepAnToan(ten: string): string {
  const goc = path.basename(String(ten).split(GACH_ANH).join('/'))
  let ra = ''
  for (const c of goc) {
    const m = c.charCodeAt(0)
    if (m < 32 || m === 127) continue
    ra += KY_TU_CAM.includes(c) ? '_' : c
  }
  ra = ra.replace(/^[.]+/, '_').trim().slice(0, 200)
  if (TEN_DANH_RIENG.test(ra)) ra = '_' + ra
  return ra || 'khong-ten'
}

/**
 * Chặn request đến từ một trang web khác (CSRF). App nghe ở 127.0.0.1 và không
 * có đăng nhập, nên một tab độc người dùng mở có thể gọi thẳng /api/* của app.
 * `Sec-Fetch-Site` do trình duyệt gắn, JS trang không giả được — đây là lá chắn
 * chính. Cho qua: same-origin, same-site, và 'none' (gõ URL / thẻ <video> cùng
 * trang đôi khi không kèm Origin).
 */
export function chanCheoTrang(req: Request) {
  const site = req.headers.get('sec-fetch-site')
  if (site) {
    if (site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
      throw new LoiChan('Chặn request từ trang khác')
    }
    return
  }
  /**
   * Lối lui CHỈ cho trình duyệt cũ không gửi Sec-Fetch-Site: đối chiếu Origin
   * với Host. Trước đây phép so này chạy cả khi đã có Sec-Fetch-Site, và nó gãy
   * khi app nằm sau một bộ chuyển tiếp (reverse proxy) đổi Host thành
   * 127.0.0.1:3000 trong khi Origin là địa chỉ trình duyệt thấy — đã tái hiện:
   * đúng mật khẩu vẫn bị 403, không đăng nhập nổi.
   *
   * Nhận thêm X-Forwarded-Host (bộ chuyển tiếp gắn vào). Trang lạ không giả được
   * nó: request chéo trang có header tự đặt sẽ phải qua preflight CORS, mà app
   * không trả lời preflight nên trình duyệt chặn trước khi gửi.
   */
  const origin = req.headers.get('origin')
  if (origin) {
    const hopLe = [req.headers.get('host'), req.headers.get('x-forwarded-host')].filter(Boolean)
    let hostGoc: string
    try {
      hostGoc = new URL(origin).host
    } catch {
      throw new LoiChan('Origin không hợp lệ')
    }
    if (hopLe.length && !hopLe.includes(hostGoc)) throw new LoiChan('Chặn request từ trang khác')
  }
}

export function traLoiLoi(e: unknown): Response {
  if (e instanceof LoiChan) {
    // Ghi ra cửa sổ máy chủ: nguồn đổi tên miền phát thì nhìn đây là biết ngay
    console.warn('[phim] chặn:', e.message)
    return Response.json({ loi: e.message }, { status: 403 })
  }
  // Không trả nguyên văn message lỗi hệ thống ra client (lộ đường dẫn nội bộ).
  // Chi tiết ghi ra log máy chủ, client chỉ thấy câu chung.
  console.error('[phim] lỗi máy chủ:', e)
  return Response.json({ loi: 'Có lỗi máy chủ' }, { status: 500 })
}
