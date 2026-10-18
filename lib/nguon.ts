/**
 * Gộp nhiều nguồn phim thành một thư viện.
 *
 * KHỬ TRÙNG THEO `slug`: cả vsmov lẫn KKPhim đều lấy metadata gốc từ cùng một
 * hệ nên slug trùng nhau khi là cùng một phim. Đo thật: trong 72 phim mới nhất
 * của KKPhim, 22 phim (31%) đã có trên vsmov — bấy nhiêu bị gộp lại thành một.
 *
 * Phim trùng KHÔNG bị vứt đi mà được gộp thành nhiều "server" ở trang chi tiết:
 * nguồn này chết thì đổi sang nguồn kia, khỏi phải đi tìm lại phim.
 *
 * MỌI đường ra đều đi qua locSach() để chặn 18+ — đừng thêm đường tắt nào bỏ
 * qua bước này.
 *
 * KHÔNG ghi kho đệm trong danhSach()/duyet(): trang chủ gọi chúng lúc prerender,
 * mà `next build` chạy song song nhiều tiến trình — ghi SQLite ở đó là dễ dính
 * "database is locked". Chỉ timKiem() (trang tìm luôn động) mới ghi.
 */
import * as vsmov from './vsmov'
import * as kkphim from './nguon-kkphim'
import { locSach } from './loc-18'
import { layCaiDat } from './db'
import type { PhimTom, Trang, ChiTiet, MucDanhMuc } from './vsmov'
import { xepTap } from './xep-tap'
import { luuPhimVaoKho } from './kho-nguon'
import { bienTheTuKhoa, khopTuKhoa, slugHoa } from './tu-khoa'

export type TenNguon = 'vsmov' | 'kkphim'

export const NGUON: { ma: TenNguon; ten: string }[] = [
  { ma: 'vsmov', ten: 'vsmov' },
  { ma: 'kkphim', ten: 'KKPhim' },
]

/** Nguồn nào đang bật. Mặc định bật cả hai. */
export function nguonDangBat(): TenNguon[] {
  const luu = layCaiDat('nguon_bat', '')
  if (!luu) return ['vsmov', 'kkphim']
  const ds = luu.split(',').filter(Boolean) as TenNguon[]
  return ds.length ? ds : ['vsmov']
}

/**
 * Gộp nhiều danh sách, bỏ trùng theo slug, giữ nguyên thứ tự xuất hiện.
 * Bản ghi đầu tiên thắng — nên nguồn xếp trước được ưu tiên hiển thị.
 */
export function gopVaKhuTrung(cac: PhimTom[][]): PhimTom[] {
  const thay = new Map<string, PhimTom>()
  for (const ds of cac) {
    for (const p of ds) {
      if (!p.slug || thay.has(p.slug)) continue
      thay.set(p.slug, p)
    }
  }
  return locSach([...thay.values()])
}

async function anToan<T>(viec: Promise<T>, duPhong: T): Promise<T> {
  try {
    return await viec
  } catch {
    // Một nguồn chết không được kéo sập cả trang
    return duPhong
  }
}

const TRANG_RONG: Trang = { items: [], tongSo: 0, tongTrang: 1, trang: 1 }

/** Danh sách phim mới / phim lẻ / phim bộ, gộp từ mọi nguồn đang bật. */
export async function danhSach(slug: string, trang = 1): Promise<Trang> {
  const bat = nguonDangBat()
  const [a, b] = await Promise.all([
    bat.includes('vsmov') ? anToan(vsmov.layDanhSach(slug, trang), TRANG_RONG) : TRANG_RONG,
    bat.includes('kkphim') ? anToan(kkphim.layDanhSach(slug, trang), TRANG_RONG) : TRANG_RONG,
  ])
  const items = gopVaKhuTrung([a.items, b.items])
  return {
    items,
    tongSo: Math.max(a.tongSo, b.tongSo),
    tongTrang: Math.max(a.tongTrang, b.tongTrang),
    trang,
  }
}

async function timThang(tuKhoa: string, trang: number): Promise<Trang> {
  const bat = nguonDangBat()
  const [a, b] = await Promise.all([
    bat.includes('vsmov') ? anToan(vsmov.timKiem(tuKhoa, trang), TRANG_RONG) : TRANG_RONG,
    bat.includes('kkphim') ? anToan(kkphim.timKiem(tuKhoa, trang), TRANG_RONG) : TRANG_RONG,
  ])
  const items = gopVaKhuTrung([a.items, b.items])
  return { items, tongSo: a.tongSo + b.tongSo, tongTrang: Math.max(a.tongTrang, b.tongTrang), trang }
}

/**
 * Tìm phim. Từ khoá gốc ra rỗng thì thử thêm hai đường (xem lib/tu-khoa.ts):
 *  1. Đoán thẳng slug từ tên — phim nước ngoài hay mang slug theo tên gốc,
 *     "A Love Other Than Yours" -> /phim/a-love-other-than-yours.
 *  2. Hỏi lại bằng biến thể lỏng hơn (bỏ dấu, bỏ mạo từ, cắt ngắn), rồi chỉ giữ
 *     phim chứa ĐỦ các từ có nghĩa để không trả về phim chẳng liên quan.
 * Chỉ chạy ở trang 1 và chỉ khi rỗng, nên tìm bình thường không tốn thêm lượt gọi.
 *
 * Phim tìm được ghi luôn vào kho đệm: lần sau ô gợi ý (chỉ đọc kho) cũng ra.
 */
