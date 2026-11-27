import TheePhim from '@/components/TheePhim'
import PhanTrang from '@/components/PhanTrang'
import { timKiem } from '@/lib/nguon'
import { phimLocal } from '@/lib/thu-vien'
import { gomPhan } from '@/lib/phan-phim'
import { phimTheoSlug, veTom, locKho, namTrongKho } from '@/lib/kho-nguon'
import { phimTheoNguoi, timTenNguoi } from '@/lib/quet-nguoi'
import { lichSuXem } from '@/lib/theo-doi'
import LocKetQua from '@/components/LocKetQua'
import { capNhatPhimMoi, trangThaiCapNhat } from '@/lib/cap-nhat-moi'
import Trong from '@/components/Trong'
import Link from 'next/link'
import Anh from '@/components/Anh'
import { timCauThoai } from '@/lib/cau-thoai'

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

  /**
   * Bộ lọc trong kết quả.
   *
   * Endpoint tìm kiếm của nguồn chỉ nhận từ khoá — không lọc được theo loại hay
   * năm. Nên hễ bật một bộ lọc là chuyển hẳn sang kho đệm trong máy, chỗ duy
   * nhất làm được việc đó. Không lọc thì vẫn hỏi nguồn như cũ vì nguồn mới hơn.
   */
  const fLoai = typeof sp.loai === 'string' ? sp.loai : ''
  const fNam = typeof sp.nam === 'string' ? sp.nam : ''
  const fChuaXem = sp['chua-xem'] === '1'
  const coLoc = !!(fLoai || fNam || fChuaXem)

  // Nguồn đã tìm được không dấu sẵn phía máy chủ; kho local tự lọc bằng cột ten_khong_dau.
  const [tuNguon, tuMay] = await Promise.all([
    coLoc ? Promise.resolve({ items: [], tongSo: 0, tongTrang: 1, trang: 1 }) : timKiem(q, trang),
    Promise.resolve(phimLocal({ tim: q, moiTrang: 24 })),
  ])

  /**
   * Kho đệm cũng là một nguồn kết quả, không chỉ để lọc. Nguồn tìm theo nguyên
   * cụm nên hay trượt tên tiếng Anh; kho thì tìm theo từng từ trên cả tên Việt,
   * tên gốc lẫn slug, và được lib/cap-nhat-moi.ts bổ sung phim mới liên tục.
   * Chỉ hiện phim mà nguồn KHÔNG trả về, để khỏi lặp thẻ.
   */
  capNhatPhimMoi()
  const daCoTuNguon = new Set([...tuNguon.items, ...tuMay.items].map((p) => p.slug))
  const tuKhoDem =
    !coLoc && trang === 1
      ? locKho({ tim: q, moiTrang: 24, gomPhan: true })
          .items.map(veTom)
          .filter((p) => !daCoTuNguon.has(p.slug))
      : []

  const daXem = coLoc && fChuaXem ? new Set(lichSuXem(500).map((x) => x.slug)) : null
  const tuKho = coLoc
    ? (() => {
        const kq = locKho({ tim: q, loai: fLoai || undefined, nam: fNam || undefined, trang, moiTrang: 24, gomPhan: true })
        const items = kq.items.map(veTom).filter((p) => !daXem || !daXem.has(p.slug))
        return { ...kq, items }
      })()
    : null

  /** Năm để chọn trong thanh lọc — lấy từ chính kho nên không đưa ra năm rỗng. */
  const namCoTrongKho = namTrongKho(10)

  /**
   * Tìm theo tên người. Nguồn KHÔNG làm được việc này (đã thử /dien-vien và
   * ?actor=, xem lib/quet-nguoi.ts) nên hoàn toàn dựa vào chỉ mục tự quét.
   * Chưa quét thì hai mảng dưới đây rỗng và cả khối tự biến mất.
   * Chỉ tra ở trang 1: các trang sau là phân trang của riêng kết quả từ nguồn.
   */
  const tenNguoi = trang === 1 ? timTenNguoi(q, 3) : []
  const phimCuaNguoi = trang === 1 ? phimTheoSlug(phimTheoNguoi(q, 120), 24).map(veTom) : []

  const cauThoai = q ? timCauThoai(q) : []

  // Có lọc thì khối "Đã lọc" tự lo phần báo rỗng, đừng báo trùng hai lần.
  const khong =
    !coLoc &&
    cauThoai.length === 0 &&
    tuNguon.items.length === 0 &&
    tuMay.items.length === 0 &&
    tuKhoDem.length === 0 &&
    phimCuaNguoi.length === 0
  const dangCapNhat = khong && trangThaiCapNhat().dangChay

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <h1 className="text-xl font-semibold">
        Kết quả cho <span className="text-white/60">{q}</span>
      </h1>

      <LocKetQua nam={namCoTrongKho} />

      {tuKho && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Đã lọc ({tuKho.tongSo})</h2>
          {tuKho.items.length === 0 ? (
            <p className="py-10 text-sm text-white/40">Không có phim nào khớp bộ lọc này.</p>
          ) : (
            <>
              <div className="luoi-phim grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {tuKho.items.map((p) => (
                  <TheePhim key={p.slug} phim={p} />
                ))}
              </div>
              <PhanTrang
                trang={tuKho.trang}
                tongTrang={tuKho.tongTrang}
                duong={(t) => {
                  const m = new URLSearchParams({ q })
                  if (fLoai) m.set('loai', fLoai)
                  if (fNam) m.set('nam', fNam)
                  if (fChuaXem) m.set('chua-xem', '1')
                  if (t > 1) m.set('trang', String(t))
                  return '/tim-kiem?' + m.toString()
                }}
              />
            </>
          )}
        </section>
      )}

      {khong && (
        <Trong
          hinh="tim"
          tieuDe={q ? `Không có phim nào khớp “${q}”` : 'Không tìm thấy phim nào'}
          moTa={
            dangCapNhat
              ? 'Đang cập nhật phim mới từ nguồn vào kho, thử tìm lại sau ít phút.'
              : 'Thử gõ ít chữ hơn, tên tiếng Anh, tên diễn viên — hoặc một câu thoại nhớ được trong phim.'
          }
          nut={[
            { nhan: 'Duyệt theo thể loại', href: '/duyet', chinh: true },
            { nhan: 'Chọn ngẫu nhiên', href: '/ngau-nhien' },
          ]}
        />
      )}

      {phimCuaNguoi.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-white/70">
            {/* Khử trùng tên: một người vừa đóng vừa đạo diễn thì có hai dòng
                trong chỉ mục (loai 'dv' và 'dd'), ghép thẳng sẽ ra
                "Ellen Pompeo, Ellen Pompeo". */}
            <span>Phim có {[...new Set(tenNguoi.map((n) => n.ten))].join(', ') || q} tham gia</span>
            <span className="text-xs font-normal text-white/35">({phimCuaNguoi.length})</span>
          </h2>
          <div className="luoi-phim grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {phimCuaNguoi.map((p) => (
              <TheePhim key={p.slug} phim={p} />
            ))}
          </div>
        </section>
      )}

      {cauThoai.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Câu thoại khớp ({cauThoai.length})</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {cauThoai.map((c, i) => (
              <li key={i}>
                <Link
                  href={`/xem/${c.slug}?tap=tap-${c.soTap}&tu=${Math.max(0, Math.floor(c.giay) - 2)}`}
                  className="flex items-center gap-3 rounded-lg bg-[var(--color-nen-2)] p-2 ring-1 ring-white/5 transition hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-black/40">
                    <Anh src={c.poster} rong={200} anAnToan className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">“{c.chu}”</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {c.ten}
                      {c.nhieuTap > 1 && ` · Tập ${c.soTap}`} · {Math.floor(c.giay / 60)}:{String(Math.floor(c.giay % 60)).padStart(2, '0')}
                    </p>
                  </div>
                  <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 fill-white/50">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tuMay.items.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Trong máy ({tuMay.tongSo})</h2>
          <div className="luoi-phim grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {tuMay.items.map((p) => (
              <TheePhim key={p.slug} phim={p} huyHieu="Trong máy" />
            ))}
          </div>
        </section>
      )}

      {tuNguon.items.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Từ nguồn phim ({tuNguon.tongSo})</h2>
          <div className="luoi-phim grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
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

      {tuKhoDem.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Trong kho đệm ({tuKhoDem.length})</h2>
          <div className="luoi-phim grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {tuKhoDem.map((p) => (
              <TheePhim key={p.slug} phim={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
