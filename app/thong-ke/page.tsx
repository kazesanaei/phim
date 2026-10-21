import Link from 'next/link'
import Anh from '@/components/Anh'
import { connection } from 'next/server'
import { tongQuan, theLoaiHayXem, theoNgay, xemNhieuNhat, gioPhut, cacNam, namXem, type NamXem } from '@/lib/thong-ke'
import Trong from '@/components/Trong'

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
    if (!g) return 'bg-mo'
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

function NamCuaBan({ n, cac }: { n: NamXem; cac: string[] }) {
  const anh = n.phimDinh?.anh || n.phimDinh?.poster
  const buoi = n.gioHay === null ? null : n.gioHay < 5 ? 'đêm khuya' : n.gioHay < 12 ? 'buổi sáng' : n.gioHay < 18 ? 'buổi chiều' : 'buổi tối'
  return (
    <section className="relative mt-6 overflow-hidden rounded-2xl ring-1 ring-white/10">
      {anh && (
        <Anh src={anh} rong={800} anAnToan className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-nhan)]/35 via-[var(--color-nen)]/70 to-[var(--color-nen)]" />
      <div className="relative p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-black md:text-4xl">Năm {n.nam} của bạn</h2>
          {cac.length > 1 && (
            <nav className="flex gap-1.5">
              {cac.map((y) => (
                <Link
                  key={y}
                  href={'/thong-ke?nam=' + y}
                  aria-current={y === n.nam ? 'page' : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${y === n.nam ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {y}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <p className="chu-hien-thi mt-6 text-5xl font-black tabular-nums md:text-7xl">{gioPhut(n.giay)}</p>
        <p className="mt-1 text-sm text-white/60">
          {n.soPhim} phim · {n.soTap} tập đã mở
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {n.phimDinh && (
            <Link href={`/phim/${n.phimDinh.slug}`} className="rounded-xl bg-black/30 p-4 ring-1 ring-white/10 transition hover:bg-black/45 sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-white/45">Phim của năm</p>
              <p className="chu-hien-thi mt-1 line-clamp-2 text-xl font-bold">{n.phimDinh.ten || n.phimDinh.slug}</p>
              <p className="mt-1 text-xs text-white/50">{gioPhut(n.phimDinh.giay)}</p>
            </Link>
          )}
          {buoi && (
            <div className="rounded-xl bg-black/30 p-4 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-wider text-white/45">Hay xem vào</p>
              <p className="chu-hien-thi mt-1 text-xl font-bold">{buoi}</p>
              <p className="mt-1 text-xs text-white/50">quanh {n.gioHay} giờ</p>
            </div>
          )}
          <div className="rounded-xl bg-black/30 p-4 ring-1 ring-white/10">
            <p className="text-xs uppercase tracking-wider text-white/45">Chuỗi dài nhất</p>
            <p className="chu-hien-thi mt-1 text-xl font-bold">{n.chuoiDai} ngày liền</p>
            {n.thangDinh && <p className="mt-1 text-xs text-white/50">xem nhiều nhất tháng {n.thangDinh.thang}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

export default async function TrangThongKe({ searchParams }: PageProps<'/thong-ke'>) {
  await connection()
  const sp = await searchParams
  const cac = cacNam()
  const nam = typeof sp.nam === 'string' && cac.includes(sp.nam) ? sp.nam : cac[0]
  const tq = tongQuan()
  const theLoai = theLoaiHayXem()
  const ngay = theoNgay()
  const nhieu = xemNhieuNhat()

  if (tq.soMuc === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Thống kê xem phim</h1>
        <Trong
          tieuDe="Chưa có gì để thống kê"
          moTa="Xem vài phim rồi quay lại — ở đây sẽ có giờ xem, thể loại hay xem và năm xem phim của bạn."
          nut={[{ nhan: 'Tìm phim để xem', href: '/', chinh: true }]}
        />
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

      {nam && <NamCuaBan n={namXem(nam)} cac={cac} />}

      <h2 className="mt-10 text-lg font-bold">Toàn bộ</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
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
                <div className="h-4 flex-1 overflow-hidden rounded bg-mo">
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
                  <Anh src={p.poster} rong={200} anAnToan className="h-14 w-10 shrink-0 rounded object-cover" />
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
