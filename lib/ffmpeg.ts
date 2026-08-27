/**
 * Lớp gọi ffmpeg / ffprobe.
 *
 * NGUYÊN TẮC BẤT DI BẤT DỊCH: luôn truyền tham số bằng MẢNG argv, không bao giờ
 * nối chuỗi rồi cho qua shell. Tên file phim là dữ liệu người dùng kiểm soát;
 * nối chuỗi ở đây là mở cửa cho chèn lệnh.
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { layCaiDat } from './db'
import { bocVoTS, docSegment } from './hls'

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const daTim: Record<string, string> = {}

function ungVien(ten: string): string[] {
  const ds: string[] = []
  const la = process.env.LOCALAPPDATA
  if (!la) return ds
  ds.push(path.join(la, 'Microsoft', 'WinGet', 'Links', ten + '.exe'))
  const goi = path.join(la, 'Microsoft', 'WinGet', 'Packages')
  try {
    for (const d of readdirSync(goi)) {
      if (!d.startsWith('Gyan.FFmpeg')) continue
      for (const b of readdirSync(path.join(goi, d))) {
        ds.push(path.join(goi, d, b, 'bin', ten + '.exe'))
      }
    }
  } catch {
    // chưa cài qua winget thì bỏ qua
  }
  return ds
}

/** Tìm đường dẫn thật của ffmpeg/ffprobe. PATH vừa cài chưa chắc đã có trong tiến trình này. */
export function timLenh(ten: 'ffmpeg' | 'ffprobe'): string {
  if (daTim[ten]) return daTim[ten]
  const datTay = layCaiDat('duong_dan_' + ten)
  if (datTay && existsSync(datTay)) return (daTim[ten] = datTay)
  const thu = spawnSync(ten, ['-version'], { windowsHide: true })
  if (!thu.error) return (daTim[ten] = ten)
  for (const c of ungVien(ten)) {
    if (existsSync(c)) return (daTim[ten] = c)
  }
  throw new Error(ten + ' chưa cài hoặc chưa có trong PATH')
}

export function coFfmpeg(): boolean {
  try {
    timLenh('ffmpeg')
    timLenh('ffprobe')
    return true
  } catch {
    return false
  }
}

/** Một luồng trong file: tiếng hoặc phụ đề nhúng. */
export type LuongTep = {
  /** Chỉ số TRONG NHÓM cùng loại (a:0, a:1...) — đúng cái ffmpeg cần cho -map. */
  chiSo: number
  loai: 'audio' | 'subtitle'
  codec?: string
  ngonNgu?: string
  nhan?: string
  macDinh?: boolean
}

export type ThongTinTep = {
  thoiLuong: number
  codecV?: string
  codecA?: string
  rong?: number
  cao?: number
  luong?: LuongTep[]
}

export function docThongTin(tep: string): Promise<ThongTinTep | null> {
  return new Promise((giaiQuyet) => {
    let lenh: string
    try {
      lenh = timLenh('ffprobe')
    } catch {
      return giaiQuyet(null)
    }
    const p = spawn(lenh, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', tep], {
      windowsHide: true,
    })
    let ra = ''
    p.stdout.on('data', (d) => (ra += d))
    p.on('error', () => giaiQuyet(null))
    p.on('close', () => {
      try {
        const j = JSON.parse(ra)
        const luong = (j.streams || []) as Record<string, unknown>[]
        const v = luong.find((s) => s.codec_type === 'video')
        const a = luong.find((s) => s.codec_type === 'audio')

        // Đánh số lại theo TỪNG NHÓM: ffmpeg -map dùng a:0, a:1, s:0... chứ
        // không dùng chỉ số tuyệt đối trong file.
        const demTheoLoai: Record<string, number> = { audio: 0, subtitle: 0 }
        const ds: LuongTep[] = []
        for (const s of luong) {
          const loai = s.codec_type as string
          if (loai !== 'audio' && loai !== 'subtitle') continue
          const tags = (s.tags || {}) as Record<string, string>
          ds.push({
            chiSo: demTheoLoai[loai]++,
            loai,
            codec: s.codec_name as string | undefined,
            ngonNgu: tags.language,
            nhan: tags.title,
            macDinh: !!(s.disposition as Record<string, number> | undefined)?.default,
          })
        }

        giaiQuyet({
          thoiLuong: Number(j.format?.duration) || 0,
          codecV: v?.codec_name as string | undefined,
          codecA: a?.codec_name as string | undefined,
          rong: v?.width as number | undefined,
          cao: v?.height as number | undefined,
          luong: ds,
        })
      } catch {
        giaiQuyet(null)
      }
    })
  })
}

