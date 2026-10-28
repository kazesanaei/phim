/**
 * Đọc trước đoạn video HLS ở máy chủ phim: hls.js tải từng đoạn MỘT, nối đuôi nhau. Nguồn nào bóp tốc độ
 * theo từng kết nối (đã đo ~490 KB/s một luồng, trong khi phim 1080p cần ~450 KB/s) thì bộ đệm không bao giờ
 * dày lên được — phim khựng mỗi khi mạng chậm một nhịp. Khi trình phát xin đoạn N, ở đây tải sẵn N+1..N+3
 * SONG SONG vào RAM; lúc trình phát xin tới thì trả ngay từ RAM.
 *
 * Tắt mặc định: chỉ có lợi khi nguồn bóp theo kết nối, còn khi mạng nhà đã là nút thắt thì chỉ tốn thêm
 * băng thông. Bật bằng cài đặt `doc_truoc_doan` = 'bat' (tv-box/kiem-tra-app.sh đo "1 luồng / 3 luồng" để
 * quyết; lệnh bật ở tv-box/HUONG-DAN.md). Đọc cài đặt mỗi lần nên bật/tắt có tác dụng ngay, khỏi khởi động lại.
 */
import { layCaiDat } from '@/lib/db'
import { urlChoPhep } from '@/lib/an-toan'

/** Số đoạn đọc trước sau đoạn đang xin. 3 × ~3 MB (6 giây 1080p) — vừa túi RAM của box 2 GB. */
const SO_DOAN = 3
/** Trần số đoạn giữ trong RAM (kể cả đang tải). */
const TRAN = 8
/** Đoạn đọc trước mà trình phát không xin trong chừng này thì bỏ (người xem tua đi chỗ khác). */
const HAN_MS = 3 * 60_000
/** Nhớ thứ tự đoạn của tối đa chừng này playlist (mỗi tập, mỗi máy chủ là một playlist). */
const TRAN_PLAYLIST = 6

/**
 * Một đoạn đang/đã tải vào RAM. Giữ từng khúc byte khi về, để trình phát xin đúng lúc đoạn còn đang tải thì
 * nhận dần từng khúc (hls.js progressive phát được ngay) thay vì chờ trọn đoạn — chờ trọn đoạn làm mở phim
 * chậm thêm 4 giây khi thử với nguồn bóp 450 KB/s (28/10/2026).
 */
type DoanDem = { tao: number; khuc: Uint8Array[]; dai: number; xong: boolean; hong: boolean; kieu: string; cho: (() => void)[] }

const kho = globalThis as unknown as {
  __docTruoc?: { thuTu: Map<string, string[]>; viTri: Map<string, { ds: string[]; i: number }>; dem: Map<string, DoanDem> }
}
function trangThai() {
  return (kho.__docTruoc ??= { thuTu: new Map(), viTri: new Map(), dem: new Map() })
}

export function docTruocBat(): boolean {
  return layCaiDat('doc_truoc_doan') === 'bat'
}

/** Gọi khi viết lại một playlist: nhớ thứ tự các đoạn (URL tuyệt đối của nguồn). */
export function ghiThuTu(playlist: string, doan: string[]) {
  if (!doan.length) return
  const t = trangThai()
  t.thuTu.delete(playlist)
  t.thuTu.set(playlist, doan)
  while (t.thuTu.size > TRAN_PLAYLIST) {
    const cu = t.thuTu.keys().next().value as string
    for (const u of t.thuTu.get(cu) ?? []) t.viTri.delete(u)
    t.thuTu.delete(cu)
  }
  doan.forEach((u, i) => t.viTri.set(u, { ds: doan, i }))
}

function don() {
  const t = trangThai()
  const bayGio = Date.now()
  for (const [u, d] of t.dem) if (bayGio - d.tao > HAN_MS) t.dem.delete(u)
  while (t.dem.size > TRAN) t.dem.delete(t.dem.keys().next().value as string)
}

function bao(d: DoanDem) {
  const ds = d.cho
  d.cho = []
  for (const f of ds) f()
}

function batDauTai(u: string, ua: string): DoanDem {
  const d: DoanDem = { tao: Date.now(), khuc: [], dai: 0, xong: false, hong: false, kieu: 'video/mp2t', cho: [] }
  void (async () => {
    try {
      // Đi theo chuyển hướng bằng tay, mỗi bước kiểm lại allowlist (urlChoPhep ném lỗi nếu đích ra ngoài) —
      // cùng cách /api/tep chặn SSRF. Lỗi gì cũng đánh hỏng, trình phát tự xin thẳng như thường.
      let url = urlChoPhep(u)
      let r = await fetch(url, { headers: { 'user-agent': ua, referer: url.origin + '/' }, cache: 'no-store', redirect: 'manual' })
      for (let n = 0; r.status >= 300 && r.status < 400 && n < 3; n++) {
        const dich = r.headers.get('location')
        if (!dich) break
        url = urlChoPhep(new URL(dich, url).href)
        r = await fetch(url, { headers: { 'user-agent': ua, referer: url.origin + '/' }, cache: 'no-store', redirect: 'manual' })
      }
      if (r.status !== 200 || !r.body) throw new Error('ma ' + r.status)
      d.kieu = r.headers.get('content-type') || d.kieu
      const doc = r.body.getReader()
      for (;;) {
        const { done, value } = await doc.read()
        if (done) break
        d.khuc.push(value)
        d.dai += value.byteLength
        bao(d)
      }
      d.xong = true
    } catch {
      d.hong = true
    }
    bao(d)
  })()
  return d
}

/**
 * Trình phát xin đoạn `u`: trả bản đã/đang đọc trước (nếu có), và hẹn đọc trước các đoạn kế.
 * null = không có trong RAM (hoặc bản đọc trước đã hỏng ngay từ đầu), gọi bên ngoài tự tải như thường.
 */
export async function layDoan(u: string, ua: string): Promise<Response | null> {
  const t = trangThai()
  don()
  const vt = t.viTri.get(u)
  if (vt) {
    for (let k = 1; k <= SO_DOAN; k++) {
      const ke = vt.ds[vt.i + k]
      if (ke && !t.dem.has(ke)) t.dem.set(ke, batDauTai(ke, ua))
    }
    don()
  }
  const d = t.dem.get(u)
  if (!d) return null
  t.dem.delete(u)
  // Chờ khúc đầu tiên (hoặc lỗi) để còn kịp trả null cho đường tải thường
  while (!d.khuc.length && !d.hong && !d.xong) await new Promise<void>((r) => d.cho.push(r))
  if (d.hong && !d.khuc.length) return null
  let i = 0
  const luong = new ReadableStream<Uint8Array>({
    async pull(c) {
      while (i >= d.khuc.length && !d.xong && !d.hong) await new Promise<void>((r) => d.cho.push(r))
      if (i < d.khuc.length) c.enqueue(d.khuc[i++])
      else if (d.hong) c.error(new Error('đoạn đọc trước bị đứt'))
      else c.close()
    },
  })
  return new Response(luong, { status: 200, headers: { 'content-type': d.kieu, 'cache-control': 'public, max-age=3600' } })
}
