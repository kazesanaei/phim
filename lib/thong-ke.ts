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
