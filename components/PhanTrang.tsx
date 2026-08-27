import Link from 'next/link'

/** Vài trang quanh trang hiện tại, cộng trang đầu/cuối. Nguồn có tới ~1900 trang. */
function cacTrang(hienTai: number, tong: number): (number | '...')[] {
  const ra = new Set<number>([1, tong])
  for (let i = hienTai - 2; i <= hienTai + 2; i++) if (i > 0 && i <= tong) ra.add(i)
  const sap = [...ra].sort((a, b) => a - b)
  const cuoi: (number | '...')[] = []
  sap.forEach((n, i) => {
    if (i > 0 && n - (sap[i - 1] as number) > 1) cuoi.push('...')
    cuoi.push(n)
  })
  return cuoi
}

export default function PhanTrang({
  trang,
  tongTrang,
  duong,
}: {
  trang: number
  tongTrang: number
  /** Nhận số trang, trả về href. */
  duong: (t: number) => string
}) {
  if (tongTrang <= 1) return null
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Phân trang">
      {trang > 1 && (
        <Link href={duong(trang - 1)} className="rounded bg-[var(--color-nen-2)] px-3 py-1.5 text-sm hover:bg-white/15">
          Trước
        </Link>
      )}
      {cacTrang(trang, tongTrang).map((t, i) =>
        t === '...' ? (
          <span key={'x' + i} className="px-1.5 text-white/30">
            ...
          </span>
        ) : (
          <Link
            key={t}
            href={duong(t)}
            className={`rounded px-3 py-1.5 text-sm tabular-nums ${
              t === trang ? 'bg-white font-semibold text-black' : 'bg-[var(--color-nen-2)] hover:bg-white/15'
            }`}
          >
            {t}
          </Link>
        ),
      )}
      {trang < tongTrang && (
        <Link href={duong(trang + 1)} className="rounded bg-[var(--color-nen-2)] px-3 py-1.5 text-sm hover:bg-white/15">
          Sau
        </Link>
      )}
    </nav>
  )
}
