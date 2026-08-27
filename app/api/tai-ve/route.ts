import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import { danhSachTai, themVaoHangDoi, huyTai, xoaKhoiDanhSach, chayTiep, type YeuCauTai } from '@/lib/tai-ve'
import { coFfmpeg } from '@/lib/ffmpeg'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return Response.json({ ds: danhSachTai(), coFfmpeg: coFfmpeg() })
  } catch (e) {
    return traLoiLoi(e)
  }
}

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    const b = (await req.json()) as Record<string, unknown>
    const viec = String(b.viec || '')

    if (viec === 'them') {
      if (!coFfmpeg()) {
        return Response.json({ loi: 'Chưa có ffmpeg nên không tải về được.' }, { status: 400 })
      }
      const ds = (b.ds as YeuCauTai[]) || []
      const them = themVaoHangDoi(ds)
      return Response.json({ ok: true, them })
    }

    const id = Number(b.id)
    if (!id) return Response.json({ loi: 'Thiếu id' }, { status: 400 })

    if (viec === 'huy') {
      huyTai(id)
      return Response.json({ ok: true })
    }
    if (viec === 'xoa') {
      xoaKhoiDanhSach(id, b.xoaCaFile === true)
      return Response.json({ ok: true })
    }
    if (viec === 'chay-lai') {
      db.prepare("update tai_ve set trang_thai = 'cho', loi = null, phan_tram = 0 where id = ?").run(id)
      chayTiep()
      return Response.json({ ok: true })
    }

    return Response.json({ loi: 'Việc không hợp lệ' }, { status: 400 })
  } catch (e) {
    return traLoiLoi(e)
  }
}
