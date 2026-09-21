/** Tiến độ xem + đánh dấu. Tách khỏi route để page cũng dùng được mà không import file route. */
import { db } from './db'

export type BanGhiXem = {
  khoa: string
  slug: string
  tap: string | null
  ten: string | null
  poster: string | null
  nguon: string
  vi_tri: number
  thoi_luong: number
  xong: number
  cap_nhat: string
}

export type BanGhiDanhDau = {
  khoa: string
  loai: string
  ten: string | null
  poster: string | null
  nam: number | null
  nguon: string
  tao_luc: string
}

export function layTienDo(khoa: string): BanGhiXem | null {
  return (db.prepare('select * from xem where khoa = ?').get(khoa) as BanGhiXem | undefined) ?? null
}

export function danhSachTiepTuc(gioiHan = 20): BanGhiXem[] {
  return db
    .prepare('select * from xem where xong = 0 and vi_tri > 30 order by cap_nhat desc limit ?')
    .all(gioiHan) as never
}

export function lichSuXem(gioiHan = 60): BanGhiXem[] {
  return db.prepare('select * from xem order by cap_nhat desc limit ?').all(gioiHan) as never
}

export function danhDauTheoLoai(loai: 'thich' | 'xem_sau'): BanGhiDanhDau[] {
  return db.prepare('select * from danh_dau where loai = ? order by tao_luc desc').all(loai) as never
}

export function daDanhDau(khoa: string, loai: 'thich' | 'xem_sau'): boolean {
  return !!db.prepare('select 1 from danh_dau where khoa = ? and loai = ?').get(khoa, loai)
}

/** Tiến độ của mọi tập thuộc một phim, khoá theo `slug:tap`. */
export function tienDoCuaPhim(slug: string): Map<string, BanGhiXem> {
  const hang = db.prepare('select * from xem where slug = ?').all(slug) as BanGhiXem[]
  return new Map(hang.map((h) => [h.khoa, h]))
}

export type MocIntro = { bat_dau: number; ket_thuc: number }

export function layMocIntro(slug: string): MocIntro | null {
  return (db.prepare('select bat_dau, ket_thuc from moc_intro where phim_slug = ?').get(slug) as MocIntro | undefined) ?? null
}

export function datMocIntro(slug: string, batDau: number, ketThuc: number) {
  db.prepare(
    `insert into moc_intro (phim_slug, bat_dau, ket_thuc, cap_nhat) values (?, ?, ?, datetime('now'))
     on conflict(phim_slug) do update set bat_dau = excluded.bat_dau, ket_thuc = excluded.ket_thuc, cap_nhat = datetime('now')`,
  ).run(slug, batDau, ketThuc)
}

export function xoaMocIntro(slug: string) {
  db.prepare('delete from moc_intro where phim_slug = ?').run(slug)
}

export type HangTheoDoi = {
  slug: string
  ten: string | null
  poster: string | null
  tap_da_biet: string | null
  tap_moi: number
  kiem_luc: string | null
}

export function dangTheoDoi(slug: string): boolean {
  return !!db.prepare('select 1 from theo_doi where slug = ?').get(slug)
}

export function danhSachTheoDoi(): HangTheoDoi[] {
  return db.prepare('select * from theo_doi order by tap_moi desc, tao_luc desc').all() as never
}

export function demTapMoi(): number {
  return (db.prepare('select count(*) as n from theo_doi where tap_moi = 1').get() as { n: number }).n
}

/**
 * Phim đã xem xong, để dựng hàng "Xem lại".
 *
 * Xem hết là bản ghi rơi khỏi `danhSachTiepTuc` (nó lọc `xong = 0`) và phim biến
 * mất khỏi trang chủ không còn dấu vết nào — muốn xem lại phải đi tìm bằng tay.
 *
 * `not exists` loại phim bộ đang xem dở: tập 3 xem xong nhưng tập 4 mới nửa
 * chừng thì phim vẫn thuộc "Tiếp tục xem", đưa sang đây là hiện hai lần.
 *
 * `max(cap_nhat)` nằm trong SELECT chứ không chỉ ở ORDER BY: SQLite chỉ bảo đảm
 * các cột trần lấy đúng từ hàng có giá trị lớn nhất khi max() có mặt ở SELECT.
 */
export function danhSachXemLai(gioiHan = 20): BanGhiXem[] {
  return db
    .prepare(
      `select *, max(cap_nhat) as moi_nhat from xem x
        where x.xong = 1
          and not exists (select 1 from xem y where y.slug = x.slug and y.xong = 0 and y.vi_tri > 30)
        group by x.slug
        order by moi_nhat desc
        limit ?`,
    )
    .all(gioiHan) as never
}
