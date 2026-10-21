/**
 * Lịch ra tập của phim bộ đang chiếu — suy từ chính các lần nguồn cập nhật.
 *
 * VÌ SAO KHÔNG DÙNG TRƯỜNG `showtimes` CỦA NGUỒN: nó là chữ tự do và sai rõ
 * ràng — Doraemon ghi "Tập mới được ra mắt vào ngày 04/07/1979", Đảo Hải Tặc ghi
 * 02/08/2026 trong khi nguồn vừa cập nhật 28/09. In nó ra là in thông tin sai.
 *
 * Thay vào đó: mỗi lần thấy một phim bộ mang số tập mới thì ghi lại giờ NGUỒN
 * cập nhật (modified.time). Đủ mẫu thì mới nói "thường ra tập vào thứ X"; chưa đủ
 * thì chỉ nói thứ chắc chắn đúng là "cập nhật N ngày trước".
 *
 * Phần suy luận thuần nằm ở lib/nhip-tap.ts để bộ kiểm gọi được không cần DB.
 */
import { db } from './db'
import { nhipTuMoc, thuRaTap } from './nhip-tap'
import type { PhimTom } from './vsmov'

export { truocDay } from './nhip-tap'

type CoLich = Pick<PhimTom, 'slug' | 'tapHienTai' | 'capNhat' | 'loai' | 'trangThai'>

/** Ghi lại các lần lên tập mới. Bắn từ danh sách "mới cập nhật" và trang chi tiết. */
export function ghiLichTap(ds: CoLich[]) {
  let lenh
  try {
    lenh = db.prepare('insert or ignore into lich_tap (slug, tap, thay_luc) values (?, ?, ?)')
  } catch {
    return // DB cũ chưa có bảng — lần khởi động sau sẽ có
  }
  for (const p of ds) {
    if (p.loai !== 'bo' || !p.capNhat) continue
    if (p.trangThai && p.trangThai !== 'ongoing') continue
    if (!Number.isFinite(Date.parse(p.capNhat))) continue
    // "Full", "Trailer"... không phải một tập mới
    if (p.tapHienTai && !/\d/.test(p.tapHienTai)) continue
    /**
     * Danh sách "mới cập nhật" của CẢ HAI nguồn không trả số tập (không có
     * episode_current) — chỉ có modified.time. Khi đó lấy chính mốc cập nhật làm
     * khoá: mỗi lần nguồn cập nhật một phim bộ là một sự kiện. Trước đây bỏ qua
     * mọi mục thiếu số tập nên trang chủ không ghi được gì.
     */
    const khoa = p.tapHienTai || 'luc:' + p.capNhat
    try {
      lenh.run(p.slug, khoa, p.capNhat)
    } catch {
      // ghi lịch là việc phụ, hỏng thì bỏ qua
    }
  }
}

/** Câu mô tả nhịp ra tập của một phim, hoặc null khi chưa đủ chắc để nói. */
export function uocLichTap(slug: string): string | null {
  try {
    // DISTINCT theo mốc thời gian: trang chi tiết (khoá "Tập 12") và danh sách
    // (khoá theo giờ) có thể ghi CÙNG một lần cập nhật hai lần. Đếm hai lần là
    // sinh ra khoảng cách 0 ngày và hàm suy nhầm thành "ra tập mỗi ngày".
    const moc = (db.prepare('select distinct thay_luc from lich_tap where slug = ?').all(slug) as { thay_luc: string }[]).map(
      (r) => Date.parse(r.thay_luc),
    )
    return nhipTuMoc(moc)
  } catch {
    return null
  }
}

export type MucLich = {
  slug: string
  ten: string
  poster: string | null
  /** Thứ hay ra tập (0 = Chủ nhật), 'ngay' = gần như hằng ngày, null = chưa đủ dữ liệu. */
  thu: number[] | 'ngay' | null
  lanCuoi: string | null
  tapMoi: boolean
  theoDoi: boolean
}

/**
 * Phim bộ "của mình" cho trang lịch tuần: phim đang theo dõi, cộng phim bộ đang
 * xem dở trong 60 ngày mà nguồn còn lên tập (có dòng trong lich_tap). Phim xem dở
 * đã hết chiếu thì không có lịch gì để nói — bỏ, kẻo trang đầy "chưa rõ".
 */
export function lichTuan(): MucLich[] {
  const theoDoi = db.prepare('select slug, ten, poster, tap_moi from theo_doi').all() as {
    slug: string
    ten: string | null
    poster: string | null
    tap_moi: number
  }[]
  const dangXem = db
    .prepare(
      `select slug, max(ten) as ten, max(poster) as poster from xem
       where tap is not null and tap not in ('full', 'tap-full') and slug not like 'local-%'
         and cap_nhat >= datetime('now', '-60 days')
       group by slug`,
    )
    .all() as { slug: string; ten: string | null; poster: string | null }[]
  const mocCua = db.prepare('select distinct thay_luc from lich_tap where slug = ?')

  const ra = new Map<string, MucLich>()
  const them = (slug: string, ten: string | null, poster: string | null, laTheoDoi: boolean, tapMoi: boolean) => {
    if (ra.has(slug)) return
    const moc = (mocCua.all(slug) as { thay_luc: string }[]).map((r) => Date.parse(r.thay_luc)).filter(Number.isFinite)
    if (!laTheoDoi && !moc.length) return
    ra.set(slug, {
      slug,
      // Bản ghi xem lưu tên kèm tập ("Đảo Hải Tặc - Tập 1156") — lịch là của cả phim.
      ten: (ten || slug).replace(/\s*-\s*Tập\s+\S+$/i, ''),
      poster,
      thu: thuRaTap(moc),
      lanCuoi: moc.length ? new Date(Math.max(...moc)).toISOString() : null,
      tapMoi,
      theoDoi: laTheoDoi,
    })
  }
  for (const r of theoDoi) them(r.slug, r.ten, r.poster, true, !!r.tap_moi)
  for (const r of dangXem) them(r.slug, r.ten, r.poster, false, false)
  return [...ra.values()]
}