const VIDEO_OK = new Set(['h264', 'vp8', 'vp9', 'av1'])
const AM_OK = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac'])
const HOP_OK = new Set(['.mp4', '.m4v', '.webm', '.mov'])

/** Trình duyệt phát thẳng được file này, hay phải chuyển mã? */
export function canChuyenMa(tep: string, tt: ThongTinTep | null): boolean {
  const duoi = path.extname(tep).toLowerCase()
  if (!tt) return !HOP_OK.has(duoi)
  return !(
    HOP_OK.has(duoi) &&
    (!tt.codecV || VIDEO_OK.has(tt.codecV)) &&
    (!tt.codecA || AM_OK.has(tt.codecA))
  )
}

/**
 * Chuyển mã theo yêu cầu, đẩy fMP4 thẳng ra luồng cho thẻ video.
 * `trackAm` chọn luồng tiếng thứ mấy — file .mkv thường có 2-3 thứ tiếng, mà
 * trình duyệt chỉ phát được luồng mặc định nên đổi tiếng buộc phải chuyển mã.
 */
export function luongChuyenMa(tep: string, batDau = 0, trackAm = 0): ChildProcessWithoutNullStreams {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    ...(batDau > 0 ? ['-ss', String(batDau)] : []),
    '-i',
    tep,
    '-map',
    '0:v:0',
    '-map',
    `0:a:${Math.max(0, trackAm)}?`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ac',
    '2',
    '-f',
    'mp4',
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1',
  ]
  return spawn(timLenh('ffmpeg'), args, { windowsHide: true })
}

function motKhungHinh(lenh: string, tep: string, raAnh: string, giay: number): Promise<boolean> {
  return new Promise((giaiQuyet) => {
    const p = spawn(
      lenh,
      ['-hide_banner', '-loglevel', 'error', '-ss', String(giay), '-i', tep, '-frames:v', '1', '-q:v', '4', '-y', raAnh],
      { windowsHide: true },
    )
    p.on('error', () => giaiQuyet(false))
    p.on('close', (ma) => giaiQuyet(ma === 0 && existsSync(raAnh)))
  })
}

/**
 * Trích một khung hình làm poster cho phim local không tra được metadata.
 * Tua tới `giay` mà quá độ dài phim thì ffmpeg thoát mã 0 nhưng KHÔNG sinh ảnh,
 * nên phải lùi về đầu phim thử lại — nếu không thì phim ngắn luôn trống poster.
 */
export async function trichKhungHinh(tep: string, raAnh: string, giay = 180): Promise<boolean> {
  let lenh: string
  try {
    lenh = timLenh('ffmpeg')
  } catch {
    return false
  }
  if (giay > 0 && (await motKhungHinh(lenh, tep, raAnh, giay))) return true
  return motKhungHinh(lenh, tep, raAnh, 0)
}

export type PhuDeNhung = { tep: string; ma: string; nhan: string }

export type ViecTai = {
  huy: () => void
  xong: Promise<void>
}

/**
 * Tải HLS về MP4: tự tải từng segment, bóc vỏ PNG rồi bơm vào ffmpeg qua stdin.
 * ffmpeg chỉ remux (-c copy) nên không mã hoá lại — nhanh, không mất chất lượng.
 * Phụ đề nhúng thẳng vào file dạng mov_text kèm mã ngôn ngữ.
 *
 * Tiến độ tính theo số segment đã bơm, chắc chắn hơn là dò chuỗi time= trên stderr.
 */
