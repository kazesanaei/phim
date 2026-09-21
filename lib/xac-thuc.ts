/**
 * Xác thực — CHỈ bật khi mở app ra LAN (xem TV Box, điện thoại trong nhà).
 *
 * Chạy `127.0.0.1` một mình thì không đòi đăng nhập: thêm mật khẩu vào lúc đó
 * chỉ là phiền phức vô ích. Nhưng mở ra mạng thì bắt buộc — `/quan-tri` xoá
 * được file thật và `/api/tep` đọc được file trong thư mục nguồn.
 *
 * Mật khẩu băm bằng scrypt (có trong node:crypto, không thêm gói nào). Phiên là
 * một cookie ký HMAC nên máy chủ không phải lưu danh sách phiên.
 */
import { cookies } from 'next/headers'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { layCaiDat, datCaiDat } from './db'

const TEN_COOKIE = 'phim_phien'
/**
 * Hạn của vé phiên. Dài vì gõ mật khẩu bằng remote TV rất khổ — mạng ở đây là
 * wifi trong nhà, không phải máy công cộng.
 * Đổi số này thì các vé ĐÃ CẤP vẫn giữ hạn cũ. Muốn đá hết thiết bị ra thì
 * đặt lại mật khẩu — `datMatKhau` xoay khoá ký nên vé cũ chết ngay.
 */
const HAN_NGAY = 365

export function laCheDoLan(): boolean {
  return layCaiDat('che_do_lan', '') === 'bat'
}

export function daDatMatKhau(): boolean {
  return !!layCaiDat('mat_khau_bam', '')
}

function khoaKy(): string {
  let k = layCaiDat('khoa_ky', '')
  if (!k) {
    k = randomBytes(32).toString('hex')
    datCaiDat('khoa_ky', k)
  }
  return k
}

export function datMatKhau(matKhau: string) {
  if (matKhau.length < 4) throw new Error('Mật khẩu quá ngắn (tối thiểu 4 ký tự)')
  const muoi = randomBytes(16).toString('hex')
  const bam = scryptSync(matKhau, muoi, 64).toString('hex')
  datCaiDat('mat_khau_bam', muoi + ':' + bam)
  /**
   * Xoay luôn khoá ký, nhờ đó mọi vé phiên cũ chết ngay.
   *
   * Vé ký bằng `khoa_ky` chứ không bằng mật khẩu, nên nếu không xoay thì đổi
   * mật khẩu chẳng đuổi được thiết bị nào — mà vé sống tới HAN_NGAY. Đây là
   * đường thu hồi duy nhất: mất điện thoại hay cho mượn nhà thì đặt lại mật
   * khẩu, mọi máy phải đăng nhập lại.
   */
  datCaiDat('khoa_ky', randomBytes(32).toString('hex'))
}

export function xoaMatKhau() {
  datCaiDat('mat_khau_bam', '')
}

export function dungMatKhau(matKhau: string): boolean {
  const luu = layCaiDat('mat_khau_bam', '')
  if (!luu) return false
  const [muoi, bam] = luu.split(':')
  if (!muoi || !bam) return false
  const thu = scryptSync(matKhau, muoi, 64)
  const goc = Buffer.from(bam, 'hex')
  // timingSafeEqual đòi hai bên cùng độ dài, và so sánh không rò rỉ thời gian
  return thu.length === goc.length && timingSafeEqual(thu, goc)
}

function ky(noiDung: string): string {
  return createHmac('sha256', khoaKy()).update(noiDung).digest('hex')
}

export function taoVePhien(): { ten: string; giaTri: string; hanGiay: number } {
  const hetHan = Date.now() + HAN_NGAY * 86400_000
  const than = String(hetHan)
  return { ten: TEN_COOKIE, giaTri: than + '.' + ky(than), hanGiay: HAN_NGAY * 86400 }
}

function vePhienHopLe(giaTri: string | undefined): boolean {
  if (!giaTri) return false
  const [than, chuKy] = giaTri.split('.')
  if (!than || !chuKy) return false
  const dung = ky(than)
  // So sánh chữ ký kiểu không rò rỉ thời gian
  const a = Buffer.from(chuKy)
  const b = Buffer.from(dung)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  return Number(than) > Date.now()
}

/** Đã qua cửa chưa? Không bật chế độ LAN thì luôn coi là qua. */
export async function daQuaCua(): Promise<boolean> {
  if (!laCheDoLan() || !daDatMatKhau()) return true
  const kho = await cookies()
  return vePhienHopLe(kho.get(TEN_COOKIE)?.value)
}

export { TEN_COOKIE }
