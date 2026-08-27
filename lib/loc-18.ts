/**
 * Chặn nội dung 18+ / khiêu dâm.
 *
 * Hai lớp, cố ý chồng lên nhau:
 *  1. SỔ ĐEN theo slug — quét một lần thể loại `phim-18` của KKPhim (79 phim,
 *     4 trang) rồi chặn theo slug. Chính xác tuyệt đối, không nhầm.
 *  2. LƯỚI TÊN — bắt những phim lọt lưới vì nguồn quên gắn thể loại.
 *
 * Vì sao cần cả hai: endpoint danh sách KHÔNG trả thể loại (cạm bẫy đã biết của
 * họ API này), nên không thể lọc theo thể loại lúc duyệt — phải tra sổ đen.
 * Còn lưới tên là lưới an toàn cho phần sổ đen chưa phủ tới.
 */
import { db } from './db'
import { khongDau } from './khong-dau'

/** Từ khoá trong tên phim. Cố ý hẹp để không chặn nhầm phim thường. */
const TU_KHOA = [
  'khieu dam',
  'phim sex',
  'jav ',
  'hentai',
  'ecchi',
  'erotic',
  'softcore',
  'hardcore',
  'nguoi lon 18',
  'phim 18',
  '18+',
  'khong che',
  'uncensored',
]

/** Thể loại bị coi là người lớn, dùng khi có dữ liệu thể loại. */
export const THE_LOAI_CAM = new Set(['phim-18', 'phim-18-', '18', 'adult', 'erotic'])

/**
 * KHÔNG cache sổ đen trong bộ nhớ.
 *
 * Bản đầu tôi cache vào một Set module-scope, và nó hỏng thật: Set được nạp
 * (rỗng) TRƯỚC khi quét sổ đen, rồi không bao giờ nạp lại — trang chi tiết của
 * phim bị chặn vẫn mở được. Bảng chỉ vài chục dòng, đọc lại mỗi lần là chuyện
 * micro-giây. Đúng đắn quan trọng hơn một tối ưu vặt.
 */
function napSoDen(): Set<string> {
  try {
    const h = db.prepare('select slug from chan_18').all() as { slug: string }[]
    return new Set(h.map((x) => x.slug))
  } catch {
    return new Set()
  }
}

export function xoaBoNhoDem() {
  // Giữ lại cho tương thích; giờ không còn bộ nhớ đệm nào để xoá.
}

export function themVaoSoDen(slugs: string[]) {
  const cau = db.prepare("insert or ignore into chan_18 (slug, ly_do) values (?, 'the-loai')")
  for (const s of slugs) if (s) cau.run(s)
  xoaBoNhoDem()
}

export function demSoDen(): number {
  try {
    return (db.prepare('select count(*) as n from chan_18').get() as { n: number }).n
  } catch {
    return 0
  }
}

/** Tên phim có dấu hiệu 18+ không? */
export function tenCoDauHieu18(ten: string, tenGoc?: string): boolean {
  const a = ' ' + khongDau(ten) + ' '
  const b = ' ' + khongDau(tenGoc || '') + ' '
  return TU_KHOA.some((k) => a.includes(k) || b.includes(k))
}

/** Một phim có bị chặn không — kiểm cả sổ đen lẫn lưới tên. */
export function bacBo(p: { slug: string; ten: string; tenGoc?: string }): boolean {
  if (napSoDen().has(p.slug)) return true
  return tenCoDauHieu18(p.ten, p.tenGoc)
}

/** Lọc một danh sách, bỏ hết phim bị chặn. */
export function locSach<T extends { slug: string; ten: string; tenGoc?: string }>(ds: T[]): T[] {
  const den = napSoDen()
  return ds.filter((p) => !den.has(p.slug) && !tenCoDauHieu18(p.ten, p.tenGoc))
}
