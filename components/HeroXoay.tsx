'use client'

/**
 * Banner đầu trang chủ, tự đổi phim. Netflix để banner tĩnh, nhưng Disney+,
 * Prime và hầu hết trang phim Việt đều xoay vòng — nhìn được nhiều phim hơn
 * trong cùng khoảng màn hình.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { urlAnh } from '@/components/Anh'
import type { PhimTom } from '@/lib/vsmov'

export type MucHero = { phim: PhimTom; moTa?: string }

const NHIP = 8000

export default function HeroXoay({ ds }: { ds: MucHero[] }) {
  const [i, datI] = useState(0)
  const [dungLai, datDungLai] = useState(false)
  const nhip = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (dungLai || ds.length < 2) return
    nhip.current = setInterval(() => datI((x) => (x + 1) % ds.length), NHIP)
    return () => {
      if (nhip.current) clearInterval(nhip.current)
    }
  }, [dungLai, ds.length])

  // Người dùng thích giảm chuyển động thì đứng yên.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) datDungLai(true)
  }, [])

  if (!ds.length) return null
  const { phim, moTa } = ds[i]
  const anh = phim.anhNgang || phim.poster

  return (
    /* md:min-h-[60vh] chứ không phải 72vh: đo ở khung 1440x900, banner 72vh
       chiếm 65% màn hình đầu và hàng "Tiếp tục xem" bị cắt mất đáy. Netflix để
       banner thấp đủ cho hàng đầu tiên LÓ lên — đó là thứ mời người xem cuộn. */
    <section
      className="co-banner relative min-h-[52vh] w-full overflow-hidden md:min-h-[60vh]"
      onMouseEnter={() => datDungLai(true)}
      onMouseLeave={() => datDungLai(false)}
    >
      {ds.map((m, k) => {
        const a = m.phim.anhNgang || m.phim.poster
        return (
          a && (
            // Xếp chồng và mờ dần thay vì tháo/lắp thẻ img — đỡ chớp trắng khi đổi.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.phim.slug}
              src={urlAnh(a, 1280)}
              alt=""
              aria-hidden
              loading={k === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                k === i ? 'anh-troi opacity-100' : 'opacity-0'
              }`}
            />
          )
        )
      })}
      {!anh && <div className="absolute inset-0 bg-[var(--color-nen-2)]" />}

      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-nen)] via-[var(--color-nen)]/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--color-nen)] to-transparent" />

      <div className="relative flex min-h-[52vh] max-w-2xl flex-col justify-end gap-3 px-4 pb-14 pt-24 md:min-h-[60vh] md:px-8">
        <h1 className="text-3xl font-black leading-tight drop-shadow-lg md:text-5xl">{phim.ten}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
          {phim.diem && <span className="font-semibold text-emerald-400">{phim.diem} điểm</span>}
          {[phim.nam, phim.chatLuong, phim.tapHienTai, phim.tenGoc].filter(Boolean).map((x, k) => (
            <span key={k}>{x}</span>
          ))}
        </p>
        {moTa && <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-white/75">{moTa}</p>}

        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            href={`/xem/${phim.slug}`}
            className="flex items-center gap-2 rounded bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
            Xem ngay
          </Link>
          <Link
            href={`/phim/${phim.slug}`}
            className="flex items-center gap-2 rounded bg-white/20 px-6 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            </svg>
            Thông tin
          </Link>
        </div>

        {ds.length > 1 && (
          /* Chấm chuyển banner: bấm bằng remote thì phải lách qua từng chấm rất
             phiền, mà banner vốn tự đổi. Ở chế độ TV ẩn đi (data-nut-chuot). */
          <div data-nut-chuot="1" className="mt-4 flex gap-2">
            {ds.map((m, k) => (
              <button
                key={m.phim.slug}
                onClick={() => datI(k)}
                aria-label={'Xem ' + m.phim.ten}
                aria-current={k === i}
                className={`h-1 rounded-full transition-all ${
                  k === i ? 'w-8 bg-white' : 'w-4 bg-white/35 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
