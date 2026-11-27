/**
 * Điện thoại làm remote cho TV (C3). Máy chủ chỉ là trạm chuyển: TV giữ một
 * luồng SSE theo mã ghép, điện thoại POST lệnh theo cùng mã, trạm đẩy sang.
 *
 * Giữ trong bộ nhớ (globalThis) chứ không ghi DB: mã chỉ sống chừng nào máy
 * chủ còn chạy, khởi động lại thì ghép lại — mất một lần quét QR, chẳng mất gì.
 * Cả hai đầu vẫn phải đăng nhập (proxy.ts) — mã ghép chỉ để chọn ĐÚNG cái TV.
 *
 * Hai chiều (C2): TV còn gửi lên TRẠNG THÁI đang phát (tên, giây, tập kế...),
 * trạm giữ bản mới nhất và đẩy cho các điện thoại đang xem cùng mã.
 */
import { randomInt } from 'node:crypto'

/**
 * Lệnh hợp lệ. `tim:` kèm chữ là gõ tìm kiếm bằng điện thoại; `tua:` kèm số
 * giây là kéo thanh thời gian; `tap:` kèm đường dẫn /xem/... là đổi tập.
 */
export const LENH = ['len', 'xuong', 'trai', 'phai', 'ok', 'lui', 'phat', 'tua-lui', 'tua-toi', 'phu-de'] as const
export type Lenh = (typeof LENH)[number] | `tim:${string}` | `tua:${number}` | `tap:${string}`

const SONG_MS = 12 * 3600_000

/** Trạng thái TV gửi lên; null = TV không ở trình phát. Trạm không đọc bên trong. */
export type TrangThai = Record<string, unknown> | null
/** Trạng thái là dữ liệu TV tự khai — chặn cỡ để không ai nhồi cả MB vào bộ nhớ. */
const TRAN_TRANG_THAI = 8_000

type Kenh = { nghe: Set<(l: Lenh) => void>; xem: Set<(t: TrangThai) => void>; tt: TrangThai; han: number }
const g = globalThis as unknown as { __dieuKhien?: Map<string, Kenh> }
const kho: Map<string, Kenh> = (g.__dieuKhien ??= new Map())

function don() {
  const bay = Date.now()
  for (const [ma, k] of kho) if (k.han < bay && !k.nghe.size && !k.xem.size) kho.delete(ma)
}

export function taoMa(): string {
  don()
  let ma: string
  do ma = String(randomInt(1000, 10000))
  while (kho.has(ma))
  kho.set(ma, { nghe: new Set(), xem: new Set(), tt: null, han: Date.now() + SONG_MS })
  return ma
}

export function hopLeLenh(x: unknown): x is Lenh {
  if (typeof x !== 'string') return false
  if (x.startsWith('tim:')) return x.length > 4 && x.length <= 104
  if (x.startsWith('tua:')) return /^tua:\d{1,6}(\.\d+)?$/.test(x)
  // Chỉ cho đổi sang trang xem phim của chính app — không thành lối chuyển hướng tuỳ ý.
  if (x.startsWith('tap:')) return /^tap:\/xem\/[\w%.~-]+(\?[\w%.~=&-]*)?$/.test(x) && x.length <= 300
  return (LENH as readonly string[]).includes(x)
}

/** Trả số TV đang nghe nhận được lệnh; 0 = mã sai/hết hạn hoặc TV đã tắt trang. */
export function guiLenh(ma: string, l: Lenh): number {
  const k = kho.get(ma)
  if (!k) return 0
  k.han = Date.now() + SONG_MS
  for (const f of k.nghe) f(l)
  return k.nghe.size
}

/** Đăng ký nghe; trả null nếu mã không tồn tại. */
export function nghe(ma: string, f: (l: Lenh) => void): (() => void) | null {
  const k = kho.get(ma)
  if (!k) return null
  k.nghe.add(f)
  return () => k.nghe.delete(f)
}

/** TV báo trạng thái; trả false nếu mã không còn hoặc quá cỡ. */
export function ghiTrangThai(ma: string, tt: TrangThai): boolean {
  const k = kho.get(ma)
  if (!k || JSON.stringify(tt).length > TRAN_TRANG_THAI) return false
  k.tt = tt
  for (const f of k.xem) f(tt)
  return true
}

/** Điện thoại theo dõi trạng thái; nhận ngay bản mới nhất. Null nếu mã không tồn tại. */
export function xemTrangThai(ma: string, f: (t: TrangThai) => void): (() => void) | null {
  const k = kho.get(ma)
  if (!k) return null
  k.xem.add(f)
  f(k.tt)
  return () => k.xem.delete(f)
}
