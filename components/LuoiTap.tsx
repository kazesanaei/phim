'use client'

/**
 * Lưới tập, chia theo khoảng khi phim quá dài.
 *
 * VÌ SAO PHẢI CHIA: kho có bộ tới ~1176 tập. Đổ hết ra một lưới là 1176 nút
 * cùng lúc — trên PC phải cuộn mỏi tay, còn trên TV lái bằng con trỏ ảo thì
 * gần như không dùng nổi. Trang phim nào cũng chia 1-100 / 101-200 rồi cho
 * nhảy thẳng tới khoảng cần.
 *
 * Phim ngắn thì KHÔNG chia: thêm một hàng nút cho bộ 6 tập chỉ tổ rườm rà.
 */
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { xepTap } from '@/lib/xep-tap'

export type TapHien = {
  slug: string
  ten: string
  /** 0–100; >0 nghĩa là đang xem dở. */
  phanTram: number
  xong: boolean
}

/** Dưới ngưỡng này thì hiện phẳng như cũ. */
const NGUONG_CHIA = 60
const MOI_KHOANG = 100

export default function LuoiTap({
  slug,
  server,
  tap,
  dangXem,
}: {
  slug: string
  server: number
  tap: TapHien[]
  dangXem?: string
}) {
  /**
   * Sắp lại theo số tập trước khi hiển thị.
   *
   * Nguồn trả tập KHÔNG theo thứ tự: đo trên Đảo Hải Tặc (1178 tập) thì vị trí 0
   * là tập 1156, vị trí 500 là tập 680 — giảm dần theo từng khối. Để nguyên thì
   * lưới hiện lộn xộn (1156, 1157, ... 1127) và nhãn khoảng chồng lấn nhau.
   *
   * Chỉ sắp khi MỌI tên tập đều là số. Phim có tập đặc biệt hay "Full" thì giữ
   * nguyên thứ tự của nguồn, vì lúc đó nguồn mới là bên biết thứ tự đúng.
   */
  const tapXep = useMemo(() => xepTap(tap), [tap])

  const khoang = useMemo(() => {
    if (tapXep.length <= NGUONG_CHIA) return null
    const ra: { nhan: string; tu: number; den: number }[] = []
    for (let i = 0; i < tapXep.length; i += MOI_KHOANG) {
      const den = Math.min(i + MOI_KHOANG, tapXep.length)
      const lat = tapXep.slice(i, den)

      /**
       * Nhãn lấy NHỎ NHẤT – LỚN NHẤT, không phải đầu – cuối.
       *
       * Nguồn không trả tập theo thứ tự tăng: đo trên Đảo Hải Tặc (1178 tập) thì
       * vị trí 0 là tập 1156, vị trí 500 là tập 680 — giảm dần theo từng khối.
       * Lấy đầu–cuối ra nhãn ngược đời kiểu "1156 – 1067". Lấy min–max thì đọc
       * xuôi dù dữ liệu bên trong có lộn xộn thế nào.
       *
       * Tên tập không phải số (tập đặc biệt, "Full"...) thì lùi về đầu – cuối.
       */
      const so = lat.map((t) => Number(t.ten)).filter((n) => Number.isFinite(n))
      const nhan =
        so.length === lat.length
          ? `${Math.min(...so)} – ${Math.max(...so)}`
          : `${lat[0].ten} – ${lat[lat.length - 1].ten}`

      ra.push({ nhan, tu: i, den })
    }
    return ra
  }, [tapXep])

  // Mở sẵn đúng khoảng chứa tập đang xem, không bắt người dùng đi tìm.
  const [i, datI] = useState(() => {
    if (!khoang || !dangXem) return 0
    const vt = tapXep.findIndex((t) => t.slug === dangXem)
    return vt < 0 ? 0 : Math.floor(vt / MOI_KHOANG)
  })

  const hien = khoang ? tapXep.slice(khoang[i].tu, khoang[i].den) : tapXep

  return (
    <div>
      {khoang && (
        <div className="cuon-ngang mb-3 flex gap-2 overflow-x-auto pb-1">
          {khoang.map((k, n) => (
            <button
              key={k.nhan}
              onClick={() => datI(n)}
              aria-pressed={n === i}
              className={`shrink-0 rounded px-3 py-1.5 text-sm transition ${
                n === i
                  ? 'bg-white font-semibold text-black'
                  : 'bg-[var(--color-nen-2)] text-white/70 hover:bg-white/15 hover:text-white'
              }`}
            >
              {k.nhan}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {hien.map((t) => {
          const dang = t.slug === dangXem
          return (
            <Link
              key={t.slug}
              href={`/xem/${slug}?tap=${t.slug}&server=${server}`}
              title={t.xong ? 'Đã xem xong' : t.phanTram ? `Đang xem ${Math.round(t.phanTram)}%` : undefined}
              className={`relative overflow-hidden rounded px-2 py-2 text-center text-sm transition ${
                dang
                  ? 'bg-[var(--color-nhan)] font-semibold text-white'
                  : t.xong
                    ? 'bg-[var(--color-nen-2)] text-white/35 hover:text-white'
                    : 'bg-[var(--color-nen-2)] text-white/75 hover:bg-white/15 hover:text-white'
              }`}
            >
              {t.ten}
              {!dang && t.phanTram > 0 && !t.xong && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-nhan)]"
                  style={{ width: t.phanTram + '%' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
