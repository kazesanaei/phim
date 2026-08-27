/**
 * Theo dõi phim bộ và phát hiện tập mới.
 *
 * Cách nhận biết: nguồn trả `episode_current` (ví dụ "Tập 12" / "Hoàn Tất").
 * Lúc bấm theo dõi thì ghi lại giá trị đó; sau này chuỗi khác đi nghĩa là có
 * tập mới. Không cần so số — chỉ cần khác là đủ, và cách này chịu được mọi kiểu
 * chữ nguồn dùng.
 *
 * Kiểm theo nhịp, ghi giờ kiểm vào DB để mở trang liên tục không làm nguồn bị dồn.
 */
import { db } from './db'
import { layChiTiet } from './vsmov'

/** Khoảng cách tối thiểu giữa hai lần kiểm, tính bằng giờ. */
const CACH_GIO = 6

export type TapMoi = {
  slug: string
  ten: string | null
  poster: string | null
  tap_da_biet: string | null
  tap_moi: number
}

export function danhSachTapMoi(): TapMoi[] {
  try {
    return db.prepare('select slug, ten, poster, tap_da_biet, tap_moi from theo_doi where tap_moi = 1').all() as never
  } catch {
    return []
  }
}

/** Người dùng đã mở phim đó rồi thì tắt cờ tập mới. */
export function danhDauDaXem(slug: string) {
  try {
    db.prepare('update theo_doi set tap_moi = 0 where slug = ?').run(slug)
  } catch {
    // không theo dõi phim này thì thôi
  }
}

/**
 * Kiểm các phim đang theo dõi. Chạy nền, không chờ.
 * Chỉ kiểm những phim quá hạn CACH_GIO để tránh gọi nguồn dồn dập.
 */
export function kiemTapMoi(): void {
  let canKiem: { slug: string; tap_da_biet: string | null }[]
  try {
    canKiem = db
      .prepare(
        `select slug, tap_da_biet from theo_doi
         where kiem_luc is null or kiem_luc <= datetime('now', ?)`,
      )
      .all('-' + CACH_GIO + ' hours') as never
  } catch {
    return
  }
  if (!canKiem.length) return

  void (async () => {
    for (const h of canKiem) {
      try {
        const ct = await layChiTiet(h.slug)
        if (!ct) continue
        const hienTai = ct.tapHienTai ?? null
        const coMoi = !!h.tap_da_biet && !!hienTai && hienTai !== h.tap_da_biet
        db.prepare(
          `update theo_doi set tap_da_biet = ?, tap_moi = ?, ten = coalesce(?, ten),
             poster = coalesce(?, poster), kiem_luc = datetime('now') where slug = ?`,
        ).run(hienTai, coMoi ? 1 : 0, ct.ten, ct.poster ?? null, h.slug)
      } catch {
        // Nguồn lỗi một phim thì bỏ qua, lần sau kiểm lại
        db.prepare("update theo_doi set kiem_luc = datetime('now') where slug = ?").run(h.slug)
      }
      await new Promise((r) => setTimeout(r, 200))
    }
  })()
}
