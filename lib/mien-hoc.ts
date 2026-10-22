/**
 * Máy chủ phát "học được" từ API của nguồn — phần thuần, không đụng DB, để bộ kiểm gọi thẳng.
 *
 * VÌ SAO: KKPhim đổi tên miền phát liên tục. Allowlist cũ theo mẫu `kkphimplayer<số>.com`; đo
 * 22/10/2026 thì 20/20 phim mới đã chuyển sang `*.kvp726.com` / `*.phim1280.tv` — mọi phim chỉ có
 * trên KKPhim bị proxy trả 403, không phát được. Đuổi theo từng tên miền là lần sau lại hỏng.
 *
 * Thay vào đó: tin đúng host mà API nguồn (phimapi.com, qua https — đã nằm trong allowlist) trả về
 * trong `link_m3u8`. Proxy vẫn KHÔNG thành proxy mở: host phải do chính nguồn đưa ra, và không bao
 * giờ là IP, localhost hay tên mạng nội bộ — kẻo dữ liệu nguồn bị đầu độc thì máy chủ phim thành
 * công cụ dò router / máy khác trong nhà.
 */
const g = globalThis as unknown as { __mienHoc?: Set<string> }
const MIEN_HOC: Set<string> = (g.__mienHoc ??= new Set())

/** Tên máy chủ có đủ điều kiện để học không: tên miền công khai thật, không IP, không nội mạng. */
export function laMienCongKhai(host: string): boolean {
  const h = host.toLowerCase()
  // chỉ chữ/số/gạch nối, có ít nhất một dấu chấm — loại luôn IPv6 (có ':') và tên trần như "router"
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return false
  if (/^\d+(\.\d+){3}$/.test(h)) return false // IPv4
  if (/\.(local|lan|home|internal|localhost|localdomain|arpa)$/.test(h) || h === 'localhost') return false
  // nhãn cuối (TLD) phải là chữ: "192.168.1.1.nip" thì được nhưng "1.2.3.4" đã loại ở trên
  return /[a-z]/.test(h.slice(h.lastIndexOf('.') + 1))
}

/** Ghi nhận host trong một URL phát do API nguồn trả về. Bỏ qua lặng lẽ nếu không đủ điều kiện. */
export function hocMienPhat(raw: string) {
  try {
    const u = new URL(raw)
    if ((u.protocol === 'https:' || u.protocol === 'http:') && laMienCongKhai(u.hostname)) MIEN_HOC.add(u.hostname.toLowerCase())
  } catch {
    // URL hỏng thì thôi
  }
}

export function daHocMien(host: string): boolean {
  return MIEN_HOC.has(host.toLowerCase())
}
