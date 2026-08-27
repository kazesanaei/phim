/** Đọc kho phim local trong SQLite. Phần quét/ghi nằm ở lib/quet.ts. */
import { db } from './db'
import { khongDau } from './khong-dau'
import type { PhimTom, ChiTiet, MayChu } from './vsmov'

export type HangPhimDb = {
  id: number
  nguon: string
  slug: string
  ten: string
  ten_goc: string | null
  nam: number | null
  loai: string
  poster: string | null
  backdrop: string | null
  mo_ta: string | null
  thoi_luong: number | null
  chat_luong: string | null
  ngon_ngu: string | null
  thu_muc: string | null
  sua_tay: number
}

export type HangTapDb = {
  id: number
  phim_id: number
  so_tap: number
  ten: string | null
  duong_dan_file: string | null
  embed: string | null
  thoi_luong: number | null
  can_chuyen_ma: number
  luong: string | null
}

export type HangPhuDeDb = {
  id: number
  tap_id: number
  ngon_ngu: string | null
  nhan: string | null
  duong_dan: string
  mac_dinh: number
}

function veTom(h: HangPhimDb): PhimTom {
  const soTap = db.prepare('select count(*) as n from tap where phim_id = ?').get(h.id) as { n: number }
  return {
    slug: h.slug,
    ten: h.ten,
    tenGoc: h.ten_goc || undefined,
    nam: h.nam || undefined,
    poster: h.poster || undefined,
    anhNgang: h.backdrop || h.poster || undefined,
    nguon: 'local',
    chatLuong: h.chat_luong || undefined,
    loai: h.loai === 'bo' ? 'bo' : 'le',
    tapHienTai: soTap.n > 1 ? soTap.n + ' tập' : undefined,
  }
}

export type LocLocal = {
  tim?: string
  theLoai?: string
  quocGia?: string
  nam?: string
  loai?: string
  trang?: number
  moiTrang?: number
}

export function demPhimLocal(): number {
  return (db.prepare('select count(*) as n from phim').get() as { n: number }).n
}

export function phimLocal(loc: LocLocal = {}): { items: PhimTom[]; tongSo: number; tongTrang: number; trang: number } {
  const dieuKien: string[] = []
  const thamSo: (string | number)[] = []

  if (loc.theLoai) {
    dieuKien.push('exists (select 1 from the_loai t where t.phim_id = phim.id and t.slug = ?)')
    thamSo.push(loc.theLoai)
  }
  if (loc.quocGia) {
    dieuKien.push('exists (select 1 from quoc_gia q where q.phim_id = phim.id and q.slug = ?)')
    thamSo.push(loc.quocGia)
  }
  if (loc.nam) {
    dieuKien.push('nam = ?')
    thamSo.push(Number(loc.nam))
  }
  if (loc.loai === 'le' || loc.loai === 'bo') {
    dieuKien.push('loai = ?')
    thamSo.push(loc.loai)
  }
  if (loc.tim?.trim()) {
    // ten_khong_dau đã lưu sẵn lúc quét nên tìm "nguoi nhen" ra "Người Nhện"
    dieuKien.push("(ten_khong_dau like ? or lower(coalesce(ten_goc, '')) like ?)")
    const k = '%' + khongDau(loc.tim) + '%'
    thamSo.push(k, k)
  }

  const dau = dieuKien.length ? ' where ' + dieuKien.join(' and ') : ''
  const tongSo = (db.prepare('select count(*) as n from phim' + dau).get(...thamSo) as { n: number }).n

  const moiTrang = loc.moiTrang || 24
  const trang = Math.max(1, loc.trang || 1)
  const hang = db
    .prepare('select * from phim' + dau + ' order by tao_luc desc limit ? offset ?')
    .all(...thamSo, moiTrang, (trang - 1) * moiTrang) as HangPhimDb[]

  return {
    items: hang.map(veTom),
    tongSo,
    tongTrang: Math.max(1, Math.ceil(tongSo / moiTrang)),
    trang,
  }
}

export function layPhimLocalMoi(gioiHan = 20): PhimTom[] {
  const hang = db.prepare('select * from phim order by tao_luc desc limit ?').all(gioiHan) as HangPhimDb[]
  return hang.map(veTom)
}

export function tapCuaPhim(phimId: number): HangTapDb[] {
  return db.prepare('select * from tap where phim_id = ? order by so_tap').all(phimId) as HangTapDb[]
}

export function phuDeCuaTap(tapId: number): HangPhuDeDb[] {
  return db.prepare('select * from phu_de where tap_id = ? order by mac_dinh desc, id').all(tapId) as HangPhuDeDb[]
}

export function layHangPhim(slug: string): HangPhimDb | null {
  return (db.prepare('select * from phim where slug = ?').get(slug) as HangPhimDb | undefined) ?? null
}

/** Dựng đối tượng ChiTiet giống hệt phim từ API để hai loại dùng chung một trang. */
export function layChiTietLocal(slug: string): (ChiTiet & { idPhim: number }) | null {
  const h = layHangPhim(slug)
  if (!h) return null
  const ds = tapCuaPhim(h.id)
  const mayChu: MayChu[] = [
    {
      ten: 'Trong máy',
      tap: ds.map((t) => ({
        ten: t.ten || String(t.so_tap),
        slug: 'tap-' + t.so_tap,
        embed: '',
      })),
    },
  ]
  return {
    idPhim: h.id,
    ...veTom(h),
    moTa: h.mo_ta || '',
    thoiLuong: h.thoi_luong ? Math.round(h.thoi_luong / 60) + ' phút' : undefined,
    ngonNgu: h.ngon_ngu || undefined,
    tongTap: ds.length > 1 ? String(ds.length) : undefined,
    trangThai: undefined,
    dienVien: [],
    daoDien: [],
    theLoai: db.prepare('select ten, slug from the_loai where phim_id = ?').all(h.id) as { ten: string; slug: string }[],
    quocGia: db.prepare('select ten, slug from quoc_gia where phim_id = ?').all(h.id) as { ten: string; slug: string }[],
    mayChu: mayChu[0].tap.length ? mayChu : [],
  }
}

/** Danh mục thể loại / quốc gia / năm có thật trong kho local, để dựng bộ lọc. */
export function danhMucLocal() {
  return {
    theLoai: db
      .prepare('select ten, slug, count(*) as n from the_loai group by slug order by n desc')
      .all() as { ten: string; slug: string; n: number }[],
    quocGia: db
      .prepare('select ten, slug, count(*) as n from quoc_gia group by slug order by n desc')
      .all() as { ten: string; slug: string; n: number }[],
    nam: db
      .prepare('select nam from phim where nam is not null group by nam order by nam desc')
      .all() as { nam: number }[],
  }
}
