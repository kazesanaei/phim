/**
 * "Xem gì đó đi" — bốc ngẫu nhiên một phim rồi phát luôn.
 *
 * Ưu tiên theo gu: thể loại hay xem nhất trong lịch sử > danh sách xem sau >
 * phim mới. Bỏ qua phim đã xem xong để khỏi bốc trúng thứ vừa xem.
 */
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { duyet, layDanhSach, type PhimTom } from '@/lib/vsmov'
import { layPhimLocalMoi } from '@/lib/thu-vien'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function boc<T>(ds: T[]): T | null {
  return ds.length ? ds[Math.floor(Math.random() * ds.length)] : null
}

/** Thể loại xuất hiện nhiều nhất trong lịch sử xem của phim local. */
function theLoaiHayXem(): string[] {
  try {
    const hang = db
      .prepare(
        `select t.slug, count(*) as n
         from xem x
         join phim p on p.slug = x.slug
         join the_loai t on t.phim_id = p.id
         group by t.slug order by n desc limit 3`,
      )
      .all() as { slug: string }[]
    return hang.map((h) => h.slug)
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const chiLocal = sp.get('nguon') === 'local'

  // Đã xem xong thì đừng bốc lại
  const daXong = new Set(
    (db.prepare('select slug from xem where xong = 1').all() as { slug: string }[]).map((h) => h.slug),
  )

  if (chiLocal) {
    const ds = layPhimLocalMoi(200).filter((p) => !daXong.has(p.slug))
    const chon = boc(ds)
    redirect(chon ? `/xem/${chon.slug}` : '/duyet?nguon=local')
  }

  let kho: PhimTom[] = []
  const gu = theLoaiHayXem()

  if (gu.length) {
    const theo = await Promise.all(gu.map((slug) => duyet({ theLoai: slug, trang: 1 })))
    kho = theo.flatMap((t) => t.items)
  }

  // Chưa có gu (lịch sử trống) thì lấy phim mới + phim lẻ cho rộng cửa
  if (kho.length < 10) {
    const [moi, le] = await Promise.all([layDanhSach('phim-moi-cap-nhat', 1), layDanhSach('phim-le', 1)])
    kho = [...kho, ...moi.items, ...le.items]
  }

  // Trộn thêm kho trong máy để không phải lúc nào cũng ra phim trên mạng
  kho = [...kho, ...layPhimLocalMoi(50)]

  const conLai = kho.filter((p) => !daXong.has(p.slug))
  const chon = boc(conLai.length ? conLai : kho)
  redirect(chon ? `/xem/${chon.slug}` : '/duyet')
}
