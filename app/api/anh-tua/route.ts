import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import { layAnhTua, sinhAnhTua, dangSinh } from '@/lib/anh-tua'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    chanCheoTrang(req)
    const id = Number(new URL(req.url).searchParams.get('tap'))
    if (!id) return Response.json({ loi: 'Thiếu tập' }, { status: 400 })
    return Response.json({ anh: layAnhTua(id), dangLam: dangSinh(id) })
  } catch (e) {
    return traLoiLoi(e)
  }
}

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    const b = (await req.json()) as { tap?: number }
    const id = Number(b.tap)
    if (!id) return Response.json({ loi: 'Thiếu tập' }, { status: 400 })
    const kq = await sinhAnhTua(id)
    return Response.json({ ok: true, trangThai: kq, anh: layAnhTua(id) })
  } catch (e) {
    return traLoiLoi(e)
  }
}
