/**
 * Mốc opening / ending tự động cho anime (AniSkip) — trình phát gọi sau khi mở.
 * Phim không phải anime, phim trong máy, hay không dò ra thì trả rỗng: trình phát
 * chỉ đơn giản là không có nút tự động.
 */
import { layChiTiet } from '@/lib/nguon'
import { layMalId, layMocTap } from '@/lib/aniskip'
import { laAnime, soTapAniSkip } from '@/lib/aniskip-khop'
import { traLoiLoi } from '@/lib/an-toan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RONG = { op: null, ed: null, malId: null }

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams
    const slug = String(sp.get('slug') || '')
    if (!/^[a-z0-9-]{1,200}$/.test(slug) || slug.startsWith('local-')) return Response.json(RONG)

    const ct = await layChiTiet(slug)
    if (!ct || !laAnime(ct.theLoai, ct.quocGia)) return Response.json(RONG)

    const malId = await layMalId(slug, { tenGoc: ct.tenGoc, ten: ct.ten, nam: ct.nam, laBo: ct.loai === 'bo' })
    if (!malId) return Response.json(RONG)

    const moc = await layMocTap(malId, soTapAniSkip(String(sp.get('tap') || '1')))
    return Response.json({ ...moc, malId }, { headers: { 'cache-control': 'private, max-age=300' } })
  } catch (e) {
    return traLoiLoi(e)
  }
}