export async function timKiem(tuKhoa: string, trang = 1): Promise<Trang> {
  const kq = await timThang(tuKhoa, trang)
  if (kq.items.length || trang > 1) {
    ghiVaoKho(kq.items)
    return kq
  }

  const slugDoan = [...new Set([slugHoa(tuKhoa), slugHoa(tuKhoa.replace(/^\s*(a|an|the)\s+/i, ''))])].filter(Boolean)
  const theoSlug = Promise.all(slugDoan.map((s) => anToan(layChiTiet(s), null)))

  let theoBienThe: PhimTom[] = []
  for (const bt of bienTheTuKhoa(tuKhoa)) {
    const r = await timThang(bt, 1)
    theoBienThe = r.items.filter((p) => khopTuKhoa(tuKhoa, p))
    if (theoBienThe.length) break
  }

  const items = gopVaKhuTrung([(await theoSlug).filter((ct): ct is ChiTiet => !!ct).map(rutGon), theoBienThe])
  ghiVaoKho(items)
  return { items, tongSo: items.length, tongTrang: 1, trang: 1 }
}

/** Bỏ phần nặng của chi tiết (danh sách tập, diễn viên...) — thẻ phim chỉ cần phần tóm tắt. */
function rutGon(ct: ChiTiet): PhimTom {
  return {
    slug: ct.slug,
    ten: ct.ten,
    tenGoc: ct.tenGoc,
    nam: ct.nam,
    poster: ct.poster,
    anhNgang: ct.anhNgang,
    nguon: ct.nguon,
    tapHienTai: ct.tapHienTai,
    chatLuong: ct.chatLuong,
    loai: ct.loai,
    diem: ct.diem,
    soPhieu: ct.soPhieu,
    capNhat: ct.capNhat,
    trangThai: ct.trangThai,
    la18: ct.la18,
  }
}

/** Kho đệm hỏng hay đang bị khoá thì thôi — tìm kiếm không được gãy vì nó. */
function ghiVaoKho(items: PhimTom[]) {
  if (!items.length) return
  try {
    luuPhimVaoKho(items)
  } catch {
    // bỏ qua, lần sau ghi lại
  }
}

export async function duyet(t: vsmov.ThamSoDuyet): Promise<Trang> {
  const bat = nguonDangBat()
  const [a, b] = await Promise.all([
    bat.includes('vsmov') ? anToan(vsmov.duyet(t), TRANG_RONG) : TRANG_RONG,
    bat.includes('kkphim') && t.theLoai
      ? anToan(kkphim.theoTheLoai(t.theLoai, t.trang || 1, { country: t.quocGia, year: t.nam }), TRANG_RONG)
      : TRANG_RONG,
  ])
  const items = gopVaKhuTrung([a.items, b.items])
  return {
    items,
    tongSo: Math.max(a.tongSo, b.tongSo),
    tongTrang: Math.max(a.tongTrang, b.tongTrang),
    trang: t.trang || 1,
  }
}

/**
 * Chi tiết một phim: hỏi MỌI nguồn rồi gộp danh sách server.
 * Nguồn nào cũng có phim này thì người xem đổi qua lại được khi một bên chết.
 */
export async function layChiTiet(slug: string): Promise<ChiTiet | null> {
  const bat = nguonDangBat()
  const [a, b] = await Promise.all([
    bat.includes('vsmov') ? anToan(vsmov.layChiTiet(slug), null) : null,
    bat.includes('kkphim') ? anToan(kkphim.layChiTiet(slug), null) : null,
  ])

  const goc = a ?? b
  if (!goc) return null
  // Chặn 18+ cả ở trang chi tiết, không chỉ ở danh sách
  const sach = locSach([goc])
  if (!sach.length) return null

  return {
    ...goc,
    la18: sach[0].la18,
    // Điền vào chỗ trống bằng nguồn kia — nguồn nào thiếu mô tả/ảnh thì bù
    moTa: goc.moTa || (a?.moTa ?? '') || (b?.moTa ?? ''),
    poster: goc.poster || a?.poster || b?.poster,
    anhNgang: goc.anhNgang || a?.anhNgang || b?.anhNgang,
    theLoai: goc.theLoai.length ? goc.theLoai : (a?.theLoai ?? b?.theLoai ?? []),
    quocGia: goc.quocGia.length ? goc.quocGia : (a?.quocGia ?? b?.quocGia ?? []),
    // Sắp tập Ở ĐÂY, một lần cho mọi nơi dùng — xem lib/xep-tap.ts.
    mayChu: [...(a?.mayChu ?? []), ...(b?.mayChu ?? [])].map((m) => ({ ...m, tap: xepTap(m.tap) })),
  }
}

/** Danh mục gộp, khử trùng theo slug. */
export async function layDanhMuc(): Promise<{ theLoai: MucDanhMuc[]; quocGia: MucDanhMuc[]; nam: MucDanhMuc[] }> {
  const dm = await anToan(vsmov.layDanhMuc(), { theLoai: [], quocGia: [], nam: [] })
  return dm
}

/** Link phát của một tập: KKPhim cho m3u8 thẳng, vsmov phải qua trang embed. */
export function kieuNguonPhat(embed: string): { kieu: 'm3u8'; url: string } | { kieu: 'embed'; embed: string } {
  return /\.m3u8(\?|$)/i.test(embed) ? { kieu: 'm3u8', url: embed } : { kieu: 'embed', embed }
}
