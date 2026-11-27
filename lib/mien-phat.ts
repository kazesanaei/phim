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

/**
 * Máy chủ nguồn trả TRANG WEB thay cho playlist / mảnh video thì đọc xem vì sao.
 *
 * Đo 27/11/2026: a.kvp726.com (máy chủ mới của KKPhim) chặn IP nước ngoài bằng một trang 404
 * "Vui lòng sử dụng mạng trong nước để truy cập trang này" kèm dòng "DEBUG: IP <ip> country <mã>
 * name:<tên nước>". Laptop công ty đi mạng qua VPN / proxy đặt ở nước ngoài là dính đúng chỗ này,
 * trong khi trình phát chỉ thấy "404" và báo chung chung — không ai đoán ra được.
 */
/** Trang chặn ghi tên nước bằng chữ Hán — dịch mấy nước hay gặp với VPN / proxy công ty. */
const TEN_NUOC: Record<string, string> = {
  美国: 'Mỹ', 新加坡: 'Singapore', 日本: 'Nhật Bản', 香港: 'Hồng Kông', 中国: 'Trung Quốc', 韩国: 'Hàn Quốc',
  台湾: 'Đài Loan', 越南: 'Việt Nam', 德国: 'Đức', 英国: 'Anh', 法国: 'Pháp', 荷兰: 'Hà Lan', 澳大利亚: 'Úc',
  印度: 'Ấn Độ', 泰国: 'Thái Lan', 马来西亚: 'Malaysia', 加拿大: 'Canada', 爱尔兰: 'Ireland',
}

export function docTrangLoiNguon(html: string): { chanNuocNgoai: boolean; ip: string | null; nuoc: string | null } {
  const chu = html.slice(0, 8000)
  const chanNuocNgoai = /mạng trong nước|mang trong nuoc|domestic network/i.test(chu)
  const ip = chu.match(/\bIP[:\s]+([0-9a-f.:]{7,45})/i)?.[1] ?? null
  const tho = chu.match(/name:\s*([^<\n]+?)\s*</i)?.[1]?.trim() || null
  const nuoc = tho ? (TEN_NUOC[tho] ?? tho) : null
  return { chanNuocNgoai, ip, nuoc }
}

/**
 * Lỗi mạng khi máy chủ app gọi tới nguồn → câu tiếng Việt nói rõ chuyện gì. Mạng công ty hay
 * chặn theo kiểu riêng: bộ lọc web cắt kết nối, DNS nội bộ không trả tên miền, hoặc soi HTTPS
 * (thay chứng chỉ) mà Node không tin — trình duyệt vẫn vào web được nhưng app thì không.
 */
export function giaiThichLoiMang(e: unknown, host: string): string {
  const goc = (e as { cause?: { code?: string; message?: string } })?.cause
  const ma = goc?.code || (e as { code?: string })?.code || ''
  const ten = (e as { name?: string })?.name || ''
  if (ten === 'TimeoutError' || ten === 'AbortError' || ma === 'UND_ERR_CONNECT_TIMEOUT' || ma === 'ETIMEDOUT')
    return `Máy chủ ${host} không trả lời (hết giờ chờ). Mạng chặn hoặc máy chủ đang chết.`
  if (ma === 'ENOTFOUND' || ma === 'EAI_AGAIN')
    return `Không tra được địa chỉ của ${host} (${ma}). Mạng công ty có thể đang chặn tên miền này.`
  if (ma === 'ECONNRESET' || ma === 'ECONNREFUSED' || ma === 'UND_ERR_SOCKET')
    return `Kết nối tới ${host} bị cắt ngang (${ma}). Thường là bộ lọc web / tường lửa của mạng đang chặn.`
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(ma))
    return `Chứng chỉ HTTPS của ${host} bị thay (${ma}). Mạng công ty đang soi HTTPS, app không tin chứng chỉ đó.`
  return `Không kết nối được tới ${host}${ma ? ' (' + ma + ')' : ''}.`
}
