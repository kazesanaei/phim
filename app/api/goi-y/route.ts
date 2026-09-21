/**
 * Gợi ý cho ô tìm kiếm: tên phim trong kho đệm + tên diễn viên / đạo diễn.
 *
 * Chỉ đọc kho trong máy, không gọi ra nguồn — gõ tới đâu gợi ý tới đó mà không
 * bắn hàng chục yêu cầu ra mạng. Nguồn cũng không tra được theo tên người
 * (đã thử, xem chú thích đầu lib/quet-nguoi.ts), nên phần người BẮT BUỘC lấy
 * từ chỉ mục tự dựng.
 */
import { chanCheoTrang, traLoiLoi } from '@/lib/an-toan'
import { locKho, veTom } from '@/lib/kho-nguon'
import { timTenNguoi } from '@/lib/quet-nguoi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SO_PHIM = 6
const SO_NGUOI = 5

export async function GET(req: Request) {
  try {
    chanCheoTrang(req)
    const q = (new URL(req.url).searchParams.get('q') || '').trim()
    if (q.length < 2) return Response.json({ phim: [], nguoi: [] })

    const kho = locKho({ tim: q, moiTrang: SO_PHIM, trang: 1, gomPhan: true })

    return Response.json(
      {
        phim: kho.items.map(veTom).map((p) => ({
          slug: p.slug,
          ten: p.ten,
          nam: p.nam,
          poster: p.poster,
        })),
        nguoi: timTenNguoi(q, SO_NGUOI),
      },
      // Gõ nhanh thì cùng một tiền tố bị hỏi lại nhiều lần; đệm ngắn là đủ.
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    )
  } catch (e) {
    return traLoiLoi(e)
  }
}
