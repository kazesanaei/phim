/**
 * Giải mã một link_embed của nguồn thành thứ player dùng được.
 * Phần nặng nằm ở lib/nguon-phat.ts vì bộ tải offline cũng cần đúng logic đó.
 */
import { traLoiLoi } from '@/lib/an-toan'
import { giaiMaEmbed, LoiNguon } from '@/lib/nguon-phat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const embed = new URL(req.url).searchParams.get('embed') || ''
    const kq = await giaiMaEmbed(embed)
    return Response.json(kq, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    if (e instanceof LoiNguon) return Response.json({ loi: e.message }, { status: 502 })
    return traLoiLoi(e)
  }
}
