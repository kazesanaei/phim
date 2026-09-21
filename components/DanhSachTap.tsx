/**
 * Đọc tiến độ xem từ DB rồi giao phần hiển thị cho LuoiTap.
 *
 * Tách làm hai vì LuoiTap cần state phía client (đang mở khoảng nào), còn truy
 * vấn tiến độ thì phải chạy ở máy chủ — gộp một chỗ là phải biến cả khối thành
 * client component rồi gọi thêm một lượt API cho thứ vốn đọc thẳng được.
 */
import { tienDoCuaPhim } from '@/lib/theo-doi'
import type { Tap } from '@/lib/vsmov'
import LuoiTap, { type TapHien } from '@/components/LuoiTap'

export default function DanhSachTap({
  slug,
  tap,
  dangXem,
  server,
}: {
  slug: string
  tap: Tap[]
  dangXem?: string
  server: number
}) {
  const daXem = tienDoCuaPhim(slug)

  const hien: TapHien[] = tap.map((t) => {
    const g = daXem.get(`${slug}:${t.slug}`)
    return {
      slug: t.slug,
      ten: t.ten,
      phanTram: g && g.thoi_luong ? Math.min(100, (g.vi_tri / g.thoi_luong) * 100) : 0,
      xong: !!g?.xong,
    }
  })

  return <LuoiTap slug={slug} server={server} tap={hien} dangXem={dangXem} />
}
