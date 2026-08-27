import Link from 'next/link'
import { connection } from 'next/server'
import { tongQuan, theLoaiHayXem, theoNgay, xemNhieuNhat, gioPhut } from '@/lib/thong-ke'

export const metadata = { title: 'Thống kê · Kho phim' }

const NGAY_TUAN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function O({ nhan, giaTri, phu }: { nhan: string; giaTri: string; phu?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-4">
      <p className="text-xs text-white/45">{nhan}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{giaTri}</p>
      {phu && <p className="mt-0.5 text-xs text-white/35">{phu}</p>}
    </div>
  )
}

/** Biểu đồ nhiệt 17 tuần gần nhất, mỗi cột là một tuần. */
function BieuDoNhiet({ ds }: { ds: { ngay: string; giay: number }[] }) {
  const theoNgayMap = new Map(ds.map((d) => [d.ngay, d.giay]))
  const dinh = Math.max(1, ...ds.map((d) => d.giay))

  // Dựng lưới lùi về đúng 17 tuần, bắt đầu từ Chủ nhật
  const homNay = new Date()
  const cot: { ngay: string; giay: number }[][] = []
  const cuoi = new Date(homNay)
  cuoi.setDate(cuoi.getDate() + (6 - cuoi.getDay()))
  for (let w = 16; w >= 0; w--) {
    const tuan: { ngay: string; giay: number }[] = []
    for (let d = 0; d < 7; d++) {
      const t = new Date(cuoi)
      t.setDate(cuoi.getDate() - w * 7 - (6 - d))
      const ngay = t.toISOString().slice(0, 10)
      tuan.push({ ngay, giay: theoNgayMap.get(ngay) || 0 })
    }
    cot.push(tuan)
  }

  const mau = (g: number) => {
    if (!g) return 'bg-white/[.06]'
    const m = g / dinh
    if (m > 0.66) return 'bg-[var(--color-nhan)]'
    if (m > 0.33) return 'bg-[var(--color-nhan)]/65'
    return 'bg-[var(--color-nhan)]/35'
  }

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between py-[2px] text-[9px] text-white/30">
        {NGAY_TUAN.map((n, i) => (
          <span key={n} className={i % 2 ? '' : 'opacity-0'}>
            {n}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px] overflow-x-auto">
        {cot.map((tuan, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {tuan.map((o) => (
              <div
                key={o.ngay}
                title={`${o.ngay}: ${o.giay ? gioPhut(o.giay) : 'không xem'}`}
                className={`h-[11px] w-[11px] rounded-[2px] ${mau(o.giay)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function TrangThongKe() {
  await connection()
  const tq = tongQuan()
  const theLoai = theLoaiHayXem()
  const ngay = theoNgay()
  const nhieu = xemNhieuNhat()

  if (tq.soMuc === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Thống kê xem phim</h1>
        <p className="mt-2 text-sm text-white/45">
          Chưa có gì để thống kê. Xem vài phim rồi quay lại đây.{' '}
          <Link href="/" className="underline underline-offset-2 hover:text-white">
            Về trang chủ
          </Link>
        </p>
      </div>
    )
  }

  const dinhTL = Math.max(1, ...theLoai.map((t) => t.n))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Thống kê xem phim</h1>
      <p className="mt-1 text-sm text-white/45">
        Tính theo vị trí dừng gần nhất của mỗi tập — là &ldquo;đã xem tới đâu&rdquo;, không phải thời gian thật sự
        ngồi trước màn hình.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <O nhan="Đã xem" giaTri={gioPhut(tq.tongGiay)} />
        <O nhan="Số tập đã mở" giaTri={String(tq.soMuc)} phu={`${tq.soXong} tập xem hết`} />
        <O
          nhan="Xem hết"
          giaTri={tq.soMuc ? Math.round((tq.soXong / tq.soMuc) * 100) + '%' : '0%'}
          phu="tỉ lệ xem tới cuối"
        />
        <O nhan="Phim trong máy" giaTri={String(tq.soPhimLocal)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white/70">17 tuần gần nhất</h2>
        <BieuDoNhiet ds={ngay} />
      </section>

      {theLoai.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-semibold text-white/70">Thể loại hay xem</h2>
          <p className="mb-3 text-xs text-white/35">
            Chỉ tính phim trong máy — phim xem từ nguồn không lưu thể loại vào máy.
          </p>
          <div className="space-y-1.5">
            {theLoai.map((t) => (
              <div key={t.ten} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm text-white/70">{t.ten}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-white/[.06]">
                  <div className="h-full rounded bg-[var(--color-nhan)]/70" style={{ width: (t.n / dinhTL) * 100 + '%' }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-white/45">{t.n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Xem nhiều nhất</h2>
        <ul className="space-y-2">
          {nhieu.map((p, i) => (
            <li key={p.slug}>
              <Link
                href={`/phim/${p.slug}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-vien)] bg-[var(--color-nen-2)] p-2 transition hover:border-white/25"
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-white/30">{i + 1}</span>
                {p.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.poster} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-black/40" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.ten || p.slug}</p>
                  <p className="text-xs text-white/40">
                    {gioPhut(p.giay)}
                    {p.soTap > 1 && ` · ${p.soTap} tập`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
