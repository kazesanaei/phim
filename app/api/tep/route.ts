/**
 * Ống dẫn byte duy nhất của app. Ba chế độ, cùng một bản chất:
 *   ?u=<url>   proxy tài nguyên từ nguồn (BẮT BUỘC, vì segment HLS không có
 *              header CORS nên hls.js trong trình duyệt không tải thẳng được)
 *   ?f=<file>  phát file trong thư mục nguồn (có Range để tua được)
 *   ?ma=<file> chuyển mã theo yêu cầu cho file codec trình duyệt không nuốt nổi
 *
 * Mọi đường vào đều đi qua urlChoPhep / duongDanChoPhep — bỏ là thành proxy mở
 * và lỗ đọc file tuỳ ý.
 */
import { createReadStream } from 'node:fs'
import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { urlChoPhep, duongDanChoPhep, chanCheoTrang, traLoiLoi, LoiChan, hocMienPhat } from '@/lib/an-toan'
import { mienTrongPlaylist, docTrangLoiNguon, giaiThichLoiMang } from '@/lib/mien-phat'
import { UA, luongChuyenMa } from '@/lib/ffmpeg'
import { srtSangVtt } from '@/lib/phu-de'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'text/vtt; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function boc(u: string, goc: URL): string {
  return '/api/tep?u=' + encodeURIComponent(new URL(u, goc).href)
}

/**
 * Viết lại playlist để mọi segment cũng đi qua proxy này. Giữ nguyên dòng #EXT,
 * chỉ đổi URI trong #EXT-X-KEY / #EXT-X-MAP và các dòng URL trần.
 */
function vietLaiPlaylist(noiDung: string, goc: URL): string {
  return noiDung
    .split(/\r?\n/)
    .map((dong) => {
      const t = dong.trim()
      if (!t) return dong
      if (t.startsWith('#')) {
        return dong.replace(/URI="([^"]+)"/g, (_m, v: string) => 'URI="' + boc(v, goc) + '"')
      }
      return boc(t, goc)
    })
    .join('\n')
}

const HEADER_CHUYEN_TIEP = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'etag',
  'last-modified',
]

