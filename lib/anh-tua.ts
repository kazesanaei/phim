/**
 * Ảnh xem trước khi tua (sprite).
 *
 * Nguồn KHÔNG cung cấp sprite, nên phải tự sinh bằng ffmpeg — mỗi phim tốn hàng
 * chục giây tới vài phút CPU. Vì vậy chỉ làm cho FILE TRONG MÁY (và phim đã tải
 * về, vốn cũng là file trong máy), chạy nền, và chỉ khi người dùng bấm.
 *
 * Gộp tất cả khung hình vào MỘT ảnh lưới 10x10: một lượt tải là đủ cho cả phim,
 * thay vì 100 lượt tải ảnh rời.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { db } from './db'
import { timLenh, docThongTin } from './ffmpeg'

const COT = 10
const HANG = 10
const RONG_O = 160
const CAO_O = 90

export type AnhTua = {
  url: string
  giay: number
  cot: number
  rongO: number
  caoO: number
  tong: number
}

const dangLam = new Set<number>()

function thuMucTua(): string {
  return path.join(process.cwd(), 'public', 'tua')
}

function duongAnh(tapId: number): string {
  return path.join(thuMucTua(), tapId + '.jpg')
}

/** Đã có sprite chưa? Trả về meta để player dùng luôn. */
export function layAnhTua(tapId: number): AnhTua | null {
  const h = db.prepare('select thoi_luong from tap where id = ?').get(tapId) as
    | { thoi_luong: number | null }
    | undefined
  if (!h?.thoi_luong || !existsSync(duongAnh(tapId))) return null
  const tong = COT * HANG
  return {
    url: '/tua/' + tapId + '.jpg',
    giay: Math.max(2, h.thoi_luong / tong),
    cot: COT,
    rongO: RONG_O,
    caoO: CAO_O,
    tong,
  }
}

export function dangSinh(tapId: number): boolean {
  return dangLam.has(tapId)
}

/**
 * Sinh sprite ở chế độ nền. Trả về ngay, không chờ.
 * Đã có ảnh rồi hoặc đang sinh thì bỏ qua.
 */
export async function sinhAnhTua(tapId: number): Promise<'da-co' | 'dang-lam' | 'bat-dau' | 'khong-duoc'> {
  if (existsSync(duongAnh(tapId))) return 'da-co'
  if (dangLam.has(tapId)) return 'dang-lam'

  const h = db.prepare('select duong_dan_file, thoi_luong from tap where id = ?').get(tapId) as
    | { duong_dan_file: string | null; thoi_luong: number | null }
    | undefined
  if (!h?.duong_dan_file || !existsSync(h.duong_dan_file)) return 'khong-duoc'

  let lenh: string
  try {
    lenh = timLenh('ffmpeg')
  } catch {
    return 'khong-duoc'
  }

  dangLam.add(tapId)
  void (async () => {
    try {
      await mkdir(thuMucTua(), { recursive: true })
      let thoiLuong = h.thoi_luong || 0
      if (!thoiLuong) thoiLuong = (await docThongTin(h.duong_dan_file!))?.thoiLuong || 0
      if (!thoiLuong) return

      const nhip = Math.max(2, thoiLuong / (COT * HANG))
      await new Promise<void>((xong, hong) => {
        const p = spawn(
          lenh,
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            h.duong_dan_file!,
            '-vf',
            `fps=1/${nhip.toFixed(3)},scale=${RONG_O}:${CAO_O},tile=${COT}x${HANG}`,
            '-frames:v',
            '1',
            '-q:v',
            '6',
            '-y',
            duongAnh(tapId),
          ],
          { windowsHide: true },
        )
        p.on('error', hong)
        p.on('close', (ma) => (ma === 0 ? xong() : hong(new Error('ffmpeg mã ' + ma))))
      })
    } catch (e) {
      console.warn('[anh-tua] hỏng tập', tapId, e instanceof Error ? e.message : e)
    } finally {
      dangLam.delete(tapId)
    }
  })()

  return 'bat-dau'
}
