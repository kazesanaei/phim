/**
 * Điện thoại làm remote cho TV (C3). Máy chủ chỉ là trạm chuyển: TV giữ một
 * luồng SSE theo mã ghép, điện thoại POST lệnh theo cùng mã, trạm đẩy sang.
 *
 * Giữ trong bộ nhớ (globalThis) chứ không ghi DB: mã chỉ sống chừng nào máy
 * chủ còn chạy, khởi động lại thì ghép lại — mất một lần quét QR, chẳng mất gì.
 * Cả hai đầu vẫn phải đăng nhập (proxy.ts) — mã ghép chỉ để chọn ĐÚNG cái TV.
 */
import { randomInt } from 'node:crypto'

/** Lệnh hợp lệ. `tim:` kèm chữ là gõ tìm kiếm bằng bàn phím điện thoại. */
export const LENH = ['len', 'xuong', 'trai', 'phai', 'ok', 'lui', 'phat', 'tua-lui', 'tua-toi'] as const
export type Lenh = (typeof LENH)[number] | `tim:${string}`

const SONG_MS = 12 * 3600_000

type Kenh = { nghe: Set<(l: Lenh) => void>; han: number }
const g = globalThis as unknown as { __dieuKhien?: Map<string, Kenh> }
const kho: Map<string, Kenh> = (g.__dieuKhien ??= new Map())

function don() {
  const bay = Date.now()
  for (const [ma, k] of kho) if (k.han < bay && !k.nghe.size) kho.delete(ma)
}

export function taoMa(): string {
  don()
  let ma: string
  do ma = String(randomInt(1000, 10000))
  while (kho.has(ma))
  kho.set(ma, { nghe: new Set(), han: Date.now() + SONG_MS })
  return ma
}

export function hopLeLenh(x: unknown): x is Lenh {
  if (typeof x !== 'string') return false
  if (x.startsWith('tim:')) return x.length > 4 && x.length <= 104
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
