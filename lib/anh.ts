/**
 * Proxy + thu nhỏ + đệm đĩa cho ảnh của nguồn.
 *
 * VÌ SAO CẦN: đo ngày 28/08/2026 — gọi thẳng CDN vsmov 10 luồng song song thì
 * 9/60 ảnh rớt kết nối (TypeError chứ không phải mã lỗi HTTP); gọi lại từng cái
 * thì 200 hết. Nguồn chịu không nổi khi bị dồn. Trình duyệt mở 6+ kết nối một
 * lúc cho mỗi hàng poster nên rơi đúng vào đó — chính là hiện tượng "mất ảnh".
 *
 * Còn một nửa nữa của cùng câu chuyện: poster gốc nặng tới 1,7 MB (đo được,
 * trung bình 96 KB). Một hàng 10 poster có thể ngốn vài MB — trên TV Box qua
 * wifi thì vừa chậm vừa dễ đứt giữa chừng.
 *
 * Chữa bằng bốn lớp:
 *   1. Ảnh đi qua chính máy chủ này (same-origin) → trình duyệt không đập
 *      thẳng vào CDN nữa.
 *   2. Ra CDN tối đa LUONG_RA kết nối, xếp hàng phần còn lại, rớt thì thử lại.
 *   3. Thu nhỏ đúng bề rộng cần dùng bằng ffmpeg (có thì dùng, không thì thôi).
 *   4. Ghi xuống đĩa; lần sau đọc đĩa, không gọi mạng nữa.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync } from 'node:fs'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { timLenh } from './ffmpeg'

/**
 * Chỉ proxy cho các host này. Chặn ở đây để không thành cổng SSRF mở.
 *
 * PHẢI CÓ ĐỦ CẢ HAI NGUỒN. Kho đệm toàn ảnh vsmov.com, nên nhìn vào kho rất dễ
 * tưởng chỉ cần một host — nhưng các hàng lấy TRỰC TIẾP từ nguồn (Top điểm cao,
 * Mới cập nhật...) trả ảnh ở `phimimg.com` của kkphim. Thiếu host đó thì proxy
 * trả 400 và cả hàng poster hiện khung chữ cái đầu. Đã xảy ra thật.
 */
const HOST_CHO_PHEP = new Set([
  'vsmov.com',
  'www.vsmov.com',
  'phimimg.com',
  'www.phimimg.com',
  'img.phimapi.com',
  'phimapi.com',
])

/**
 * Bề rộng cho phép. Danh sách đóng: nếu để client tự chọn số tuỳ ý thì mỗi số
 * lạ là một lần gọi ffmpeg và một tệp đệm mới — dễ thành chỗ cho người ta bơm
 * đầy đĩa. components/Anh.tsx phải dùng đúng các số này.
 */
export const BE_RONG = [200, 400, 800, 1280] as const
export type BeRong = (typeof BE_RONG)[number]

/** Số kết nối ra CDN cùng lúc. 3 là mức đo được không rớt. */
const LUONG_RA = 3
/** Thử lại mấy lần khi rớt kết nối (không tính lần đầu). */
const SO_LAN_THU = 2
const HET_GIO_MS = 20_000
const CO_TOI_DA = 12 * 1024 * 1024
const HET_GIO_FFMPEG_MS = 15_000

const THU_MUC = path.join(process.cwd(), 'du-lieu', 'anh')

export type KetQuaAnh = { than: Buffer; kieu: string; tuDia: boolean }

/* --------------------------- hàng đợi ra CDN --------------------------- */

type Kho = { dangChay: number; hangCho: (() => void)[]; dangTai: Map<string, Promise<KetQuaAnh | null>> }
const kho = globalThis as unknown as { __khoAnh?: Kho }
const trangThai: Kho = (kho.__khoAnh ??= { dangChay: 0, hangCho: [], dangTai: new Map() })

