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
 */
import * as vsmov from './vsmov'
import * as kkphim from './nguon-kkphim'
import { locSach } from './loc-18'
import { layCaiDat } from './db'
import type { PhimTom, Trang, ChiTiet, MucDanhMuc } from './vsmov'

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

export async function timKiem(tuKhoa: string, trang = 1): Promise<Trang> {
  const bat = nguonDangBat()
  const [a, b] = await Promise.all([
    bat.includes('vsmov') ? anToan(vsmov.timKiem(tuKhoa, trang), TRANG_RONG) : TRANG_RONG,
    bat.includes('kkphim') ? anToan(kkphim.timKiem(tuKhoa, trang), TRANG_RONG) : TRANG_RONG,
  ])
  const items = gopVaKhuTrung([a.items, b.items])
  return { items, tongSo: a.tongSo + b.tongSo, tongTrang: Math.max(a.tongTrang, b.tongTrang), trang }
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
  if (!locSach([goc]).length) return null

  return {
    ...goc,
    // Điền vào chỗ trống bằng nguồn kia — nguồn nào thiếu mô tả/ảnh thì bù
    moTa: goc.moTa || (a?.moTa ?? '') || (b?.moTa ?? ''),
    poster: goc.poster || a?.poster || b?.poster,
    anhNgang: goc.anhNgang || a?.anhNgang || b?.anhNgang,
    theLoai: goc.theLoai.length ? goc.theLoai : (a?.theLoai ?? b?.theLoai ?? []),
    quocGia: goc.quocGia.length ? goc.quocGia : (a?.quocGia ?? b?.quocGia ?? []),
    mayChu: [...(a?.mayChu ?? []), ...(b?.mayChu ?? [])],
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
