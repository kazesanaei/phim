/** Tiến độ xem, yêu thích, xem sau. Tất cả nằm trong SQLite nên không mất khi đổi trình duyệt. */
import { db } from '@/lib/db'
import { traLoiLoi, chanCheoTrang } from '@/lib/an-toan'
import {
  layTienDo,
  danhSachTiepTuc,
  danhDauTheoLoai,
  datMocIntro,
  xoaMocIntro,
  dangTheoDoi,
} from '@/lib/theo-doi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams
    const khoa = sp.get('khoa')
    if (khoa) return Response.json({ xem: layTienDo(khoa) })
    return Response.json({
      tiepTuc: danhSachTiepTuc(),
      thich: danhDauTheoLoai('thich'),
      xemSau: danhDauTheoLoai('xem_sau'),
    })
  } catch (e) {
    return traLoiLoi(e)
  }
}

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    const b = (await req.json()) as Record<string, unknown>
    const viec = String(b.viec || 'tien-do')

    if (viec === 'tien-do') {
      const khoa = String(b.khoa || '')
      if (!khoa) return Response.json({ loi: 'Thiếu khoá' }, { status: 400 })
      const viTri = Number(b.viTri) || 0
      const thoiLuong = Number(b.thoiLuong) || 0
      // Xem quá 90% thì coi như đã xem xong, không hiện lại ở "Tiếp tục xem".
      const xong = thoiLuong > 0 && viTri / thoiLuong > 0.9 ? 1 : 0
      db.prepare(
        `insert into xem (khoa, slug, tap, ten, poster, anh_ngang, nguon, vi_tri, thoi_luong, xong, cap_nhat)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         on conflict(khoa) do update set
           vi_tri = excluded.vi_tri,
           thoi_luong = excluded.thoi_luong,
           xong = excluded.xong,
           ten = coalesce(excluded.ten, xem.ten),
           poster = coalesce(excluded.poster, xem.poster),
           anh_ngang = coalesce(excluded.anh_ngang, xem.anh_ngang),
           cap_nhat = datetime('now')`,
      ).run(
        khoa,
        String(b.slug || ''),
        (b.tap as string) || null,
        (b.ten as string) || null,
        (b.poster as string) || null,
        // Ảnh ngang cho thẻ 16:9 ở chế độ TV; poster dọc thì cho thẻ 2:3 ở PC.
        (b.anhNgang as string) || null,
        String(b.nguon || 'vsmov'),
        viTri,
        thoiLuong,
        xong,
      )
      return Response.json({ ok: true, xong: !!xong })
    }

    if (viec === 'danh-dau') {
      const khoa = String(b.khoa || '')
      const loai = String(b.loai || '')
      if (!khoa || !['thich', 'xem_sau'].includes(loai)) {
        return Response.json({ loi: 'Tham số không hợp lệ' }, { status: 400 })
      }
      const dangCo = db.prepare('select 1 from danh_dau where khoa = ? and loai = ?').get(khoa, loai)
      if (dangCo) {
        db.prepare('delete from danh_dau where khoa = ? and loai = ?').run(khoa, loai)
        return Response.json({ ok: true, bat: false })
      }
      db.prepare(
        'insert into danh_dau (khoa, loai, ten, poster, nam, nguon) values (?, ?, ?, ?, ?, ?)',
      ).run(
        khoa,
        loai,
        (b.ten as string) || null,
        (b.poster as string) || null,
        Number(b.nam) || null,
        String(b.nguon || 'vsmov'),
      )
      return Response.json({ ok: true, bat: true })
    }

    if (viec === 'xoa-tien-do') {
      db.prepare('delete from xem where khoa = ?').run(String(b.khoa || ''))
      return Response.json({ ok: true })
    }

    if (viec === 'moc-intro') {
      const slug = String(b.slug || '')
      if (!slug) return Response.json({ loi: 'Thiếu slug' }, { status: 400 })
      const batDau = Number(b.batDau)
      const ketThuc = Number(b.ketThuc)
      if (!Number.isFinite(batDau) || !Number.isFinite(ketThuc) || ketThuc <= batDau) {
        return Response.json({ loi: 'Mốc intro không hợp lệ' }, { status: 400 })
      }
      datMocIntro(slug, batDau, ketThuc)
      return Response.json({ ok: true })
    }

    if (viec === 'xoa-moc-intro') {
      xoaMocIntro(String(b.slug || ''))
      return Response.json({ ok: true })
    }

    if (viec === 'theo-doi') {
      const slug = String(b.slug || '')
      if (!slug) return Response.json({ loi: 'Thiếu slug' }, { status: 400 })
      if (dangTheoDoi(slug)) {
        db.prepare('delete from theo_doi where slug = ?').run(slug)
        return Response.json({ ok: true, bat: false })
      }
      db.prepare(
        `insert into theo_doi (slug, ten, poster, tap_da_biet, kiem_luc)
         values (?, ?, ?, ?, datetime('now'))`,
      ).run(slug, (b.ten as string) || null, (b.poster as string) || null, (b.tapHienTai as string) || null)
      return Response.json({ ok: true, bat: true })
    }

    return Response.json({ loi: 'Việc không hợp lệ' }, { status: 400 })
  } catch (e) {
    return traLoiLoi(e)
  }
}