function traPlaylist(chu: string, u: URL, r: Response): Response {
  // Playlist tải từ tên miền đã được phép: mảnh video và playlist con nằm ở
  // CDN khác thì học luôn, không thì mảnh đầu tiên đã dính 403.
  if (r.ok) for (const h of mienTrongPlaylist(chu, u)) hocMienPhat('https://' + h + '/', 'playlist ' + u.hostname)
  return new Response(vietLaiPlaylist(chu, u), {
    status: r.status,
    headers: {
      'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function tuXa(req: Request, raw: string, conLai = 3): Promise<Response> {
  const u = urlChoPhep(raw)
  const range = req.headers.get('range')
  let r: Response
  try {
    r = await fetch(u, {
      headers: {
        'user-agent': UA,
        referer: u.origin + '/',
        ...(range ? { range } : {}),
      },
      cache: 'no-store',
      // Chặn redirect. allowlist chỉ kiểm URL ban đầu; nếu để fetch tự đi theo,
      // một Location trỏ về nội mạng (127.0.0.1, 192.168.x, router) sẽ lách qua
      // allowlist và biến proxy thành lỗ SSRF. Nguồn HLS không cần redirect.
      redirect: 'manual',
    })
  } catch (e) {
    // Không để rơi xuống "Có lỗi máy chủ" chung chung: nói rõ mạng chặn kiểu gì
    const loi = giaiThichLoiMang(e, u.hostname)
    console.warn('[phim]', loi)
    return Response.json({ loi }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
  if (r.status >= 300 && r.status < 400) {
    const dich = r.headers.get('location')
    if (!dich) throw new LoiChan('Redirect không có đích')
    if (conLai <= 0) throw new LoiChan('Quá nhiều lần chuyển hướng')
    // Đi theo chỉ khi đích vẫn trong allowlist — urlChoPhep ném LoiChan nếu không.
    return tuXa(req, new URL(dich, u).href, conLai - 1)
  }

  const ct = r.headers.get('content-type') || ''
  const laPlaylist = u.pathname.endsWith('.m3u8') || ct.includes('mpegurl')
  /**
   * Nguồn trả TRANG WEB thay vì video: đọc xem vì sao rồi báo rõ, đừng để trình phát chỉ thấy
   * "404". Chỉ xét playlist và phản hồi lỗi — mảnh video thì nguồn hay nguỵ trang kiểu ảnh.
   */
  if (ct.includes('text/html') && (laPlaylist || !r.ok)) {
    const chu = await r.text()
    if (!chu.trimStart().startsWith('#EXTM3U')) {
      const t = docTrangLoiNguon(chu)
      if (t.chanNuocNgoai) {
        const loi =
          `Máy chủ ${u.hostname} chỉ cho mạng Việt Nam truy cập, mà mạng của máy này đang đi ra nước ngoài` +
          (t.nuoc || t.ip ? ` (${[t.nuoc, t.ip].filter(Boolean).join(', ')})` : '') +
          '. Tắt VPN / proxy của công ty, hoặc dùng mạng khác như 4G phát từ điện thoại.'
        console.warn('[phim] nguồn chặn IP nước ngoài:', u.hostname, t.ip ?? '', t.nuoc ?? '')
        return Response.json({ loi, ip: t.ip, nuoc: t.nuoc }, { status: 451, headers: { 'cache-control': 'no-store' } })
      }
      console.warn(`[phim] nguồn trả trang web thay vì video: ${u.hostname} mã ${r.status}`)
      return Response.json(
        { loi: `Máy chủ ${u.hostname} trả trang web thay vì video (mã ${r.status}).` },
        { status: r.ok ? 502 : r.status, headers: { 'cache-control': 'no-store' } },
      )
    }
    return traPlaylist(chu, u, r)
  }
  if (laPlaylist) return traPlaylist(await r.text(), u, r)

  const h = new Headers()
  for (const k of HEADER_CHUYEN_TIEP) {
    const v = r.headers.get(k)
    if (v) h.set(k, v)
  }
  if (!h.has('cache-control')) h.set('cache-control', 'public, max-age=3600')
  return new Response(r.body, { status: r.status, headers: h })
}

async function tuDia(req: Request, raw: string): Promise<Response> {
  const p = duongDanChoPhep(raw)
  const st = await stat(p).catch(() => null)
  if (!st || !st.isFile()) throw new LoiChan('Không tìm thấy file')

  const duoi = path.extname(p).toLowerCase()

  // Phụ đề: trình duyệt không đọc SRT. Chuẩn hoá cả file .vtt vì nhiều file
  // ngoài đời gắn nhãn WEBVTT nhưng mốc thời gian vẫn dùng dấu phẩy kiểu SRT
  // (chính nguồn vsmov cũng vậy) — để nguyên thì trình duyệt đọc ra 0 cue.
  if (duoi === '.srt' || duoi === '.vtt') {
    const chu = await readFile(p, 'utf8')
    return new Response(srtSangVtt(chu), {
      headers: { 'content-type': 'text/vtt; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const kieu = MIME[duoi] || 'application/octet-stream'
  const range = req.headers.get('range')

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    let dau = m && m[1] ? parseInt(m[1], 10) : 0
    let cuoi = m && m[2] ? parseInt(m[2], 10) : st.size - 1
    if (!Number.isFinite(dau) || dau < 0) dau = 0
    if (!Number.isFinite(cuoi) || cuoi >= st.size) cuoi = st.size - 1
    if (dau > cuoi) {
      return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + st.size } })
    }
    const luong = createReadStream(p, { start: dau, end: cuoi })
    return new Response(Readable.toWeb(luong) as ReadableStream, {
      status: 206,
      headers: {
        'content-type': kieu,
        'content-length': String(cuoi - dau + 1),
        'content-range': 'bytes ' + dau + '-' + cuoi + '/' + st.size,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      },
    })
  }

  return new Response(Readable.toWeb(createReadStream(p)) as ReadableStream, {
    headers: {
      'content-type': kieu,
      'content-length': String(st.size),
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    },
  })
}

async function chuyenMa(req: Request, raw: string, batDau: number, trackAm = 0): Promise<Response> {
  const p = duongDanChoPhep(raw)
  const st = await stat(p).catch(() => null)
  if (!st || !st.isFile()) throw new LoiChan('Không tìm thấy file')

  const tt = luongChuyenMa(p, batDau, trackAm)
  // Người xem đóng tab hoặc tua đi chỗ khác thì phải giết tiến trình, không thì
  // ffmpeg cứ chạy tiếp và ăn hết CPU.
  const dung = () => {
    try {
      tt.kill()
    } catch {
      // đã thoát rồi
    }
  }
  req.signal?.addEventListener('abort', dung)
  tt.on('error', dung)

  return new Response(Readable.toWeb(tt.stdout) as ReadableStream, {
    headers: { 'content-type': 'video/mp4', 'cache-control': 'no-store' },
  })
}

export async function GET(req: Request) {
  try {
    // Chặn tab khác dùng máy người dùng làm bàn đạp proxy / dò file cục bộ.
    // Thẻ <video>/hls.js của chính app là same-origin nên vẫn qua.
    chanCheoTrang(req)
    const sp = new URL(req.url).searchParams
    const u = sp.get('u')
    const f = sp.get('f')
    const ma = sp.get('ma')
    if (u) return await tuXa(req, u)
    if (f) return await tuDia(req, f)
    if (ma) return await chuyenMa(req, ma, Number(sp.get('t') || 0) || 0, Number(sp.get('am') || 0) || 0)
    return Response.json({ loi: 'Thiếu tham số u / f / ma' }, { status: 400 })
  } catch (e) {
    return traLoiLoi(e)
  }
}
