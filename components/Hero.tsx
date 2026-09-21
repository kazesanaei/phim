import Link from 'next/link'
import Anh from '@/components/Anh'
import type { PhimTom } from '@/lib/vsmov'

/** Banner đầu trang chủ. Ảnh ngang nếu có, không thì lấy tạm poster. */
export default function Hero({ phim, moTa }: { phim: PhimTom; moTa?: string }) {
  const anh = phim.anhNgang || phim.poster
  return (
    <section className="relative min-h-[46vh] w-full overflow-hidden md:min-h-[62vh]">
      <Anh src={anh} rong={1280} uuTien anAnToan className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-nen)] via-[var(--color-nen)]/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--color-nen)] to-transparent" />

      <div className="relative flex min-h-[46vh] max-w-2xl flex-col justify-end gap-3 px-4 pb-10 pt-24 md:min-h-[62vh] md:px-8">
        <h1 className="text-3xl font-black leading-tight md:text-5xl">{phim.ten}</h1>
        <p className="text-sm text-white/60">
          {[phim.tenGoc, phim.nam, phim.chatLuong, phim.tapHienTai].filter(Boolean).join(' · ')}
        </p>
        {moTa && <p className="line-clamp-3 text-sm leading-relaxed text-white/75">{moTa}</p>}
        <div className="mt-2 flex gap-3">
          <Link
            href={`/xem/${phim.slug}`}
            className="rounded bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Xem ngay
          </Link>
          <Link
            href={`/phim/${phim.slug}`}
            className="rounded bg-white/15 px-6 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          >
            Thông tin
          </Link>
        </div>
      </div>
    </section>
  )
}
