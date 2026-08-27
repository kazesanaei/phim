import fs from 'node:fs'
import path from 'node:path'
import { thuMucNguon } from './db'

/** Lỗi do đầu vào bị chặn — route bắt lỗi này và trả 403. */
export class LoiChan extends Error {}

const MIEN_CHO_PHEP = ['vsmov.com', 'streamvsmov.com', 'phimapi.com', 'kkphim.com']

/**
 * Host phát của KKPhim đánh số và đổi theo thời gian: kkphimplayer6.com,
 * v7.kkphimplayer7.com... Đây là những TÊN MIỀN KHÁC NHAU chứ không phải
 * subdomain, nên allowlist theo hậu tố không bắt được — cần mẫu riêng.
 * Mẫu cố ý chặt: bắt buộc đúng "kkphimplayer<số>.com", không nhận gì khác.
 */
const MAU_MIEN = [/^(?:[a-z0-9-]+\.)?kkphimplayer\d{1,2}\.com$/]

/**
 * Chỉ cho proxy tới các miền của nguồn phim. Thiếu hàm này thì /api/tep
 * trở thành một proxy mở cho cả internet.
 */
export function urlChoPhep(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new LoiChan('URL không hợp lệ')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new LoiChan('Chỉ nhận http/https')
  const host = u.hostname.toLowerCase()
  const ok =
    MIEN_CHO_PHEP.some((m) => host === m || host.endsWith('.' + m)) || MAU_MIEN.some((r) => r.test(host))
  if (!ok) throw new LoiChan('Miền không được phép: ' + host)
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
  if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
    throw new LoiChan('Chặn request từ trang khác')
  }
  // Lối lui cho trình duyệt cũ không gửi Sec-Fetch-Site: đối chiếu Origin với Host.
  const origin = req.headers.get('origin')
  if (origin) {
    const host = req.headers.get('host')
    try {
      if (host && new URL(origin).host !== host) throw new LoiChan('Chặn request từ trang khác')
    } catch {
      throw new LoiChan('Origin không hợp lệ')
    }
  }
}

export function traLoiLoi(e: unknown): Response {
  if (e instanceof LoiChan) return Response.json({ loi: e.message }, { status: 403 })
  // Không trả nguyên văn message lỗi hệ thống ra client (lộ đường dẫn nội bộ).
  // Chi tiết ghi ra log máy chủ, client chỉ thấy câu chung.
  console.error('[phim] lỗi máy chủ:', e)
  return Response.json({ loi: 'Có lỗi máy chủ' }, { status: 500 })
}
