/** Mọi thao tác quản trị kho phim local: thư mục nguồn, quét, sửa metadata, gom tập. */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { db, thuMucNguon, layCaiDat, datCaiDat } from '@/lib/db'
import { traLoiLoi, duongDanChoPhep, chanCheoTrang, LoiChan } from '@/lib/an-toan'
import { khongDau } from '@/lib/khong-dau'
import { quetTatCa, demVideo } from '@/lib/quet'
import { coFfmpeg, trichKhungHinh } from '@/lib/ffmpeg'
import { timKiem, layChiTiet } from '@/lib/vsmov'
import { phimLocal, tapCuaPhim, layHangPhim } from '@/lib/thu-vien'
import { batDauQuet, dungQuet, xoaKho, tienDoQuet } from '@/lib/kho-nguon'
import { batDauQuetNguoi, dungQuetNguoi, xoaChiMucNguoi, tienDoQuetNguoi } from '@/lib/quet-nguoi'
import { quetSlug18 } from '@/lib/nguon-kkphim'
import { themVaoSoDen, demSoDen, donKho18 } from '@/lib/loc-18'
import { nguonDangBat, NGUON } from '@/lib/nguon'
import { datMatKhau, xoaMatKhau, laCheDoLan, daDatMatKhau } from '@/lib/xac-thuc'
import { networkInterfaces } from 'node:os'
import { mkdir } from 'node:fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams
    if (sp.get('phim')) {
      const kq = phimLocal({ tim: sp.get('tim') || undefined, trang: Number(sp.get('trang') || 1), moiTrang: 50 })
      return Response.json(kq)
    }
    if (sp.get('tap')) {
      // Trả kèm phimId: giao diện quản trị cần id thật, và phim mới quét có thể
      // chưa có tập nào để mà suy ngược ra.
      const h = layHangPhim(String(sp.get('tap')))
      return Response.json({ phimId: h?.id ?? null, phim: h ?? null, tap: h ? tapCuaPhim(h.id) : [] })
    }
    return Response.json({
      thuMuc: thuMucNguon(false),
      soPhim: (db.prepare('select count(*) as n from phim').get() as { n: number }).n,
      soTap: (db.prepare('select count(*) as n from tap').get() as { n: number }).n,
      coFfmpeg: coFfmpeg(),
      soViecTai: layCaiDat('so_viec_tai', '1'),
      kho: (() => {
        const k = tienDoQuet()
        // Tự hồi phục: cờ còn 'dang' mà nhịp tim đã tắt nghĩa là vòng lặp chết
        // giữa chừng (hay gặp khi hot-reload lúc đang quét). Khởi động lại luôn.
        if (k.treo) void batDauQuet()
        return k
      })(),
      nguoi: (() => {
        const n = tienDoQuetNguoi()
        // Cùng cơ chế tự hồi phục như kho đệm: nhịp tim tắt thì chạy lại.
        if (n.treo) void batDauQuetNguoi()
        return n
      })(),
      nguon: { danhSach: NGUON, dangBat: nguonDangBat(), soChan18: demSoDen() },
      lan: {
        bat: laCheDoLan(),
        coMatKhau: daDatMatKhau(),
        diaChi: Object.values(networkInterfaces())
          .flatMap((ds) => ds ?? [])
          .filter((m) => m.family === 'IPv4' && !m.internal)
          .map((m) => `http://${m.address}:3000`),
      },
    })
  } catch (e) {
    return traLoiLoi(e)
  }
}

