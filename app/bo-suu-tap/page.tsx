import TheePhim from '@/components/TheePhim'
import { danhDauTheoLoai, lichSuXem } from '@/lib/theo-doi'
import { coMac18 } from '@/lib/loc-18'
import type { PhimTom } from '@/lib/vsmov'
import Trong from '@/components/Trong'

export const dynamic = 'force-dynamic'

function phut(giay: number) {
  return Math.max(1, Math.round(giay / 60))
}

export default function TrangBoSuuTap() {
  const thich = danhDauTheoLoai('thich')
  const xemSau = danhDauTheoLoai('xem_sau')
  const lichSu = lichSuXem(60)

  const trong = thich.length === 0 && xemSau.length === 0 && lichSu.length === 0

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <h1 className="text-2xl font-bold">Bộ sưu tập</h1>

      {trong && (
        <Trong
          hinh="thich"
          tieuDe="Bộ sưu tập còn trống"
          moTa="Bấm dấu + trên thẻ phim, hoặc Yêu thích / Xem sau ở trang phim, là phim nằm ở đây."
          nut={[
            { nhan: 'Về trang chủ', href: '/', chinh: true },
            { nhan: 'Duyệt phim', href: '/duyet' },
          ]}
        />
      )}

      {thich.length > 0 && (
        <Muc tieuDe={`Yêu thích (${thich.length})`}>
          {thich.map((d) => (
            <TheePhim
              key={d.khoa}
              phim={
                {
                  slug: d.khoa,
                  ten: d.ten || d.khoa,
                  poster: d.poster || undefined,
                  nam: d.nam || undefined,
                  nguon: d.nguon as 'vsmov' | 'local',
                  la18: coMac18(d.khoa, d.ten || d.khoa),
                } satisfies PhimTom
              }
            />
          ))}
        </Muc>
      )}

      {xemSau.length > 0 && (
        <Muc tieuDe={`Xem sau (${xemSau.length})`}>
          {xemSau.map((d) => (
            <TheePhim
              key={d.khoa}
              phim={
                {
                  slug: d.khoa,
                  ten: d.ten || d.khoa,
                  poster: d.poster || undefined,
                  nam: d.nam || undefined,
                  nguon: d.nguon as 'vsmov' | 'local',
                  la18: coMac18(d.khoa, d.ten || d.khoa),
                } satisfies PhimTom
              }
            />
          ))}
        </Muc>
      )}

      {lichSu.length > 0 && (
        <Muc tieuDe={`Lịch sử xem (${lichSu.length})`}>
          {lichSu.map((x) => {
            const pt = x.thoi_luong ? (x.vi_tri / x.thoi_luong) * 100 : 0
            return (
              <TheePhim
                key={x.khoa}
                href={`/xem/${x.slug}${x.tap ? '?tap=' + x.tap : ''}`}
                phim={
                  {
                    slug: x.slug,
                    ten: x.ten || x.slug,
                    poster: x.poster || undefined,
                    nguon: x.nguon as 'vsmov' | 'local',
                    la18: coMac18(x.slug, x.ten || x.slug),
                  } satisfies PhimTom
                }
                tienDo={{
                  phanTram: pt,
                  nhan: x.xong ? 'Đã xem xong' : `Đang xem · còn ${phut(x.thoi_luong - x.vi_tri)} phút`,
                }}
              />
            )
          })}
        </Muc>
      )}
    </div>
  )
}

function Muc({ tieuDe, children }: { tieuDe: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-sm font-semibold text-white/70">{tieuDe}</h2>
      <div className="luoi-phim grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">{children}</div>
    </section>
  )
}
