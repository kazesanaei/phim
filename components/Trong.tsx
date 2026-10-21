import Link from 'next/link'

/**
 * Trạng thái trống / lỗi dùng chung: biểu tượng, một câu nói chuyện gì xảy ra,
 * và luôn có đường đi tiếp. Trang trống mà không có nút nào là ngõ cụt — trên
 * TV càng tệ vì không có thanh địa chỉ để thoát.
 */
type Nut = { nhan: string; href: string; chinh?: boolean }

const HINH = {
  tim: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  phim: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4z',
  loi: 'M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z',
  thich: 'M12 21s-8-4.9-8-10.4C4 7 6.5 5 9 5c1.8 0 3 1 3 1s1.2-1 3-1c2.5 0 5 2 5 5.6C20 16.1 12 21 12 21z',
}

export default function Trong({
  hinh = 'phim',
  tieuDe,
  moTa,
  nut = [],
  children,
}: {
  hinh?: keyof typeof HINH
  tieuDe: string
  moTa?: React.ReactNode
  nut?: Nut[]
  children?: React.ReactNode
}) {
  return (
    <div className="troi-len flex flex-col items-center px-4 py-16 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-mo ring-1 ring-white/10">
        <svg viewBox="0 0 24 24" aria-hidden className="h-8 w-8 fill-white/45">
          <path d={HINH[hinh]} />
        </svg>
      </div>
      <h2 className="text-lg font-bold">{tieuDe}</h2>
      {moTa && <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">{moTa}</p>}
      {(children || nut.length > 0) && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {children}
          {nut.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-white ${
                n.chinh ? 'bg-white text-black hover:bg-white/85' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {n.nhan}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
