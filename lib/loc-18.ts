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

/**
 * Từ khoá trong tên phim, khớp theo TỪ TRỌN VẸN chứ không phải chuỗi con.
 *
 * VÌ SAO PHẢI KHỚP TỪ TRỌN VẸN: khớp chuỗi con thì "xxx" bắt nhầm "MaXXXine",
 * "sex" bắt nhầm "Sexsomnia" lẫn "Sex Education". Ranh giới từ cho phép dùng
 * những từ ngắn mà vẫn không oan.
 *
 * VÌ SAO PHẢI LÀ CỤM CHỨ KHÔNG PHẢI TỪ ĐƠN: "nguoi lon" một mình bắt nhầm
 * "Những Người Lớn Tuổi" (phim về người cao tuổi) và "Adults in the Room".
 * Phải là "phim nguoi lon" mới đúng nghĩa phim khiêu dâm.
 *
 * Danh sách này CỐ Ý hẹp. Nó là lưới an toàn cho phần sổ đen chưa phủ tới,
 * không phải công cụ chính — xem chú thích đầu tệp.
 */
const TU_KHOA = [
  'khieu dam',
  'phim sex',
  'phim nguoi lon',
  'sao phim nguoi lon',
  'porn',
  'porno',
  'pornstar',
  'jav',
  'javhd',
  'av idol',
  'hentai',
  'ecchi',
  'erotic',
  'erotica',
  'softcore',
  // KHÔNG dùng 'hardcore' một mình: nó bắt nhầm "Hardcore Henry", phim hành
  // động bình thường. Đã kiểm trên kho thật.
  'nguoi lon 18',
  'phim 18',
  '18+',
  '19+',
  'r18',
  'khong che',
  'uncensored',
  'nhuc duc',
  'dam duc',
  'thac loan',
  'gai goi',
  'sexual nature',
  'kamasutra',
]

/**
 * Ranh giới từ tự dựng thay vì `\b`.
 *
 * `\b` của JavaScript bám theo bảng chữ ASCII, mà chuỗi vào đây đã bỏ dấu nên
 * phần lớn ổn — nhưng từ khoá có chứa `+` (như "18+") thì `\b` đặt sai chỗ và
 * không khớp gì cả. Tự kẹp bằng ký tự không phải chữ/số thì đúng cho mọi từ.
 */
function khopTuTronVen(chuoi: string, tu: string): boolean {
  const thoat = tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(^|[^a-z0-9])' + thoat + '($|[^a-z0-9])', 'i').test(chuoi)
}

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

/** Tên phim có dấu hiệu 18+ không? Xét cả tên tiếng Việt lẫn tên gốc. */
export function tenCoDauHieu18(ten: string, tenGoc?: string): boolean {
  const a = khongDau(ten)
  const b = khongDau(tenGoc || '')
  return TU_KHOA.some((k) => khopTuTronVen(a, k) || khopTuTronVen(b, k))
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

/**
 * Dọn kho đệm: đưa mọi phim dính lưới tên vào sổ đen rồi xoá khỏi kho.
 *
 * VÌ SAO CẦN CHẠY LẠI ĐƯỢC: kho 18.719 phim được ghi bằng lưới lọc CŨ, nên
 * những phim lọt lưới hồi đó vẫn nằm trong kho. Mỗi lần siết lưới lại phải
 * quét lại kho một lượt, không thì bản cũ cứ hiện mãi.
 *
 * Trả về số phim vừa dọn.
 */
export function donKho18(): number {
  const rows = db.prepare('select slug, ten, ten_goc from kho_phim').all() as {
    slug: string
    ten: string
    ten_goc: string | null
  }[]
  const ban = rows.filter((r) => tenCoDauHieu18(r.ten, r.ten_goc ?? undefined))
  if (!ban.length) return 0

  const themDen = db.prepare("insert or ignore into chan_18 (slug, ly_do) values (?, 'ten')")
  const xoaKho = db.prepare('delete from kho_phim where slug = ?')
  const xoaTl = db.prepare('delete from kho_the_loai where slug_phim = ?')
  db.exec('begin')
  try {
    for (const r of ban) {
      themDen.run(r.slug)
      xoaKho.run(r.slug)
      xoaTl.run(r.slug)
    }
    db.exec('commit')
  } catch (e) {
    db.exec('rollback')
    throw e
  }
  return ban.length
}
