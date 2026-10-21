/**
 * Tự nhận intro / đoạn kết của phim bộ — không cần ai đánh dấu, giống Netflix.
 *
 * Lấy hai tập liền nhau, tính dấu vân tay âm thanh (chromaprint, có sẵn trong
 * bản ffmpeg "full") cho khúc đầu và khúc cuối mỗi tập, rồi tìm đoạn hai tập dùng
 * chung — đó là nhạc mở đầu và nhạc kết. Thuật toán so nằm ở lib/van-tay.ts.
 *
 * GIÁ PHẢI TRẢ: phim từ nguồn phải tải thêm ~9 phút video cho MỖI CẶP tập (5 phút
 * đầu + 4 phút cuối, mỗi tập). Đo thật: 75–140 giây một cặp. Nên:
 *   - một việc một lúc, tải TUẦN TỰ từng segment — không giành băng thông với
 *     phim đang phát;
 *   - phân tích một cặp là có mốc cho CẢ HAI tập, cặp kế tiếp bắt đầu từ tập sau;
 *   - đã có kết quả (kể cả "không thấy") thì không làm lại; lỗi thì 6 tiếng sau
 *     mới thử lại.
 * Phim trong máy đọc thẳng tệp, không tốn mạng.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { db } from './db'
import { coFfmpeg, docThongTin, timLenh, UA } from './ffmpeg'
import { bocVoTS } from './hls'
import { giaiMaEmbed } from './nguon-phat'
import { layChiTiet, kieuNguonPhat } from './nguon'
import { layHangPhim, tapCuaPhim } from './thu-vien'
import {
  doiRaGiay,
  INTRO_DAI_NHAT,
  INTRO_NGAN_NHAT,
  KET_DAI_NHAT,
  KET_NGAN_NHAT,
  timDoanChung,
  type Khoang,
} from './van-tay'

/** Intro gần như luôn nằm trong 5 phút đầu; nhạc kết trong 4 phút cuối. */
const KHUC_DAU = 300
const KHUC_CUOI = 240
const HET_GIO_MS = 4 * 60_000
/** Lỗi gần như luôn là nguồn rớt kết nối thoáng qua — thử lại sớm. */
const THU_LAI_SAU_MS = 10 * 60_000

export type MocTap = {
  trangThai: 'xong' | 'loi' | 'mot-tap' | 'dang-lam' | 'chua'
  intro: Khoang | null
  ket: Khoang | null
}

type HangMoc = {
  intro_tu: number | null
  intro_den: number | null
  ket_tu: number | null
  ket_den: number | null
  trang_thai: string
  cap_nhat: string
}

type Kho = { hang: { slug: string; tap: string; server: number }[]; dang: Set<string>; chay: boolean }
const toanCuc = globalThis as unknown as { __tuDongIntro?: Kho }
const kho: Kho = (toanCuc.__tuDongIntro ??= { hang: [], dang: new Set(), chay: false })

const khoa = (slug: string, tap: string) => slug + '|' + tap

function docHang(slug: string, tap: string): HangMoc | null {
  try {
    return (
      (db
        .prepare('select intro_tu, intro_den, ket_tu, ket_den, trang_thai, cap_nhat from moc_tap where phim_slug = ? and tap_slug = ?')
        .get(slug, tap) as HangMoc | undefined) ?? null
    )
  } catch {
    return null
  }
}

/** Mốc tự nhận của một tập, kèm trạng thái để trình phát biết có nên chờ. */
export function layMocTap(slug: string, tap: string): MocTap {
  const h = docHang(slug, tap)
  if (!h) return { trangThai: kho.dang.has(khoa(slug, tap)) ? 'dang-lam' : 'chua', intro: null, ket: null }
  return {
    trangThai: kho.dang.has(khoa(slug, tap)) ? 'dang-lam' : (h.trang_thai as MocTap['trangThai']),
    intro: h.intro_tu !== null && h.intro_den !== null ? { tu: h.intro_tu, den: h.intro_den } : null,
    ket: h.ket_tu !== null && h.ket_den !== null ? { tu: h.ket_tu, den: h.ket_den } : null,
  }
}

