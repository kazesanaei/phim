'use client'

/**
 * Bảng cảnh báo trước khi xem phim GẮN MÁC 18+ (không phải phim bị chặn — phim
 * bị chặn không bao giờ tới được trang xem). Xem lib/loc-18.ts.
 *
 * Trình phát chỉ được dựng SAU khi bấm đồng ý: dựng sẵn ở phía sau thì nó tự
 * phát và tiếng đã chạy trong lúc bảng cảnh báo còn đang hiện.
 *
 * Nhớ theo PHIM chứ không theo tập: đồng ý một lần là xem cả bộ, không bắt bấm
 * lại mỗi tập. localStorage có thể bị chặn (chế độ ẩn danh) — khi đó hỏi lại
 * mỗi lần mở, không sao.
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

const KHOA = 'phim:da-dong-y-18'

function daDongY(slug: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KHOA) || '[]') as string[]).includes(slug)
  } catch {
    return false
  }
}

function ghiDongY(slug: string) {
  try {
    const ds = (JSON.parse(localStorage.getItem(KHOA) || '[]') as string[]).filter((s) => s !== slug)
    // Giữ 200 phim gần nhất cho khỏi phình
    localStorage.setItem(KHOA, JSON.stringify([slug, ...ds].slice(0, 200)))
  } catch {
    // bị chặn lưu trữ thì lần sau hỏi lại
  }
}

export default function CanhBao18({
  slug,
  tenPhim,
  veTrang,
  children,
}: {
  slug: string
  tenPhim: string
  veTrang: string
  children: React.ReactNode
}) {
  // null = chưa đọc xong localStorage; đừng nháy bảng cảnh báo rồi tắt ngay
  const [dongY, datDongY] = useState<boolean | null>(null)

  useEffect(() => datDongY(daDongY(slug)), [slug])

  if (dongY) return <>{children}</>

  return (
    <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-black px-6 text-center">
      {dongY === false && (
        <div className="max-w-md">
          <span className="inline-block rounded-md bg-red-600 px-3 py-1 text-lg font-black tracking-wide">18+</span>
          <h2 className="mt-4 text-lg font-bold">Phim có nội dung dành cho người lớn</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            <span className="font-semibold text-white/85">{tenPhim}</span> có cảnh nóng, bạo lực hoặc yếu tố gây sợ hãi,
            không phù hợp với người dưới 18 tuổi.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => {
                ghiDongY(slug)
                datDongY(true)
              }}
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Tôi đủ 18 tuổi, xem tiếp
            </button>
            <Link
              href={veTrang}
              className="rounded-md bg-white/12 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Quay lại
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
