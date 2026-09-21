/**
 * Xem nhanh trong hộp thoại.
 *
 * Đây là intercepting route: chỉ chặn khi điều hướng TỪ TRONG app (bấm thẻ phim).
 * Dán thẳng URL hay tải lại trang thì Next bỏ qua khe này và mở trang chi tiết
 * đầy đủ — đúng hành vi mong muốn, không phải hạn chế.
 */
import Link from 'next/link'
import Anh from '@/components/Anh'
import { notFound } from 'next/navigation'
import { layChiTiet } from '@/lib/nguon'
import { layChiTietLocal } from '@/lib/thu-vien'
import { tienDoCuaPhim } from '@/lib/theo-doi'
import { tachPhan } from '@/lib/ten-phan'
import HopThoai from '@/components/HopThoai'

function mmss(giay: number) {
  const p = Math.floor(giay / 60)
  const s = Math.floor(giay % 60)
  return `${p}:${String(s).padStart(2, '0')}`
}

export default async function XemNhanh({ params }: PageProps<'/phim/[slug]'>) {
  const { slug } = await params
  const laLocal = slug.startsWith('local-')
  const ct = laLocal ? layChiTietLocal(slug) : await layChiTiet(slug)
  if (!ct) notFound()

  const { goc: tenChung, phan: soPhan } = tachPhan(ct.ten)
  const mayChu = ct.mayChu[0]
  const nhieuTap = (mayChu?.tap.length ?? 0) > 1

  // Đang xem dở thì nút chính nhảy thẳng vào chỗ đó
  const tienDo = tienDoCuaPhim(slug)
  let tapTiep = mayChu?.tap[0]
  let nhanXem = 'Xem ngay'
  for (const t of mayChu?.tap ?? []) {
    const g = tienDo.get(`${slug}:${t.slug}`)
    if (g && !g.xong && g.vi_tri > 30) {
      tapTiep = t
      nhanXem = nhieuTap ? `Tiếp tục tập ${t.ten}` : `Tiếp tục từ ${mmss(g.vi_tri)}`
      break
    }
  }

  const anh = ct.anhNgang || ct.poster

  return (
    <HopThoai>
      <div className="relative aspect-video w-full bg-black">
        <Anh src={anh} rong={800} uuTien anAnToan khungCho className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="text-2xl font-black leading-tight drop-shadow md:text-3xl">
            {tenChung}
            {soPhan !== null && (
              <span className="ml-2 align-middle text-base font-semibold text-white/50">Phần {soPhan}</span>
            )}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tapTiep && (
              <Link
                href={`/xem/${slug}?tap=${tapTiep.slug}`}
                className="flex items-center gap-2 rounded bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {nhanXem}
              </Link>
            )}
            <Link
              href={`/phim/${slug}`}
              className="rounded bg-white/20 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
            >
              Xem đầy đủ
            </Link>
          </div>
        </div>
      </div>

      <div className="p-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
          {ct.diem && <span className="font-semibold text-emerald-400">{ct.diem} điểm</span>}
          {[ct.nam, ct.thoiLuong, ct.chatLuong, ct.ngonNgu, ct.tapHienTai].filter(Boolean).map((x, i) => (
            <span key={i}>{x}</span>
          ))}
          {laLocal && <span className="rounded bg-[var(--color-nhan)] px-1.5 py-0.5 font-semibold">Trong máy</span>}
        </p>

        {ct.moTa && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/75">{ct.moTa}</p>}

        <dl className="mt-4 grid gap-1.5 text-xs">
          {ct.theLoai.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-white/35">Thể loại</dt>
              <dd className="text-white/65">{ct.theLoai.map((t) => t.ten).join(', ')}</dd>
            </div>
          )}
          {ct.quocGia.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-white/35">Quốc gia</dt>
              <dd className="text-white/65">{ct.quocGia.map((t) => t.ten).join(', ')}</dd>
            </div>
          )}
          {ct.dienVien.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-white/35">Diễn viên</dt>
              <dd className="line-clamp-2 text-white/65">{ct.dienVien.slice(0, 8).join(', ')}</dd>
            </div>
          )}
        </dl>

        {nhieuTap && (
          <p className="mt-4 text-xs text-white/45">
            {mayChu.tap.length} tập ·{' '}
            <Link href={`/phim/${slug}`} className="underline underline-offset-2 hover:text-white">
              xem danh sách tập
            </Link>
          </p>
        )}
      </div>
    </HopThoai>
  )
}
