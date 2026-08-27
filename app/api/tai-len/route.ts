/**
 * Nhận file kéo thả từ trình duyệt và ghi thẳng ra ổ đĩa theo luồng.
 *
 * Không dùng req.formData() vì nó nạp trọn file vào RAM — phim vài GB là sập.
 * Client gửi thân request là chính file, tên và thư mục đích đi qua query.
 */
import { createWriteStream } from 'node:fs'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { traLoiLoi, tenTepAnToan, chanCheoTrang, LoiChan } from '@/lib/an-toan'
import { thuMucNguon } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DUOI_CHO_PHEP = new Set([
  '.mp4',
  '.mkv',
  '.webm',
  '.m4v',
  '.avi',
  '.mov',
  '.ts',
  '.srt',
  '.vtt',
])

export async function POST(req: Request) {
  let dich = ''
  try {
    chanCheoTrang(req)
    const sp = new URL(req.url).searchParams
    const idThuMuc = Number(sp.get('thuMuc'))
    const ten = tenTepAnToan(sp.get('ten') || '')

    const duoi = path.extname(ten).toLowerCase()
    if (!DUOI_CHO_PHEP.has(duoi)) {
      throw new LoiChan('Chỉ nhận file video hoặc phụ đề, không nhận ' + (duoi || 'file không đuôi'))
    }

    const goc = thuMucNguon(false).find((t) => t.id === idThuMuc)
    if (!goc) throw new LoiChan('Thư mục đích không nằm trong danh sách nguồn đã đăng ký')
    if (!existsSync(goc.duong_dan)) throw new LoiChan('Thư mục đích không còn trên ổ đĩa')

    dich = path.join(goc.duong_dan, ten)
    if (existsSync(dich)) return Response.json({ loi: 'File đã tồn tại: ' + ten }, { status: 409 })
    if (!req.body) return Response.json({ loi: 'Không có dữ liệu' }, { status: 400 })

    await pipeline(Readable.fromWeb(req.body as never), createWriteStream(dich))
    return Response.json({ ok: true, duongDan: dich })
  } catch (e) {
    // Đứt giữa chừng thì đừng để lại file rác trong thư mục phim.
    if (dich && existsSync(dich)) await unlink(dich).catch(() => {})
    return traLoiLoi(e)
  }
}
