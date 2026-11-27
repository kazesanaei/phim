import Link from 'next/link'
import { connection } from 'next/server'
import Anh from '@/components/Anh'
import Trong from '@/components/Trong'
import { lichTuan, truocDay, type MucLich } from '@/lib/lich-tap'
import { mucDo18 } from '@/lib/loc-18'

export const metadata = { title: 'Lịch tuần · Kho phim' }

/** Tuần bắt đầu từ Thứ Hai; số là getDay() (0 = Chủ nhật). */
const TUAN = [1, 2, 3, 4, 5, 6, 0]
const TEN_THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function The({ m }: { m: MucLich }) {
  return (
    <Link
      href={`/phim/${m.slug}`}
      className="flex items-center gap-2.5 rounded-lg bg-[var(--color-nen-2)] p-1.5 ring-1 ring-white/5 transition hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-white"
    >
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-black/40">
        <Anh src={m.poster} rong={200} anAnToan className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] leading-snug">{m.ten}</p>
        {m.tapMoi ? (
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--color-nhan)]">Có tập mới</p>
        ) : (
          m.lanCuoi && <p className="mt-0.5 text-[11px] text-white/40">Lên tập {truocDay(m.lanCuoi)}</p>
        )}
      </div>
    </Link>
  )
}

export default async function TrangLich() {
  await connection()
  // Chặn 18+ tuyệt đối, kể cả phim chỉ bị gắn mác.
  const ds = lichTuan().filter((m) => !mucDo18({ slug: m.slug, ten: m.ten }))
  // Giờ Việt Nam, như lib/nhip-tap.ts (máy chủ có thể chạy giờ khác).
  const homNay = new Date(Date.now() + 7 * 3_600_000).getUTCDay()
  const hangNgay = ds.filter((m) => m.thu === 'ngay')
  const chuaRo = ds.filter((m) => m.thu === null)

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <h1 className="text-2xl font-bold">Lịch tuần</h1>
      <p className="mt-1 max-w-2xl text-sm text-white/50">
        Phim bộ bạn đang theo dõi hoặc đang xem dở, xếp theo thứ hay có tập mới. Lịch đoán từ chính những lần nguồn lên
        tập — phim mới theo dõi cần vài tuần mới đủ dữ liệu.
      </p>

      {ds.length === 0 ? (
        <Trong
          tieuDe="Chưa có phim bộ nào để xếp lịch"
          moTa="Bấm Theo dõi ở trang một phim bộ đang chiếu, hoặc xem dở một tập, là phim đó lên lịch ở đây."
          nut={[{ nhan: 'Xem phim bộ', href: '/duyet?danh-sach=phim-bo', chinh: true }]}
        />
      ) : (
        <>
          <div className="lich-tuan mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {TUAN.map((thu) => {
              const trongNgay = ds.filter((m) => Array.isArray(m.thu) && m.thu.includes(thu))
              const laHomNay = thu === homNay
              return (
                <section
                  key={thu}
                  aria-label={TEN_THU[thu]}
                  className={`flex flex-col gap-2 rounded-xl p-2.5 ring-1 ${
                    laHomNay ? 'bg-[var(--color-nhan)]/10 ring-[var(--color-nhan)]/50' : 'bg-mo ring-white/5'
                  }`}
                >
                  <h2 className="flex items-baseline justify-between px-1 text-sm font-bold">
                    {TEN_THU[thu]}
                    {laHomNay && <span className="text-[11px] font-semibold text-[var(--color-nhan)]">Hôm nay</span>}
                  </h2>
                  {trongNgay.map((m) => (
                    <The key={m.slug} m={m} />
                  ))}
                  {!trongNgay.length && <p className="px-1 text-xs text-white/25">—</p>}
                </section>
              )
            })}
          </div>

          {hangNgay.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-white/70">Gần như ngày nào cũng có tập</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {hangNgay.map((m) => (
                  <The key={m.slug} m={m} />
                ))}
              </div>
            </section>
          )}

          {chuaRo.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 text-sm font-semibold text-white/70">Chưa đủ dữ liệu để đoán lịch</h2>
              <p className="mb-3 text-xs text-white/35">Cần ít nhất 3 lần lên tập có nhịp rõ ràng.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {chuaRo.map((m) => (
                  <The key={m.slug} m={m} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
