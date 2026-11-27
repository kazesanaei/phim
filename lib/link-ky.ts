/**
 * Link playlist CÓ CHỮ KÝ trong trang nhúng của vsmov — phần thuần, không phụ thuộc gì để bộ
 * kiểm nạp thẳng được (bẫy #12 trong README).
 *
 * VÌ SAO (27/11/2026): máy chủ v1.streamvsmov.com bắt đầu đòi `?expires=…&signature=…` cho
 * `/stream/<mã>/master.m3u8`. Link tự ghép kiểu cũ nhận về 403 {"error":"Thiếu signature"} nên
 * trình phát báo "Máy chủ này không phát được tập này". Trang nhúng có sẵn link đúng ở biến
 * `signedMasterUrl` (hạn khoảng 1 giờ — mỗi lần bấm xem app lấy link mới nên không sao).
 * Các máy chủ vsmov khác vẫn chưa đòi chữ ký và trang nhúng của chúng không có biến này.
 *
 * Kiểm chặt trước khi tin: cùng máy chủ với trang nhúng, đúng đường dẫn `/stream/<mã>/master.m3u8`
 * của chính tập đó. Sai một chút là bỏ, quay về link tự ghép.
 */
export function linkKyTrongEmbed(html: string, embed: URL, hash: string): string | null {
  const m = /signedMasterUrl\s*[:=]\s*(["'])(.{1,2000}?)\1/.exec(html)
  if (!m) return null
  let u: URL
  try {
    u = new URL(m[2].replace(/\\\//g, '/').replace(/&amp;/g, '&'))
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.host !== embed.host) return null
  if (u.pathname !== '/stream/' + hash + '/master.m3u8') return null
  return u.href
}