function ghi(slug: string, tap: string, r: { intro: Khoang | null; ket: Khoang | null; thoiLuong?: number; trangThai: string; loi?: string }, deLen: boolean) {
  const sql = `insert into moc_tap (phim_slug, tap_slug, intro_tu, intro_den, ket_tu, ket_den, thoi_luong, trang_thai, loi, cap_nhat)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ${
       deLen
         ? `on conflict(phim_slug, tap_slug) do update set intro_tu = excluded.intro_tu, intro_den = excluded.intro_den,
              ket_tu = excluded.ket_tu, ket_den = excluded.ket_den, thoi_luong = excluded.thoi_luong,
              trang_thai = excluded.trang_thai, loi = excluded.loi, cap_nhat = excluded.cap_nhat`
         : 'on conflict(phim_slug, tap_slug) do nothing'
     }`
  db.prepare(sql).run(
    slug,
    tap,
    r.intro?.tu ?? null,
    r.intro?.den ?? null,
    r.ket?.tu ?? null,
    r.ket?.den ?? null,
    r.thoiLuong ?? null,
    r.trangThai,
    r.loi ?? null,
  )
}

/* ------------------------- nguồn âm thanh của một tập ------------------------- */

type Nguon = { kieu: 'tep'; duongDan: string } | { kieu: 'hls'; m3u8: string }
type Seg = { url: string; dai: number }

/**
 * Tải có thử lại. Nguồn hay RỚT KẾT NỐI giữa chừng ("fetch failed") khi bị gọi
 * liên tục — đã gặp thật lúc phân tích Đảo Hải Tặc 1157, và cũng chính là chứng
 * "mất ảnh" ghi ở lib/anh.ts. Gọi lại đúng URL đó sau một nhịp thì được.
 */
async function taiCoThuLai(u: string): Promise<Response> {
  for (let lan = 0; ; lan++) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, referer: 'https://vsmov.com/' }, signal: AbortSignal.timeout(60_000) })
      // 404 thật ở nguồn thì thử lại cũng vô ích
      if (r.status === 404) throw new Error('HTTP 404')
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r
    } catch (e) {
      if (lan >= 3 || (e instanceof Error && e.message === 'HTTP 404')) throw e
      await new Promise((t) => setTimeout(t, 800 * (lan + 1)))
    }
  }
}

async function layText(u: string): Promise<string> {
  return (await taiCoThuLai(u)).text()
}

/** Danh sách segment kèm độ dài; playlist chủ thì đi xuống biến thể đầu tiên. */
async function docPlaylist(u: string): Promise<Seg[]> {
  let t = await layText(u)
  if (t.includes('#EXT-X-STREAM-INF')) {
    const dong = t.split(/\r?\n/).map((d) => d.trim())
    const i = dong.findIndex((d) => d.startsWith('#EXT-X-STREAM-INF'))
    u = new URL(dong[i + 1], u).href
    t = await layText(u)
  }
  const ds: Seg[] = []
  let dai = 0
  for (const d of t.split(/\r?\n/).map((x) => x.trim())) {
    if (d.startsWith('#EXTINF:')) dai = parseFloat(d.slice(8)) || 0
    else if (d && !d.startsWith('#')) {
      ds.push({ url: new URL(d, u).href, dai })
      dai = 0
    }
  }
  return ds
}

/** Chạy ffmpeg lấy vân tay thô; `bom` (nếu có) bơm dữ liệu TS vào stdin. */
function chayVanTay(dauVao: string[], bom?: (stdin: NodeJS.WritableStream) => Promise<void>): Promise<Uint32Array> {
  return new Promise((ok, no) => {
    const p = spawn(
      timLenh('ffmpeg'),
      ['-hide_banner', '-loglevel', 'error', ...dauVao, '-map', '0:a:0', '-f', 'chromaprint', '-fp_format', 'raw', 'pipe:1'],
      { windowsHide: true },
    )
    const ra: Buffer[] = []
    let loi = ''
    const hen = setTimeout(() => {
      p.kill('SIGKILL')
      no(new Error('ffmpeg quá giờ'))
    }, HET_GIO_MS)
    p.stdout.on('data', (d: Buffer) => ra.push(d))
    p.stderr.on('data', (d: Buffer) => (loi += d.toString()))
    p.on('error', (e) => {
      clearTimeout(hen)
      no(e)
    })
    p.on('close', (m) => {
      clearTimeout(hen)
      if (m !== 0) return no(new Error('ffmpeg mã ' + m + ': ' + loi.slice(0, 200)))
      const b = Buffer.concat(ra)
      const v = new Uint32Array(Math.floor(b.length / 4))
      for (let i = 0; i < v.length; i++) v[i] = b.readUInt32LE(i * 4)
      ok(v)
    })
    p.stdin.on('error', () => {})
    if (bom) {
      bom(p.stdin).then(
        () => p.stdin.end(),
        (e) => {
          p.kill()
          no(e)
        },
      )
    }
  })
}

