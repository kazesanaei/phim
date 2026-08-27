import Link from 'next/link'
import { timCacPhan } from '@/lib/phan-phim'
import { tienDoCuaPhim } from '@/lib/theo-doi'

/**
 * Dải chọn phần/season ở trang chi tiết. Nguồn coi mỗi phần là một phim riêng
 * nên phải tra lại bằng tìm kiếm; không có phần nào khác thì không hiện gì.
 */
export default async function ChonPhan({ ten, slugHienTai }: { ten: string; slugHienTai: string }) {
  const ds = await timCacPhan(ten)
  if (ds.length < 2) return null

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-white/70">Các phần ({ds.length})</h2>
      <div className="flex flex-wrap gap-2">
        {ds.map(({ phim, so }) => {
          const dang = phim.slug === slugHienTai
          // Phần nào đang xem dở thì chấm đỏ nhắc, khỏi phải mở từng phần ra dò.
          const dangDo = [...tienDoCuaPhim(phim.slug).values()].some((g) => !g.xong && g.vi_tri > 30)
          return (
            <Link
              key={phim.slug}
              href={`/phim/${phim.slug}`}
              className={`relative rounded px-3.5 py-2 text-sm transition ${
                dang
                  ? 'bg-white font-semibold text-black'
                  : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
              }`}
            >
              {so !== null ? `Phần ${so}` : phim.ten}
              {phim.nam && <span className={dang ? 'ml-1.5 text-black/50' : 'ml-1.5 text-white/40'}>{phim.nam}</span>}
              {dangDo && !dang && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--color-nhan)]" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