export function taiHlsSangMp4(o: {
  m3u8: string
  phuDe: PhuDeNhung[]
  raFile: string
  onTienDo?: (phanTram: number) => void
}): ViecTai {
  const args = ['-hide_banner', '-loglevel', 'error', '-f', 'mpegts', '-i', 'pipe:0']
  for (const p of o.phuDe) args.push('-i', p.tep)
  args.push('-map', '0:v:0', '-map', '0:a:0?')
  o.phuDe.forEach((_, i) => args.push('-map', String(i + 1) + ':0'))
  args.push('-c:v', 'copy', '-c:a', 'copy')
  if (o.phuDe.length) args.push('-c:s', 'mov_text')
  o.phuDe.forEach((p, i) => {
    args.push('-metadata:s:s:' + i, 'language=' + p.ma)
    args.push('-metadata:s:s:' + i, 'title=' + p.nhan)
  })
  args.push('-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', '-y', o.raFile)

  const p = spawn(timLenh('ffmpeg'), args, { windowsHide: true })
  let loi = ''
  p.stderr.on('data', (d: Buffer) => (loi += d.toString()))

  const boDieuKhien = new AbortController()
  let daHuy = false

  const bom = (async () => {
    const r = await fetch(o.m3u8, {
      headers: { 'user-agent': UA, referer: 'https://vsmov.com/' },
      signal: boDieuKhien.signal,
    })
    if (!r.ok) throw new Error('Không tải được playlist (' + r.status + ')')
    const ds = docSegment(await r.text(), o.m3u8)
    if (!ds.length) throw new Error('Playlist không có segment nào')

    // Tải trước vài segment cho đỡ phải chờ từng lượt đi-về, nhưng ghi vào
    // ffmpeg đúng thứ tự. Giữ hàng đợi nông để không ngốn RAM.
    const SAU = 4
    const hangCho: Promise<Buffer>[] = []
    const taiMot = async (u: string) => {
      const rs = await fetch(u, {
        headers: { 'user-agent': UA, referer: 'https://vsmov.com/' },
        signal: boDieuKhien.signal,
      })
      if (!rs.ok) throw new Error('Segment lỗi ' + rs.status)
      return bocVoTS(Buffer.from(await rs.arrayBuffer()))
    }

    for (let i = 0; i < Math.min(SAU, ds.length); i++) hangCho.push(taiMot(ds[i]))

    for (let i = 0; i < ds.length; i++) {
      const khoi = await hangCho[i]
      if (daHuy) return
      if (i + SAU < ds.length) hangCho.push(taiMot(ds[i + SAU]))

      if (!p.stdin.write(khoi)) {
        await new Promise<void>((tiep) => p.stdin.once('drain', () => tiep()))
      }
      o.onTienDo?.(Math.min(99.9, ((i + 1) / ds.length) * 100))
    }
    p.stdin.end()
  })()

  const xong = new Promise<void>((giaiQuyet, tuChoi) => {
    let loiBom: Error | null = null
    bom.catch((e: unknown) => {
      loiBom = e instanceof Error ? e : new Error(String(e))
      try {
        p.stdin.destroy()
        p.kill()
      } catch {
        // tiến trình đã thoát
      }
    })
    p.on('error', tuChoi)
    p.on('close', (ma) => {
      if (daHuy) return giaiQuyet()
      if (loiBom) return tuChoi(loiBom)
      if (ma === 0) giaiQuyet()
      else tuChoi(new Error(loi.trim().split('\n').slice(-2).join(' ') || 'ffmpeg thoát với mã ' + ma))
    })
  })

  // stdin đóng sớm (ffmpeg chết) sẽ ném EPIPE ra ngoài nếu không bắt.
  p.stdin.on('error', () => {})

  return {
    huy: () => {
      daHuy = true
      boDieuKhien.abort()
      try {
        p.stdin.destroy()
        p.kill()
      } catch {
        // đã thoát
      }
    },
    xong,
  }
}