/** Bơm TUẦN TỰ từng segment — chậm hơn tải song song, nhưng không giành mạng của phim đang phát. */
function bomSegment(segs: Seg[]) {
  return async (stdin: NodeJS.WritableStream) => {
    for (const s of segs) {
      const r = await taiCoThuLai(s.url)
      const khoi = bocVoTS(Buffer.from(await r.arrayBuffer()))
      if (!stdin.write(khoi)) await new Promise<void>((t) => stdin.once('drain', () => t()))
    }
  }
}

type VanTayTap = { dau: Uint32Array; cuoi: Uint32Array; lechCuoi: number; thoiLuong: number }

async function vanTayTap(n: Nguon): Promise<VanTayTap> {
  if (n.kieu === 'tep') {
    const tt = await docThongTin(n.duongDan)
    const thoiLuong = tt?.thoiLuong || 0
    if (!thoiLuong) throw new Error('Không đọc được thời lượng tệp')
    const dau = await chayVanTay(['-t', String(KHUC_DAU), '-i', n.duongDan])
    const cuoi = await chayVanTay(['-sseof', String(-KHUC_CUOI), '-i', n.duongDan])
    return { dau, cuoi, lechCuoi: Math.max(0, thoiLuong - KHUC_CUOI), thoiLuong }
  }

  const segs = await docPlaylist(n.m3u8)
  if (!segs.length) throw new Error('Playlist rỗng')
  const thoiLuong = segs.reduce((t, s) => t + s.dai, 0)

  const dauSeg: Seg[] = []
  let t = 0
  for (const s of segs) {
    if (t >= KHUC_DAU) break
    dauSeg.push(s)
    t += s.dai
  }
  const cuoiSeg: Seg[] = []
  t = 0
  for (let i = segs.length - 1; i >= 0 && t < KHUC_CUOI; i--) {
    cuoiSeg.unshift(segs[i])
    t += segs[i].dai
  }
  const vao = ['-f', 'mpegts', '-i', 'pipe:0']
  const dau = await chayVanTay(vao, bomSegment(dauSeg))
  const cuoi = await chayVanTay(vao, bomSegment(cuoiSeg))
  return { dau, cuoi, lechCuoi: thoiLuong - cuoiSeg.reduce((x, s) => x + s.dai, 0), thoiLuong }
}

/** Danh sách tập (đã sắp) cùng cách lấy nguồn của từng tập. */
async function dsTap(slug: string, server: number): Promise<{ slug: string; nguon: () => Promise<Nguon> }[]> {
  if (slug.startsWith('local-')) {
    const h = layHangPhim(slug)
    if (!h) return []
    return tapCuaPhim(h.id)
      .filter((t) => t.duong_dan_file && existsSync(t.duong_dan_file))
      .map((t) => ({ slug: 'tap-' + t.so_tap, nguon: async () => ({ kieu: 'tep' as const, duongDan: t.duong_dan_file as string }) }))
  }
  const ct = await layChiTiet(slug)
  const may = ct?.mayChu[server] ?? ct?.mayChu[0]
  if (!may) return []
  return may.tap.map((t) => ({
    slug: t.slug,
    nguon: async () => {
      // Tập đã tải về máy thì đọc tệp, khỏi tốn mạng
      const daTai = db
        .prepare("select duong_dan_ra from tai_ve where phim_slug = ? and tap_slug = ? and trang_thai = 'xong'")
        .get(slug, t.slug) as { duong_dan_ra: string | null } | undefined
      if (daTai?.duong_dan_ra && existsSync(daTai.duong_dan_ra)) return { kieu: 'tep' as const, duongDan: daTai.duong_dan_ra }
      const k = kieuNguonPhat(t.embed)
      if (k.kieu === 'm3u8') return { kieu: 'hls' as const, m3u8: k.url }
      return { kieu: 'hls' as const, m3u8: (await giaiMaEmbed(k.embed)).m3u8 }
    },
  }))
}

