/**
 * Giải mã link_embed thành m3u8 + danh sách phụ đề.
 * Dùng chung cho route /api/nguon (player) và bộ tải offline.
 */
import { urlChoPhep, LoiChan } from './an-toan'
import { UA } from './ffmpeg'
import { nhanNgonNgu } from './phu-de'

export type PhuDeNguon = { ma: string; nhan: string; url: string }
export type KetQuaNguon = { m3u8: string; phuDe: PhuDeNguon[] }

/** Cắt đúng mảng JSON sau một khoá, đếm ngoặc và bỏ qua ngoặc nằm trong chuỗi. */
function catMangJson(html: string, khoa: string): string | null {
  const i = html.indexOf(khoa)
  if (i < 0) return null
  const batDau = html.indexOf('[', i)
  if (batDau < 0) return null
  let sau = 0
  let trongChuoi = false
  let thoat = false
  for (let j = batDau; j < html.length; j++) {
    const c = html[j]
    if (trongChuoi) {
      if (thoat) thoat = false
      else if (c === '\\') thoat = true
      else if (c === '"') trongChuoi = false
      continue
    }
    if (c === '"') trongChuoi = true
    else if (c === '[') sau++
    else if (c === ']') {
      sau--
      if (sau === 0) return html.slice(batDau, j + 1)
    }
  }
  return null
}

function docPhuDe(html: string, goc: string): PhuDeNguon[] {
  const tho = catMangJson(html, 'subtitles')
  if (!tho) return []
  let mang: Record<string, unknown>[]
  try {
    mang = JSON.parse(tho)
  } catch {
    return []
  }
  const dem: Record<string, number> = {}
  return mang
    .map((s) => {
      const url = String(s.url || '')
      if (!url) return null
      const ma = String(s.code || '').toLowerCase() || 'und'
      dem[ma] = (dem[ma] || 0) + 1
      return {
        ma,
        nhan: nhanNgonNgu(ma) + (dem[ma] > 1 ? ' ' + dem[ma] : ''),
        url: new URL(url, goc).href,
      }
    })
    .filter((x): x is PhuDeNguon => x !== null)
}

export async function giaiMaEmbed(embed: string): Promise<KetQuaNguon> {
  const u = urlChoPhep(embed)
  const doan = u.pathname.split('/').filter(Boolean)
  const hash = doan[doan.length - 1] || ''
  if (!/^[A-Za-z0-9_-]{8,}$/.test(hash)) throw new LoiChan('Mã video không hợp lệ')

  const r = await fetch(u, { headers: { 'user-agent': UA, referer: 'https://vsmov.com/' }, cache: 'no-store' })
  if (!r.ok) throw new Error('Không mở được trang phát (' + r.status + ')')
  const html = await r.text()

  return {
    m3u8: u.origin + '/stream/' + hash + '/master.m3u8',
    phuDe: docPhuDe(html, u.origin),
  }
}
