/**
 * Phần THUẦN của việc "học" tên miền phát: xét một tên miền có đủ tư cách để
 * proxy tới không, và lấy các tên miền mà một playlist HLS trỏ tới. Không phụ
 * thuộc gì để bộ kiểm nạp thẳng được (bẫy #12 trong README). Phần lưu trữ và
 * kiểm khi proxy ở lib/an-toan.ts.
 *
 * VÌ SAO PHẢI HỌC: KKPhim đổi máy chủ phát liên tục — kkphimplayer6.com,
 * v7.kkphimplayer7.com, rồi tháng 11/2026 chuyển gần hết phim mới sang
 * a.kvp726.com (đo 27/11: 11/13 phim mới cập nhật). Danh sách cố định thì mỗi
 * lần đổi là /api/tep trả 403 và trình phát báo "Máy chủ này không phát được
 * tập này" cho tới khi có người sửa mã.
 */

/** Đuôi tên miền nội bộ — nguồn trỏ tới đây thì chỉ có thể là dữ liệu bẩn hoặc độc. */
const DUOI_NOI_BO = ['localhost', 'local', 'lan', 'home', 'internal', 'intranet', 'corp', 'arpa', 'test', 'invalid']

/**
 * Tên miền công khai dạng thường: chữ thường, có ít nhất một dấu chấm, đuôi là
 * CHỮ (nên địa chỉ IP như 192.168.1.1 hay 127.0.0.1 không lọt), không phải
 * tên nội bộ. Đây là chốt chặn để nguồn bị chiếm cũng không biến proxy thành
 * công cụ dò mạng nội bộ.
 */
export function laMienCongKhai(host: string): boolean {
  const h = (host || '').toLowerCase()
  if (h.length > 253) return false
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)) return false
  const duoi = h.slice(h.lastIndexOf('.') + 1)
  return !DUOI_NOI_BO.includes(duoi)
}

/** Tên miền của một URL tuyệt đối http/https, hoặc null. */
export function mienCuaUrl(raw: string, goc?: URL): string | null {
  try {
    const u = new URL(raw, goc)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Các tên miền KHÁC tên miền gốc mà playlist trỏ tới: dòng URL trần (mảnh
 * video, playlist con) và URI="..." trong #EXT-X-KEY / #EXT-X-MAP / #EXT-X-MEDIA.
 */
export function mienTrongPlaylist(noiDung: string, goc: URL): string[] {
  const ra = new Set<string>()
  const them = (v: string) => {
    const h = mienCuaUrl(v, goc)
    if (h && h !== goc.hostname.toLowerCase()) ra.add(h)
  }
  for (const dong of noiDung.split(/\r?\n/)) {
    const t = dong.trim()
    if (!t) continue
    if (t.startsWith('#')) for (const m of t.matchAll(/URI="([^"]+)"/g)) them(m[1])
    else them(t)
  }
  return [...ra]
}