export async function POST(req: Request) {
  try {
    chanCheoTrang(req)
    const b = (await req.json()) as Record<string, unknown>
    const viec = String(b.viec || '')

    // ---- thư mục nguồn -------------------------------------------------
    if (viec === 'kiem-thu-muc') {
      const d = String(b.duongDan || '').trim()
      if (!d) return Response.json({ loi: 'Thiếu đường dẫn' }, { status: 400 })
      const so = await demVideo(d)
      if (so < 0) return Response.json({ ok: false, tin: 'Không thấy thư mục này trên ổ đĩa' })
      return Response.json({ ok: true, so, tin: `Thấy ${so} file video` })
    }

    if (viec === 'them-thu-muc') {
      const d = path.resolve(String(b.duongDan || '').trim())
      if (!d || !existsSync(d)) return Response.json({ loi: 'Không thấy thư mục này' }, { status: 400 })
      db.prepare('insert or ignore into nguon_thu_muc (duong_dan, bat) values (?, 1)').run(d)
      if (b.laThuMucTai) {
        db.prepare('update nguon_thu_muc set la_thu_muc_tai = 0').run()
        db.prepare('update nguon_thu_muc set la_thu_muc_tai = 1 where duong_dan = ?').run(d)
      }
      return Response.json({ ok: true, thuMuc: thuMucNguon(false) })
    }

    if (viec === 'sua-thu-muc') {
      const id = Number(b.id)
      if (typeof b.bat === 'boolean') db.prepare('update nguon_thu_muc set bat = ? where id = ?').run(b.bat ? 1 : 0, id)
      if (b.laThuMucTai === true) {
        db.prepare('update nguon_thu_muc set la_thu_muc_tai = 0').run()
        db.prepare('update nguon_thu_muc set la_thu_muc_tai = 1 where id = ?').run(id)
      }
      return Response.json({ ok: true, thuMuc: thuMucNguon(false) })
    }

    if (viec === 'xoa-thu-muc') {
      db.prepare('delete from nguon_thu_muc where id = ?').run(Number(b.id))
      return Response.json({ ok: true, thuMuc: thuMucNguon(false) })
    }

    if (viec === 'quet') {
      const kq = await quetTatCa()
      return Response.json({ ok: true, kq })
    }

    if (viec === 'quet-kho') {
      await batDauQuet(b.lamLai === true)
      return Response.json({ ok: true, kho: tienDoQuet() })
    }
    if (viec === 'dung-quet-kho') {
      dungQuet()
      return Response.json({ ok: true, kho: tienDoQuet() })
    }
    if (viec === 'xoa-kho') {
      xoaKho()
      return Response.json({ ok: true, kho: tienDoQuet() })
    }

    if (viec === 'quet-nguoi') {
      await batDauQuetNguoi(b.lamLai === true)
      return Response.json({ ok: true, nguoi: tienDoQuetNguoi() })
    }
    if (viec === 'dung-quet-nguoi') {
      dungQuetNguoi()
      return Response.json({ ok: true, nguoi: tienDoQuetNguoi() })
    }
    if (viec === 'xoa-chi-muc-nguoi') {
      xoaChiMucNguoi()
      return Response.json({ ok: true, nguoi: tienDoQuetNguoi() })
    }

    if (viec === 'quet-18') {
      const ds = await quetSlug18()
      themVaoSoDen(ds)
      // Quét sổ đen xong thì dọn luôn kho: phim lọt lưới CŨ vẫn còn nằm đó,
      // không dọn thì siết lưới mấy cũng vô ích với dữ liệu đã ghi.
      const don = donKho18()
      return Response.json({ ok: true, them: ds.length, don, tong: demSoDen() })
    }

    if (viec === 'nguon-bat') {
      const ds = (b.ds as string[]) || []
      const hopLe = ds.filter((x) => NGUON.some((n) => n.ma === x))
      // Tắt hết thì không còn gì để xem — giữ lại ít nhất một nguồn
      datCaiDat('nguon_bat', (hopLe.length ? hopLe : ['vsmov']).join(','))
      return Response.json({ ok: true, dangBat: nguonDangBat() })
    }

    if (viec === 'che-do-lan') {
      if (b.bat === true) {
        const mk = String(b.matKhau || '')
        if (!mk && !daDatMatKhau()) {
          return Response.json({ loi: 'Phải đặt mật khẩu trước khi mở ra LAN' }, { status: 400 })
        }
        if (mk) datMatKhau(mk)
        datCaiDat('che_do_lan', 'bat')
      } else {
        datCaiDat('che_do_lan', '')
        if (b.xoaMatKhau === true) xoaMatKhau()
      }
      return Response.json({ ok: true })
    }

    if (viec === 'cai-dat') {
      if (typeof b.soViecTai === 'string') datCaiDat('so_viec_tai', b.soViecTai)
      if (typeof b.duongDanFfmpeg === 'string') datCaiDat('duong_dan_ffmpeg', b.duongDanFfmpeg)
      if (typeof b.duongDanFfprobe === 'string') datCaiDat('duong_dan_ffprobe', b.duongDanFfprobe)
      return Response.json({ ok: true })
    }

    // ---- sửa metadata ---------------------------------------------------
    if (viec === 'sua-phim') {
      const id = Number(b.id)
      const ten = String(b.ten || '').trim()
      if (!id || !ten) return Response.json({ loi: 'Thiếu tên phim' }, { status: 400 })
      db.prepare(
        `update phim set ten = ?, ten_goc = ?, nam = ?, loai = ?, mo_ta = ?, poster = ?, ten_khong_dau = ?, sua_tay = 1
         where id = ?`,
      ).run(
        ten,
        (b.tenGoc as string) || null,
        Number(b.nam) || null,
        b.loai === 'bo' ? 'bo' : 'le',
        (b.moTa as string) || null,
        (b.poster as string) || null,
        khongDau(ten),
        id,
      )
      if (Array.isArray(b.theLoai)) {
        db.prepare('delete from the_loai where phim_id = ?').run(id)
        for (const t of b.theLoai as { ten: string; slug: string }[]) {
          if (t?.ten) {
            db.prepare('insert or ignore into the_loai (phim_id, ten, slug) values (?, ?, ?)').run(
              id,
              t.ten,
              t.slug || khongDau(t.ten).replace(/[^a-z0-9]+/g, '-'),
            )
          }
        }
      }
      if (Array.isArray(b.quocGia)) {
        db.prepare('delete from quoc_gia where phim_id = ?').run(id)
        for (const q of b.quocGia as { ten: string; slug: string }[]) {
          if (q?.ten) {
            db.prepare('insert or ignore into quoc_gia (phim_id, ten, slug) values (?, ?, ?)').run(
              id,
              q.ten,
              q.slug || khongDau(q.ten).replace(/[^a-z0-9]+/g, '-'),
            )
          }
        }
      }
      return Response.json({ ok: true })
    }

    if (viec === 'tra-metadata') {
      const tuKhoa = String(b.tuKhoa || '').trim()
      if (!tuKhoa) return Response.json({ loi: 'Thiếu từ khoá' }, { status: 400 })
      const kq = await timKiem(tuKhoa, 1, 8)
      return Response.json({ items: kq.items })
    }

    if (viec === 'ap-metadata') {
      const id = Number(b.id)
      const slug = String(b.slugNguon || '')
      const ct = await layChiTiet(slug)
      if (!id || !ct) return Response.json({ loi: 'Không lấy được thông tin phim' }, { status: 400 })
      db.prepare(
        `update phim set ten = ?, ten_goc = ?, nam = ?, poster = ?, backdrop = ?, mo_ta = ?, ten_khong_dau = ?, sua_tay = 1
         where id = ?`,
      ).run(ct.ten, ct.tenGoc || null, ct.nam || null, ct.poster || null, ct.anhNgang || null, ct.moTa || null, khongDau(ct.ten), id)
      db.prepare('delete from the_loai where phim_id = ?').run(id)
      db.prepare('delete from quoc_gia where phim_id = ?').run(id)
      for (const t of ct.theLoai) {
        db.prepare('insert or ignore into the_loai (phim_id, ten, slug) values (?, ?, ?)').run(id, t.ten, t.slug)
      }
      for (const q of ct.quocGia) {
        db.prepare('insert or ignore into quoc_gia (phim_id, ten, slug) values (?, ?, ?)').run(id, q.ten, q.slug)
      }
      return Response.json({ ok: true })
    }

    if (viec === 'trich-poster') {
      const id = Number(b.id)
      const h = db.prepare('select slug from phim where id = ?').get(id) as { slug: string } | undefined
      const t = db.prepare('select duong_dan_file from tap where phim_id = ? order by so_tap limit 1').get(id) as
        | { duong_dan_file: string | null }
        | undefined
      if (!h || !t?.duong_dan_file) return Response.json({ loi: 'Không có file để trích' }, { status: 400 })
      const thuMucAnh = path.join(process.cwd(), 'public', 'poster')
      await mkdir(thuMucAnh, { recursive: true })
      const anh = path.join(thuMucAnh, h.slug + '.jpg')
      const giay = Number(b.giay) || 180
      const ok = await trichKhungHinh(duongDanChoPhep(t.duong_dan_file), anh, giay)
      if (!ok) return Response.json({ loi: 'ffmpeg không trích được khung hình' }, { status: 500 })
      const url = '/poster/' + h.slug + '.jpg?v=' + Date.now()
      db.prepare('update phim set poster = ?, sua_tay = 1 where id = ?').run(url, id)
      return Response.json({ ok: true, poster: url })
    }

    // ---- gom tập / xoá ---------------------------------------------------
    if (viec === 'gom-tap') {
      const ids = (b.ids as number[]) || []
      if (ids.length < 2) return Response.json({ loi: 'Chọn ít nhất 2 phim để gom' }, { status: 400 })
      const chinh = ids[0]
      const ten = String(b.ten || '').trim() || (layHangPhim2(chinh)?.ten ?? 'Phim bộ')
      let so = 1
      for (const id of ids) {
        for (const t of tapCuaPhim(id)) {
          db.prepare('update tap set phim_id = ?, so_tap = ?, ten = ? where id = ?').run(chinh, so, String(so), t.id)
          so++
        }
      }
      db.prepare("update phim set loai = 'bo', ten = ?, ten_khong_dau = ?, sua_tay = 1 where id = ?").run(
        ten,
        khongDau(ten),
        chinh,
      )
      for (const id of ids.slice(1)) db.prepare('delete from phim where id = ?').run(id)
      return Response.json({ ok: true, soTap: so - 1 })
    }

    if (viec === 'doi-so-tap') {
      db.prepare('update tap set so_tap = ?, ten = ? where id = ?').run(
        Number(b.soTap) || 1,
        String(b.ten || b.soTap || ''),
        Number(b.tapId),
      )
      return Response.json({ ok: true })
    }

    if (viec === 'gan-phu-de') {
      const tapId = Number(b.tapId)
      const d = duongDanChoPhep(String(b.duongDan || ''))
      if (!/[.](srt|vtt)$/i.test(d)) throw new LoiChan('Chỉ nhận file .srt hoặc .vtt')
      if (!existsSync(d)) return Response.json({ loi: 'Không thấy file phụ đề' }, { status: 400 })
      db.prepare('insert into phu_de (tap_id, ngon_ngu, nhan, duong_dan, mac_dinh) values (?, ?, ?, ?, 1)').run(
        tapId,
        String(b.ngonNgu || 'vie'),
        String(b.nhan || path.basename(d)),
        d,
      )
      return Response.json({ ok: true })
    }

    if (viec === 'xoa-phu-de') {
      db.prepare('delete from phu_de where id = ?').run(Number(b.id))
      return Response.json({ ok: true })
    }

    if (viec === 'xoa-phim') {
      const id = Number(b.id)
      if (b.xoaCaFile === true) {
        for (const t of tapCuaPhim(id)) {
          if (t.duong_dan_file && existsSync(t.duong_dan_file)) {
            // Chỉ được xoá file nằm trong thư mục nguồn đã đăng ký.
            await unlink(duongDanChoPhep(t.duong_dan_file, false)).catch(() => {})
          }
        }
      }
      db.prepare('delete from phim where id = ?').run(id)
      return Response.json({ ok: true })
    }

    return Response.json({ loi: 'Việc không hợp lệ: ' + viec }, { status: 400 })
  } catch (e) {
    return traLoiLoi(e)
  }
}

function layHangPhim2(id: number): { ten: string } | undefined {
  return db.prepare('select ten from phim where id = ?').get(id) as { ten: string } | undefined
}
