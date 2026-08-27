import Link from 'next/link'
import TheePhim from '@/components/TheePhim'
import PhanTrang from '@/components/PhanTrang'
import { timKiem } from '@/lib/nguon'
import { phimLocal } from '@/lib/thu-vien'
import { gomPhan } from '@/lib/phan-phim'

export const revalidate = 60

export default async function TrangTimKiem({ searchParams }: PageProps<'/tim-kiem'>) {
  const sp = await searchParams
  const q = (typeof sp.q === 'string' ? sp.q : '').trim()
  const trang = Math.max(1, Number(typeof sp.trang === 'string' ? sp.trang : '') || 1)

  if (!q) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Tìm phim</h1>
        <p className="mt-2 text-sm text-white/45">
          Gõ vào ô tìm ở đầu trang. Bấm phím <kbd className="rounded bg-white/10 px-1.5">/</kbd> để nhảy vào ô nhanh.
        </p>
      </div>
    )
  }

  // Nguồn đã tìm được không dấu sẵn phía máy chủ; kho local tự lọc bằng cột ten_khong_dau.
  const [tuNguon, tuMay] = await Promise.all([timKiem(q, trang), Promise.resolve(phimLocal({ tim: q, moiTrang: 24 }))])

  const khong = tuNguon.items.length === 0 && tuMay.items.length === 0

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <h1 className="text-xl font-semibold">
        Kết quả cho <span className="text-white/60">{q}</span>
      </h1>

      {khong && (
        <p className="py-16 text-center text-sm text-white/40">
          Không tìm thấy phim nào.{' '}
          <Link href="/duyet" className="underline underline-offset-2 hover:text-white">
            Thử duyệt theo thể loại
          </Link>
          .
        </p>
      )}

      {tuMay.items.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Trong máy ({tuMay.tongSo})</h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {tuMay.items.map((p) => (
              <TheePhim key={p.slug} phim={p} huyHieu="Trong máy" />
            ))}
          </div>
        </section>
      )}

      {tuNguon.items.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Từ vsmov ({tuNguon.tongSo})</h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {gomPhan(tuNguon.items).map((n) => (
              <TheePhim key={n.daiDien.slug} phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
            ))}
          </div>
          <PhanTrang
            trang={tuNguon.trang}
            tongTrang={tuNguon.tongTrang}
            duong={(t) => `/tim-kiem?q=${encodeURIComponent(q)}${t > 1 ? '&trang=' + t : ''}`}
          />
        </section>
      )}
    </div>
  )
}
