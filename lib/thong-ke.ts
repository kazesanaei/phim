/**
 * Thống kê xem phim, đọc thẳng từ bảng `xem`.
 *
 * Lưu ý về con số "đã xem": ta chỉ biết VỊ TRÍ dừng gần nhất của mỗi tập, không
 * biết người dùng có tua đi tua lại hay xem lại lần hai. Nên tổng thời lượng ở
 * đây là "đã xem tới đâu", không phải "đã ngồi trước màn hình bao lâu". Giao
 * diện phải nói đúng như vậy.
 *
 * Mốc thời gian trong DB là UTC (datetime('now')), cộng 7 giờ để ra ngày Việt Nam.
 */
import { db } from './db'

export type TongQuan = {
  soMuc: number
  soXong: number
  tongGiay: number
  soPhimLocal: number
}

export function tongQuan(): TongQuan {
  const a = db
    .prepare('select count(*) as soMuc, sum(xong) as soXong, sum(vi_tri) as tongGiay from xem')
    .get() as { soMuc: number; soXong: number | null; tongGiay: number | null }
  const b = db.prepare('select count(*) as n from phim').get() as { n: number }
  return {
    soMuc: a.soMuc || 0,
    soXong: a.soXong || 0,
    tongGiay: a.tongGiay || 0,
    soPhimLocal: b.n || 0,
  }
}

/** Thể loại hay xem — chỉ tính được với phim trong máy vì phim nguồn không lưu thể loại. */
export function theLoaiHayXem(gioiHan = 8): { ten: string; n: number }[] {
  return db
    .prepare(
      `select t.ten as ten, count(*) as n
       from xem x join phim p on p.slug = x.slug join the_loai t on t.phim_id = p.id
       group by t.slug order by n desc limit ?`,
    )
    .all(gioiHan) as never
}

export type NgayXem = { ngay: string; giay: number }

/** Số giây xem theo từng ngày, dùng vẽ biểu đồ nhiệt. */
export function theoNgay(soNgay = 119): NgayXem[] {
  return db
    .prepare(
      `select date(cap_nhat, '+7 hours') as ngay, sum(vi_tri) as giay
       from xem
       where cap_nhat >= datetime('now', ?)
       group by ngay order by ngay`,
    )
    .all('-' + soNgay + ' days') as never
}

export function xemNhieuNhat(gioiHan = 10): { slug: string; ten: string | null; poster: string | null; soTap: number; giay: number }[] {
  return db
    .prepare(
      `select slug, max(ten) as ten, max(poster) as poster, count(*) as soTap, sum(vi_tri) as giay
       from xem group by slug order by giay desc limit ?`,
    )
    .all(gioiHan) as never
}

export function gioPhut(giay: number): string {
  const g = Math.floor(giay / 3600)
  const p = Math.round((giay % 3600) / 60)
  if (g <= 0) return p + ' phút'
  return p > 0 ? `${g} giờ ${p} phút` : `${g} giờ`
}

export type NamXem = {
  nam: string
  soPhim: number
  soTap: number
  giay: number
  phimDinh: { slug: string; ten: string | null; poster: string | null; anh: string | null; giay: number } | null
  gioHay: number | null
  thangDinh: { thang: number; giay: number } | null
  chuoiDai: number
}

/** Các năm có dữ liệu, mới nhất trước. */
export function cacNam(): string[] {
  return (
    db.prepare(`select distinct strftime('%Y', cap_nhat, '+7 hours') as nam from xem order by nam desc`).all() as { nam: string }[]
  ).map((r) => r.nam)
}

/**
 * "Năm xem phim của bạn". Cùng giới hạn như phần trên: mỗi tập chỉ có MỘT mốc
 * cap_nhat (lần xem gần nhất), nên giờ hay xem và chuỗi ngày là ước lượng thấp.
 */
export function namXem(nam: string): NamXem {
  const loc = `strftime('%Y', cap_nhat, '+7 hours') = ?`
  const a = db.prepare(`select count(distinct slug) as soPhim, count(*) as soTap, sum(vi_tri) as giay from xem where ${loc}`).get(nam) as {
    soPhim: number
    soTap: number
    giay: number | null
  }
  const phimDinh = db
    .prepare(
      `select slug, max(ten) as ten, max(poster) as poster, max(anh_ngang) as anh, sum(vi_tri) as giay
       from xem where ${loc} group by slug order by giay desc limit 1`,
    )
    .get(nam) as NamXem['phimDinh'] | undefined
  const gio = db
    .prepare(`select cast(strftime('%H', cap_nhat, '+7 hours') as int) as gio, count(*) as n from xem where ${loc} group by gio order by n desc limit 1`)
    .get(nam) as { gio: number } | undefined
  const thang = db
    .prepare(`select cast(strftime('%m', cap_nhat, '+7 hours') as int) as thang, sum(vi_tri) as giay from xem where ${loc} group by thang order by giay desc limit 1`)
    .get(nam) as { thang: number; giay: number } | undefined
  const ngay = (db.prepare(`select distinct date(cap_nhat, '+7 hours') as d from xem where ${loc} order by d`).all(nam) as { d: string }[]).map(
    (r) => Date.parse(r.d) / 86_400_000,
  )
  return {
    nam,
    soPhim: a.soPhim || 0,
    soTap: a.soTap || 0,
    giay: a.giay || 0,
    phimDinh: phimDinh ?? null,
    gioHay: gio?.gio ?? null,
    thangDinh: thang ?? null,
    chuoiDai: chuoiDaiNhat(ngay),
  }
}

/** Chuỗi ngày liên tiếp dài nhất trong danh sách số-ngày đã sắp tăng dần. */
export function chuoiDaiNhat(ngay: number[]): number {
  let dai = 0
  let dang = 0
  for (let i = 0; i < ngay.length; i++) {
    dang = i > 0 && ngay[i] - ngay[i - 1] === 1 ? dang + 1 : 1
    dai = Math.max(dai, dang)
  }
  return dai
}
