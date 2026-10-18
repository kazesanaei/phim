/**
 * Xử lý từ khoá tìm phim. Cố ý KHÔNG phụ thuộc gì để bộ kiểm nạp thẳng được
 * bằng Node (xem bẫy #12 trong README) — kể cả lib/khong-dau.ts, vì import
 * không đuôi `.ts` thì Node không nạp được, có đuôi thì tsc không chịu.
 *
 * VÌ SAO CẦN: endpoint `/tim-kiem` của nguồn khớp NGUYÊN CỤM từ khoá. Gõ đúng
 * tên tiếng Anh dài như "A Love Other Than Yours" mà nguồn lưu hơi khác (thiếu
 * mạo từ "A", tên Việt khác hẳn, origin_name là tiếng Hàn...) là ra rỗng, dù
 * phim có thật trên nguồn. Tệp này dựng các biến thể lỏng hơn để hỏi lại, rồi
 * lọc kết quả bằng các từ có nghĩa để không trả về phim chẳng liên quan.
 */
// Cùng cách bỏ dấu với lib/khong-dau.ts — chép lại vì lý do ở đầu tệp.
const DAU_TO_HOP = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g')

function khongDau(s: string): string {
  return (s || '').normalize('NFD').replace(DAU_TO_HOP, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
}

/** Từ đệm tiếng Anh: bỏ đi khi so khớp, vì nguồn hay lược chúng khỏi tên. */
const TU_DEM = new Set(['a', 'an', 'the', 'of', 'and', 'to', 'in', 'on', 'for', 'at', 'with'])

/** Mạo từ đứng đầu tên phim tiếng Anh. */
const MAO_TU_DAU = /^(a|an|the)\s+/

/** Tách từ khoá thành các từ không dấu, chữ thường. */
export function tachTu(s: string): string[] {
  return khongDau(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Các từ có nghĩa — bỏ từ đệm, trừ khi bỏ xong không còn gì. */
export function tuCoNghia(s: string): string[] {
  const tu = tachTu(s)
  const loc = tu.filter((t) => !TU_DEM.has(t))
  return loc.length ? loc : tu
}

/** "A Love Other Than Yours" -> "a-love-other-than-yours", đúng kiểu slug của nguồn. */
export function slugHoa(s: string): string {
  return tachTu(s).join('-')
}

/**
 * Các biến thể từ khoá để hỏi lại nguồn khi từ khoá gốc ra rỗng, xếp từ sát
 * nghĩa nhất tới lỏng nhất. Không chứa chính từ khoá gốc.
 *
 * Chỉ cắt ngắn theo CỤM LIỀN NHAU từ đầu tên: nguồn khớp nguyên cụm, nên ghép
 * hai từ rời ("other yours") thì vẫn rỗng như cũ.
 */
export function bienTheTuKhoa(tuKhoa: string): string[] {
  const goc = tuKhoa.trim().toLowerCase().replace(/\s+/g, ' ')
  const kd = tachTu(goc).join(' ')
  const boMaoTu = kd.replace(MAO_TU_DAU, '')
  const tu = boMaoTu.split(' ').filter(Boolean)

  const ra = [kd, boMaoTu]
  if (tu.length > 3) ra.push(tu.slice(0, 3).join(' '))
  if (tu.length > 2) ra.push(tu.slice(0, 2).join(' '))

  return [...new Set(ra)].filter((v) => v && v !== goc && v.length >= 2)
}

/**
 * Phim có khớp từ khoá không: MỌI từ có nghĩa đều phải nằm trong tên Việt, tên
 * gốc hoặc slug. Dùng để lọc kết quả của các biến thể lỏng ở trên.
 */
export function khopTuKhoa(tuKhoa: string, p: { ten?: string; tenGoc?: string; slug?: string }): boolean {
  const can = tuCoNghia(tuKhoa)
  if (!can.length) return false
  const co = new Set([...tachTu(p.ten || ''), ...tachTu(p.tenGoc || ''), ...tachTu((p.slug || '').replace(/-/g, ' '))])
  return can.every((t) => co.has(t))
}
