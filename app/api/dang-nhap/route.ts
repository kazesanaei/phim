import { cookies } from 'next/headers'
import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import { dungMatKhau, taoVePhien, TEN_COOKIE, laCheDoLan, daDatMatKhau } from '@/lib/xac-thuc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Chống dò mật khẩu: đếm số lần sai theo tiến trình, chờ lâu dần. */
let soLanSai = 0
let khoaToi = 0

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    if (!laCheDoLan() || !daDatMatKhau()) {
      return Response.json({ ok: true, boQua: true })
    }

    if (Date.now() < khoaToi) {
      const giay = Math.ceil((khoaToi - Date.now()) / 1000)
      return Response.json({ loi: `Sai nhiều lần, thử lại sau ${giay} giây` }, { status: 429 })
    }

    const b = (await req.json()) as { matKhau?: string }
    if (!dungMatKhau(String(b.matKhau || ''))) {
      soLanSai++
      // Chờ lâu dần: 3 lần sai đầu bỏ qua, sau đó mỗi lần cộng thêm
      if (soLanSai > 3) khoaToi = Date.now() + Math.min(60, (soLanSai - 3) * 5) * 1000
      return Response.json({ loi: 'Mật khẩu không đúng' }, { status: 401 })
    }

    soLanSai = 0
    khoaToi = 0
    const ve = taoVePhien()
    const kho = await cookies()
    kho.set(ve.ten, ve.giaTri, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ve.hanGiay,
    })
    return Response.json({ ok: true })
  } catch (e) {
    return traLoiLoi(e)
  }
}

export async function DELETE(req: Request) {
  try {
    chanCheoTrang(req)
    const kho = await cookies()
    kho.delete(TEN_COOKIE)
    return Response.json({ ok: true })
  } catch (e) {
    return traLoiLoi(e)
  }
}