async function xepHang<T>(viec: () => Promise<T>): Promise<T> {
  if (trangThai.dangChay >= LUONG_RA) {
    await new Promise<void>((r) => trangThai.hangCho.push(r))
  }
  trangThai.dangChay++
  try {
    return await viec()
  } finally {
    trangThai.dangChay--
    trangThai.hangCho.shift()?.()
  }
}

/* ------------------------------ tiện ích ------------------------------ */

export function hopLe(u: string): boolean {
  try {
    const url = new URL(u)
    return (url.protocol === 'https:' || url.protocol === 'http:') && HOST_CHO_PHEP.has(url.hostname)
  } catch {
    return false
  }
}

/** Số bề rộng gửi lên có nằm trong danh sách không. Không thì bỏ qua, trả ảnh gốc. */
export function locBeRong(w: string | null): BeRong | undefined {
  const n = Number(w)
  return (BE_RONG as readonly number[]).includes(n) ? (n as BeRong) : undefined
}

function duoi(kieu: string): string {
  if (kieu.includes('png')) return '.png'
  if (kieu.includes('webp')) return '.webp'
  if (kieu.includes('gif')) return '.gif'
  return '.jpg'
}

function tepDem(u: string, rong: BeRong | undefined, kieu: string): string {
  const bam = createHash('sha1').update(u).digest('hex')
  // Chia hai tầng cho thư mục khỏi phình một chỗ vài chục nghìn tệp.
  return path.join(THU_MUC, rong ? String(rong) : 'goc', bam.slice(0, 2), bam + duoi(kieu))
}

/** Tìm bản đã đệm, không cần biết đuôi nào. */
async function docDem(u: string, rong: BeRong | undefined): Promise<KetQuaAnh | null> {
  for (const kieu of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    const t = tepDem(u, rong, kieu)
    if (!existsSync(t)) continue
    try {
      return { than: await readFile(t), kieu, tuDia: true }
    } catch {
      return null
    }
  }
  return null
}

async function ghiDem(u: string, rong: BeRong | undefined, than: Buffer, kieu: string) {
  const t = tepDem(u, rong, kieu)
  try {
    mkdirSync(path.dirname(t), { recursive: true })
    // Ghi tạm rồi đổi tên: hai yêu cầu cùng lúc không làm ra tệp vỡ đôi.
    const tam = t + '.' + process.pid + '.tam'
    await writeFile(tam, than)
    await rename(tam, t)
  } catch {
    // Đệm hỏng thì thôi, vẫn trả ảnh cho trình duyệt.
  }
}

/* ------------------------------ thu nhỏ ------------------------------ */

/**
 * Thu nhỏ bằng ffmpeg qua ống, không đụng tệp tạm.
 * `scale=w:-2` giữ tỉ lệ và ép chiều cao thành số chẵn (mjpeg đòi vậy).
 * `min(iw,W)` để ảnh vốn đã nhỏ hơn thì không bị phóng to cho xấu.
 *
 * Trả null khi không có ffmpeg hoặc thu nhỏ hỏng — gọi bên ngoài phải tự lo
 * dùng ảnh gốc, vì thiếu ffmpeg là chuyện bình thường (xem CAI-DAT.md).
 */
async function thuNho(goc: Buffer, rong: BeRong): Promise<Buffer | null> {
  let lenh: string
  try {
    lenh = timLenh('ffmpeg')
  } catch {
    return null
  }

  return new Promise((giaiQuyet) => {
    const p = spawn(
      lenh,
      [
        '-hide_banner', '-loglevel', 'error',
        '-i', 'pipe:0',
        '-vf', `scale='min(iw,${rong})':-2:flags=lanczos`,
        '-q:v', '4',
        '-f', 'mjpeg', 'pipe:1',
      ],
      { windowsHide: true },
    )

    const manh: Buffer[] = []
    let xong = false
    const ketThuc = (kq: Buffer | null) => {
      if (xong) return
      xong = true
      clearTimeout(hen)
      giaiQuyet(kq)
    }
    const hen = setTimeout(() => {
      p.kill('SIGKILL')
      ketThuc(null)
    }, HET_GIO_FFMPEG_MS)

    p.stdout.on('data', (d) => manh.push(d))
    p.stdout.on('error', () => {})
    p.stderr.resume()
    p.on('error', () => ketThuc(null))
    p.on('close', (ma) => {
      const ra = Buffer.concat(manh)
      ketThuc(ma === 0 && ra.length > 0 ? ra : null)
    })

    // EPIPE khi ffmpeg chết sớm — nuốt, đã có nhánh 'close' lo kết quả.
    p.stdin.on('error', () => {})
    p.stdin.end(goc)
  })
}

