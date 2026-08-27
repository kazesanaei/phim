/**
 * Tìm và tải phụ đề từ OpenSubtitles cho phim trong máy.
 *
 * CẦN API KEY MIỄN PHÍ: đăng ký ở opensubtitles.com rồi dán vào Quản trị.
 * Không có key thì mọi hàm ở đây trả lỗi rõ ràng chứ không im lặng hỏng.
 *
 * Tài khoản miễn phí có hạn mức tải mỗi ngày — nên chỉ tải khi người dùng bấm,
 * không tự động quét cả thư viện.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { db, layCaiDat } from './db'
import { duongDanChoPhep, tenTepAnToan, LoiChan } from './an-toan'
import { srtSangVtt } from './phu-de'

const GOC = 'https://api.opensubtitles.com/api/v1'
const UNG_DUNG = 'KhoPhim v1.0'

export type PhuDeTim = {
  id: string
  ten: string
  ngonNgu: string
  luotTai: number
  danhGia: number
  soTapPhim: number | null
}

function layKhoa(): string {
  const k = layCaiDat('khoa_opensubtitles', '')
  if (!k) throw new LoiChan('Chưa có API key OpenSubtitles. Vào Quản trị để dán key (đăng ký miễn phí).')
  return k
}

function dauVao(): HeadersInit {
  return {
    'Api-Key': layKhoa(),
    'User-Agent': UNG_DUNG,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

export async function timPhuDe(tuKhoa: string, nam?: number, ngonNgu = 'vi'): Promise<PhuDeTim[]> {
  const u = new URL(GOC + '/subtitles')
  u.searchParams.set('query', tuKhoa)
  u.searchParams.set('languages', ngonNgu)
  if (nam) u.searchParams.set('year', String(nam))

  const r = await fetch(u, { headers: dauVao(), cache: 'no-store' })
  if (r.status === 401 || r.status === 403) throw new LoiChan('API key OpenSubtitles không hợp lệ')
  if (!r.ok) throw new Error('OpenSubtitles trả lỗi ' + r.status)

  const j = (await r.json()) as { data?: Record<string, unknown>[] }
  return (j.data ?? [])
    .map((m) => {
      const a = (m.attributes ?? {}) as Record<string, unknown>
      const tep = ((a.files as Record<string, unknown>[]) ?? [])[0]
      if (!tep?.file_id) return null
      return {
        id: String(tep.file_id),
        ten: String(tep.file_name || a.release || 'phụ đề'),
        ngonNgu: String(a.language || ngonNgu),
        luotTai: Number(a.download_count) || 0,
        danhGia: Number(a.ratings) || 0,
        soTapPhim: (a.feature_details as Record<string, number> | undefined)?.episode_number ?? null,
      }
    })
    .filter((x): x is PhuDeTim => x !== null)
    .sort((a, b) => b.luotTai - a.luotTai)
    .slice(0, 15)
}

/**
 * Tải một phụ đề về CẠNH file phim rồi ghi vào DB.
 * Lưu dạng .vtt đã chuẩn hoá — khỏi phải chuyển đổi mỗi lần phát.
 */
export async function taiPhuDeVe(tapId: number, fileId: string, nhan: string, ngonNgu = 'vi'): Promise<string> {
  const t = db.prepare('select duong_dan_file from tap where id = ?').get(tapId) as
    | { duong_dan_file: string | null }
    | undefined
  if (!t?.duong_dan_file) throw new LoiChan('Tập này không có file trong máy')
  // Chỉ được ghi vào thư mục nguồn đã đăng ký
  const tepPhim = duongDanChoPhep(t.duong_dan_file)

  const r = await fetch(GOC + '/download', {
    method: 'POST',
    headers: dauVao(),
    body: JSON.stringify({ file_id: Number(fileId) }),
  })
  if (r.status === 406) throw new LoiChan('Hết hạn mức tải trong ngày của tài khoản OpenSubtitles')
  if (!r.ok) throw new Error('Không xin được link tải (' + r.status + ')')

  const j = (await r.json()) as { link?: string }
  if (!j.link) throw new Error('OpenSubtitles không trả link tải')

  const noiDung = await (await fetch(j.link)).text()
  const goc = tepPhim.slice(0, tepPhim.length - path.extname(tepPhim).length)
  const dich = goc + '.' + tenTepAnToan(ngonNgu) + '.vtt'
  await writeFile(dich, srtSangVtt(noiDung), 'utf8')

  db.prepare('insert into phu_de (tap_id, ngon_ngu, nhan, duong_dan, mac_dinh) values (?, ?, ?, ?, 1)').run(
    tapId,
    ngonNgu === 'vi' ? 'vie' : ngonNgu,
    nhan.slice(0, 120),
    dich,
  )
  return dich
}