async function phanTich(slug: string, tapSlug: string, server: number) {
  const ds = await dsTap(slug, server)
  const i = ds.findIndex((t) => t.slug === tapSlug)
  if (i < 0) throw new Error('Không thấy tập trong danh sách')
  /**
   * So với tập SAU trước, trắng thì so tiếp với tập TRƯỚC.
   *
   * Đo thật trên Đảo Hải Tặc: 1156 là tập đặc biệt không có bài mở đầu — không
   * trùng cả 1155 lẫn 1157, trong khi 1157/1158 trùng đẹp (intro 0:00–1:40). Chỉ
   * so một bên thì tập 1157 bị kết luận nhầm là "không có intro".
   */
  const ben = [ds[i + 1], ds[i - 1]].filter(Boolean)
  if (!ben.length) {
    ghi(slug, tapSlug, { intro: null, ket: null, trangThai: 'mot-tap' }, true)
    return
  }

  const bat = Date.now()
  const a = await vanTayTap(await ds[i].nguon())
  let intro: Khoang | null = null
  let ket: Khoang | null = null
  const daSo: string[] = []

  for (const b of ben) {
    const vb = await vanTayTap(await b.nguon())
    daSo.push(b.slug)
    const ip = doiRaGiay(timDoanChung(a.dau, vb.dau), 0, 0, INTRO_NGAN_NHAT, INTRO_DAI_NHAT)
    const kp = doiRaGiay(timDoanChung(a.cuoi, vb.cuoi), a.lechCuoi, vb.lechCuoi, KET_NGAN_NHAT, KET_DAI_NHAT)
    intro ??= ip?.a ?? null
    ket ??= kp?.a ?? null
    /**
     * Cùng một lần so cho luôn mốc của tập bên cạnh — nhưng CHỈ khi cặp này thấy
     * ĐỦ cả intro lẫn đoạn kết. Không bao giờ lưu hộ kết quả "không thấy": có khi
     * chính tập đang phân tích mới là tập đặc biệt, còn tập bên cạnh vẫn có intro
     * bình thường. Lưu hộ "không thấy" thì tập đó không bao giờ được phân tích lại
     * — đã dính thật với 1157. Không đè kết quả đã có của nó.
     */
    if (ip && kp) ghi(slug, b.slug, { intro: ip.b, ket: kp.b, thoiLuong: vb.thoiLuong, trangThai: 'xong' }, false)
    if (intro && ket) break
  }

  ghi(slug, tapSlug, { intro, ket, thoiLuong: a.thoiLuong, trangThai: 'xong' }, true)

  const mm = (g: number) => `${Math.floor(g / 60)}:${String(Math.floor(g % 60)).padStart(2, '0')}`
  console.log(
    `[tự nhận intro] ${slug} ${tapSlug} (so với ${daSo.join(', ')}): intro ${intro ? mm(intro.tu) + '–' + mm(intro.den) : 'không'}, ` +
      `kết ${ket ? mm(ket.tu) + '–' + mm(ket.den) : 'không'} · ${((Date.now() - bat) / 1000).toFixed(0)}s`,
  )
}

async function chayHang() {
  if (kho.chay) return
  kho.chay = true
  try {
    let viec = kho.hang.shift()
    while (viec) {
      try {
        await phanTich(viec.slug, viec.tap, viec.server)
      } catch (e) {
        try {
          ghi(viec.slug, viec.tap, { intro: null, ket: null, trangThai: 'loi', loi: e instanceof Error ? e.message : String(e) }, true)
        } catch {
          // DB bận thì thôi, lần sau thử lại
        }
      } finally {
        kho.dang.delete(khoa(viec.slug, viec.tap))
      }
      viec = kho.hang.shift()
    }
  } finally {
    kho.chay = false
  }
}

/**
 * Xếp một tập vào hàng phân tích. Gọi kiểu bắn-rồi-quên.
 * Bỏ qua nếu đã có kết quả, đang làm, hoặc lỗi chưa quá 6 tiếng.
 */
export function xepHangPhanTich(slug: string, tap: string, server = 0) {
  if (!slug || !tap || !coFfmpeg()) return
  const k = khoa(slug, tap)
  if (kho.dang.has(k)) return
  const h = docHang(slug, tap)
  if (h && (h.trang_thai !== 'loi' || Date.now() - Date.parse(h.cap_nhat.replace(' ', 'T') + 'Z') < THU_LAI_SAU_MS)) return
  kho.dang.add(k)
  kho.hang.push({ slug, tap, server })
  void chayHang()
}
