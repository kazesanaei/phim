import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import { timPhuDe, taiPhuDeVe } from '@/lib/phu-de-ngoai'
import { layCaiDat, datCaiDat } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    chanCheoTrang(req)
    const sp = new URL(req.url).searchParams
    const tuKhoa = sp.get('q') || ''
    if (!tuKhoa) {
      // Không có từ khoá thì chỉ hỏi trạng thái key
      return Response.json({ coKhoa: !!layCaiDat('khoa_opensubtitles', '') })
    }
    const ds = await timPhuDe(tuKhoa, Number(sp.get('nam')) || undefined, sp.get('ngon-ngu') || 'vi')
    return Response.json({ ds })
  } catch (e) {
    return traLoiLoi(e)
  }
}

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    const b = (await req.json()) as Record<string, unknown>

    if (b.viec === 'dat-khoa') {
      datCaiDat('khoa_opensubtitles', String(b.khoa || '').trim())
      return Response.json({ ok: true, coKhoa: !!String(b.khoa || '').trim() })
    }

    const tapId = Number(b.tapId)
    const fileId = String(b.fileId || '')
    if (!tapId || !fileId) return Response.json({ loi: 'Thiếu tham số' }, { status: 400 })

    const duongDan = await taiPhuDeVe(tapId, fileId, String(b.nhan || 'Phụ đề'), String(b.ngonNgu || 'vi'))
    return Response.json({ ok: true, duongDan })
  } catch (e) {
    return traLoiLoi(e)
  }
}
