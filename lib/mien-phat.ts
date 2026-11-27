/**
 * Đọc tên miền trong URL và trong playlist HLS — phần thuần, không phụ thuộc gì để bộ kiểm nạp
 * thẳng được (bẫy #12 trong README). Xét tên miền nào được học: lib/mien-hoc.ts. Ghi nhớ và kiểm
 * khi proxy: lib/an-toan.ts.
 *
 * VÌ SAO CẦN ĐỌC PLAYLIST: học từ `link_m3u8` mới chỉ biết máy chủ của playlist gốc. Mảnh video,
 * khoá giải mã, playlist con có thể nằm ở CDN khác — không học thì mảnh đầu tiên đã dính 403.
 */

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