/* ------------------------------- lấy ảnh ------------------------------- */

async function taiGoc(u: string): Promise<{ than: Buffer; kieu: string } | null> {
  for (let lan = 0; lan <= SO_LAN_THU; lan++) {
    try {
      const r = await xepHang(() =>
        fetch(u, {
          signal: AbortSignal.timeout(HET_GIO_MS),
          headers: { accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
        }),
      )
      // 404 thật ở nguồn thì thử lại cũng vô ích.
      if (!r.ok) return null
      const kieu = r.headers.get('content-type') || 'image/jpeg'
      if (!kieu.startsWith('image/')) return null
      const than = Buffer.from(await r.arrayBuffer())
      if (!than.length || than.length > CO_TOI_DA) return null
      return { than, kieu }
    } catch {
      // Rớt kết nối — đây chính là ca hay gặp. Nghỉ tăng dần rồi thử lại.
      if (lan < SO_LAN_THU) await new Promise((r) => setTimeout(r, 250 * (lan + 1)))
    }
  }
  return null
}

async function taiThat(u: string, rong: BeRong | undefined): Promise<KetQuaAnh | null> {
  const goc = await taiGoc(u)
  if (!goc) return null

  // Ảnh động thu nhỏ bằng mjpeg sẽ mất phần động — để nguyên.
  if (rong && !goc.kieu.includes('gif')) {
    const nho = await thuNho(goc.than, rong)
    if (nho) {
      await ghiDem(u, rong, nho, 'image/jpeg')
      return { than: nho, kieu: 'image/jpeg', tuDia: false }
    }
    // Không thu nhỏ được (thiếu ffmpeg chẳng hạn) thì đệm bản gốc vào ĐÚNG ô
    // bề rộng đang xin, để lần sau khỏi gọi mạng lại rồi lại thất bại y hệt.
  }

  await ghiDem(u, rong, goc.than, goc.kieu)
  return { than: goc.than, kieu: goc.kieu, tuDia: false }
}

/**
 * Lấy ảnh: đĩa trước, không có thì ra mạng.
 * Nhiều yêu cầu cùng một URL + bề rộng được gộp làm một lượt tải.
 */
export async function layAnh(u: string, rong?: BeRong): Promise<KetQuaAnh | null> {
  const dem = await docDem(u, rong)
  if (dem) return dem

  const khoa = (rong ?? 'goc') + '|' + u
  const dang = trangThai.dangTai.get(khoa)
  if (dang) return dang

  const viec = taiThat(u, rong).finally(() => trangThai.dangTai.delete(khoa))
  trangThai.dangTai.set(khoa, viec)
  return viec
}

/* ------------------------------ hâm nóng ------------------------------ */

/**
 * Tải trước ảnh của các hàng đang hiện, để lần trình duyệt xin là có sẵn trên đĩa.
 *
 * VÌ SAO: đo ngày 21/09/2026 trên chính máy này — ảnh đã đệm trả về trong
 * 6–20 ms, ảnh chưa đệm mất 150 ms đến 1,8 giây. Trang chủ có gần 190 poster mà
 * LUONG_RA chỉ cho 3 kết nối ra CDN cùng lúc, nên khi kho ảnh còn nguội thì
 * poster phải xếp hàng lần lượt — đó mới là lý do ô xám nằm lâu, chứ không phải
 * tại chỗ giữ chỗ xấu. Hâm trước thì người xem gặp đường 6 ms.
 *
 * Chạy NỀN và NHƯỜNG ĐƯỜNG: trước mỗi ảnh, nếu đang có yêu cầu thật chiếm làn
 * thì đứng chờ. Không có chỗ này thì việc hâm giành mất 3 làn ra CDN và làm ảnh
 * người xem đang chờ về CHẬM hơn — tức là tự phá đúng thứ mình định chữa.
 */
const CACH_NHAU_MS = 120
const TRAN_DA_HAM = 20_000

type KhoHam = { daHam: Set<string>; hangCho: { u: string; rong: BeRong }[]; dangChay: boolean }
const khoHam = globalThis as unknown as { __khoHamAnh?: KhoHam }
const ham: KhoHam = (khoHam.__khoHamAnh ??= { daHam: new Set(), hangCho: [], dangChay: false })

/** Có sẵn trên đĩa chưa — chỉ hỏi tên tệp, không đọc nội dung như docDem. */
function coTrenDia(u: string, rong: BeRong | undefined): boolean {
  for (const kieu of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    if (existsSync(tepDem(u, rong, kieu))) return true
  }
  return false
}

async function chayHam() {
  if (ham.dangChay) return
  ham.dangChay = true
  try {
    let viec = ham.hangCho.shift()
    while (viec) {
      // Nhường làn cho yêu cầu thật của người xem.
      while (trangThai.dangChay > 0) await new Promise((r) => setTimeout(r, 300))
      try {
        await layAnh(viec.u, viec.rong)
      } catch {
        // Ảnh hâm hỏng thì kệ, lần sau người xem mở sẽ tự tải lại.
      }
      await new Promise((r) => setTimeout(r, CACH_NHAU_MS))
      viec = ham.hangCho.shift()
    }
  } finally {
    ham.dangChay = false
  }
}

/**
 * Xếp một loạt ảnh vào hàng hâm. Gọi kiểu bắn-rồi-quên từ trang máy chủ dựng.
 * Bỏ qua ảnh đã có trên đĩa và ảnh đã hâm trong phiên này, nên gọi mỗi lần tải
 * trang cũng không sinh việc mới.
 */
export function hamNongAnh(dsUrl: (string | null | undefined)[], rong: BeRong) {
  if (ham.daHam.size > TRAN_DA_HAM) ham.daHam.clear()
  for (const raw of dsUrl) {
    const u = String(raw || '').trim()
    if (!u || !hopLe(u)) continue
    const khoa = rong + '|' + u
    if (ham.daHam.has(khoa)) continue
    // Hỏi đĩa TRƯỚC, và chỉ đánh dấu daHam cho ảnh thật sự xếp vào hàng.
    // Đánh dấu cả ảnh bỏ qua vì đã có trên đĩa thì khi tệp đệm bị xoá (nút
    // "xoá đệm ảnh" trong Quản trị chẳng hạn) nó không bao giờ được kéo về nữa —
    // đã thử và thấy thật: xoá 10 tệp, mở lại trang chủ, 0/10 quay lại.
    if (coTrenDia(u, rong)) continue
    ham.daHam.add(khoa)
    ham.hangCho.push({ u, rong })
  }
  if (ham.hangCho.length) void chayHam()
}

/** Xoá toàn bộ ảnh đã đệm. Dùng khi cần lấy lại bản mới từ nguồn. */
export async function xoaDemAnh(): Promise<number> {
  const { readdir, rm } = await import('node:fs/promises')
  let n = 0
  try {
    for (const o of await readdir(THU_MUC)) {
      await rm(path.join(THU_MUC, o), { recursive: true, force: true })
      n++
    }
  } catch {
    // chưa có thư mục đệm
  }
  return n
}
