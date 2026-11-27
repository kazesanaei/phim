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
 *
 * Phần ghi nhớ (lưu SQLite, khởi động lại vẫn nhớ) ở lib/an-toan.ts; phần đọc tên miền trong URL
 * và playlist ở lib/mien-phat.ts.
 */

/** Đuôi tên mạng nội bộ — nguồn trỏ tới đây thì chỉ có thể là dữ liệu bẩn hoặc độc. */
const DUOI_NOI_BO = ['localhost', 'localdomain', 'local', 'lan', 'home', 'internal', 'intranet', 'corp', 'arpa', 'test', 'invalid']

/**
 * Tên máy chủ có đủ điều kiện để học không: tên miền công khai thật, không IP, không nội mạng.
 * Mỗi nhãn là chữ/số/gạch nối, không bắt đầu hay kết thúc bằng gạch nối; có ít nhất một dấu
 * chấm (loại tên trần như "router" và IPv6 có ':'); nhãn cuối là CHỮ (loại IPv4 như 1.2.3.4).
 */
export function laMienCongKhai(host: string): boolean {
  const h = (host || '').toLowerCase()
  if (h.length > 253) return false
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)) return false
  return !DUOI_NOI_BO.includes(h.slice(h.lastIndexOf('.') + 1))
}
