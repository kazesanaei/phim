/**
 * Gợi ý "Vì bạn đã xem …".
 *
 * Dựa vào thể loại của những phim đã xem. Thể loại lấy từ hai chỗ:
 *  - kho đệm (`kho_the_loai`) cho phim từ nguồn — chính xác nhất, cần đã quét;
 *  - bảng `the_loai` cho phim trong máy.
 * Chưa có kho và chưa có phim local thì không gợi ý được gì thật, trả rỗng —
 * thà không hiện hàng nào còn hơn hiện "gợi ý" bốc đại.
 */
import { db } from './db'
import { duyet, type PhimTom } from './vsmov'
import { locKho, veTom, demKho } from './kho-nguon'

export type NhomGoiY = { theLoai: string; tenTheLoai: string; items: PhimTom[] }

/** Thể loại hay xem nhất, gộp từ cả kho đệm lẫn phim trong máy. */
function guTheLoai(gioiHan = 3): { slug: string; n: number }[] {
  const dem = new Map<string, number>()

  try {
    const a = db
      .prepare(
        `select k.slug_the_loai as slug, count(*) as n
         from xem x join kho_the_loai k on k.slug_phim = x.slug
         group by k.slug_the_loai`,
      )
      .all() as { slug: string; n: number }[]
    for (const r of a) dem.set(r.slug, (dem.get(r.slug) || 0) + r.n)
  } catch {
    // chưa có kho đệm
  }

  try {
    const b = db
      .prepare(
        `select t.slug as slug, count(*) as n
         from xem x join phim p on p.slug = x.slug join the_loai t on t.phim_id = p.id
         group by t.slug`,
      )
      .all() as { slug: string; n: number }[]
    for (const r of b) dem.set(r.slug, (dem.get(r.slug) || 0) + r.n)
  } catch {
    // chưa có phim local
  }

  return [...dem.entries()]
    .map(([slug, n]) => ({ slug, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, gioiHan)
}

function daXem(): Set<string> {
  try {
    return new Set((db.prepare('select distinct slug from xem').all() as { slug: string }[]).map((h) => h.slug))
  } catch {
    return new Set()
  }
}

/** Tên hiển thị của thể loại — lấy từ chính dữ liệu đã có, khỏi gọi API. */
function tenTheLoai(slug: string): string {
  try {
    const a = db.prepare('select ten from the_loai where slug = ? limit 1').get(slug) as { ten: string } | undefined
    if (a?.ten) return a.ten
  } catch {
    // bỏ qua
  }
  return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export async function goiY(soNhom = 2, moiNhom = 20): Promise<NhomGoiY[]> {
  const gu = guTheLoai(soNhom)
  if (!gu.length) return []

  const bo = daXem()
  const coKho = demKho() > 0
  const ra: NhomGoiY[] = []

  for (const g of gu) {
    let items: PhimTom[] = []
    if (coKho) {
      // Kho đệm cho phép lấy theo xếp hạng có trọng số, không phải bốc trang đầu.
      const r = locKho({ theLoai: [g.slug], sapXep: 'diem', moiTrang: moiNhom + bo.size, gomPhan: true })
      items = r.items.map(veTom)
    } else {
      const r = await duyet({ theLoai: g.slug, trang: 1 })
      items = r.items
    }
    const loc = items.filter((p) => !bo.has(p.slug)).slice(0, moiNhom)
    if (loc.length >= 5) ra.push({ theLoai: g.slug, tenTheLoai: tenTheLoai(g.slug), items: loc })
  }

  return ra
}
