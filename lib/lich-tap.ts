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
import { nhipTuMoc } from './nhip-tap'
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
