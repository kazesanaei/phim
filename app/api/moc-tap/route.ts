/**
 * Mốc intro / đoạn kết TỰ NHẬN của một tập (lib/tu-dong-intro.ts).
 *
 * Trình phát hỏi lại vài nhịp khi chưa có: phân tích một cặp tập mất 1–2 phút,
 * mà người xem thường bấm phát trước khi xong. Hỏi lần đầu mà chưa từng phân
 * tích thì xếp vào hàng luôn.
 */
import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import { layMocTap, xepHangPhanTich } from '@/lib/tu-dong-intro'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    chanCheoTrang(req)
    const sp = new URL(req.url).searchParams
    const slug = sp.get('slug') || ''
    const tap = sp.get('tap') || ''
    const server = Math.max(0, Number(sp.get('server')) || 0)
    if (!slug || !tap) return Response.json({ loi: 'Thiếu slug hoặc tập' }, { status: 400 })

    let m = layMocTap(slug, tap)
    if (m.trangThai === 'chua' || m.trangThai === 'loi') {
      xepHangPhanTich(slug, tap, server)
      m = layMocTap(slug, tap)
    }
    return Response.json(m, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return traLoiLoi(e)
  }
}
