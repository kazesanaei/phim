import Link from 'next/link'
import Anh from '@/components/Anh'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { layChiTiet } from '@/lib/nguon'
import { layChiTietLocal } from '@/lib/thu-vien'
import { daDanhDau, layTienDo, tienDoCuaPhim, dangTheoDoi } from '@/lib/theo-doi'
import { danhDauDaXem } from '@/lib/tap-moi'
import DanhSachTap from '@/components/DanhSachTap'
import NutDanhDau from '@/components/NutDanhDau'
import NutTaiVe from '@/components/NutTaiVe'
import ChonPhan from '@/components/ChonPhan'
import NutTheoDoi from '@/components/NutTheoDoi'
import { tachPhan } from '@/lib/ten-phan'
import GoiYPhim from '@/components/GoiYPhim'

export const revalidate = 300

function mmss(giay: number) {
  const p = Math.floor(giay / 60)
  const s = Math.floor(giay % 60)
  return `${p}:${String(s).padStart(2, '0')}`
}

export default async function TrangPhim({ params }: PageProps<'/phim/[slug]'>) {
  const { slug } = await params
  const laLocal = slug.startsWith('local-')
  const ct = laLocal ? layChiTietLocal(slug) : await layChiTiet(slug)
  if (!ct) notFound()

  // Mở trang này rồi thì thôi báo tập mới nữa
  if (!laLocal) danhDauDaXem(slug)

  const { goc: tenChung, phan: soPhanHienTai } = tachPhan(ct.ten)
  const mayChu = ct.mayChu[0]
  const nhieuTap = (mayChu?.tap.length ?? 0) > 1

  // Đang xem dở tập nào thì nút chính trỏ thẳng vào đó.
  const tienDo = tienDoCuaPhim(slug)
  let tapTiep = mayChu?.tap[0]
  let nhanXem = 'Xem ngay'
  let dangDo: { tap: string; viTri: number } | null = null
  for (const t of mayChu?.tap ?? []) {
    const g = tienDo.get(`${slug}:${t.slug}`)
    if (g && !g.xong && g.vi_tri > 30) {
      tapTiep = t
      dangDo = { tap: t.slug, viTri: g.vi_tri }
      nhanXem = nhieuTap ? `Tiếp tục tập ${t.ten}` : `Tiếp tục từ ${mmss(g.vi_tri)}`
      break
    }
  }
  if (!dangDo && nhieuTap) {
    const chuaXem = mayChu.tap.find((t) => !tienDo.get(`${slug}:${t.slug}`)?.xong)
    if (chuaXem && tienDo.size > 0) {
      tapTiep = chuaXem
      nhanXem = `Xem tập ${chuaXem.ten}`
    }
  }

  const anh = ct.anhNgang || ct.poster
  const duongXem = tapTiep ? `/xem/${slug}?tap=${tapTiep.slug}` : `/xem/${slug}`

  return (
    <div>
      <div className="relative">
        <Anh src={anh} rong={1280} uuTien anAnToan className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[var(--color-nen)]/80 backdrop-blur-sm" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--color-nen)] to-transparent" />

        <div className="relative mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 md:flex-row md:py-10">
          <div className="w-40 shrink-0 self-center md:w-56 md:self-start">
            {/* aspect-[2/3] giữ khung trước khi ảnh tải xong, không thì poster
                nhảy chiều cao và đẩy nội dung dưới (CLS), rõ nhất trên mobile. */}
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
              <Anh
                src={ct.poster}
                alt={ct.ten}
                rong={400}
                uuTien
                khungCho
                duPhong={ct.ten}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {/* Tên chính là tên chung; số phần tách ra thành nhãn riêng cho gọn */}
            <h1 className="text-2xl font-black leading-tight md:text-4xl">
              {tenChung}
              {soPhanHienTai !== null && (
                <span className="ml-2 align-middle text-base font-semibold text-white/45 md:text-xl">
                  Phần {soPhanHienTai}
                </span>
              )}
            </h1>
            {ct.tenGoc && <p className="mt-1 text-white/50">{ct.tenGoc}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {laLocal && (
                <span className="rounded bg-[var(--color-nhan)] px-2 py-1 font-semibold">Trong máy</span>
              )}
              {[ct.nam, ct.thoiLuong, ct.chatLuong, ct.ngonNgu, ct.tapHienTai].filter(Boolean).map((x, i) => (
                <span key={i} className="rounded bg-white/10 px-2 py-1 text-white/70">
                  {x}
                </span>
              ))}
              {ct.diem && (
                <span className="rounded bg-amber-500/20 px-2 py-1 font-semibold text-amber-300">TMDB {ct.diem}</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {tapTiep && (
                <Link
                  href={duongXem}
                  className="flex items-center gap-2 rounded bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {nhanXem}
                </Link>
              )}
              <NutDanhDau
                khoa={slug}
                loai="thich"
                banDau={daDanhDau(slug, 'thich')}
                ten={ct.ten}
                poster={ct.poster}
                nam={ct.nam}
                nguon={laLocal ? 'local' : 'vsmov'}
              />
              <NutDanhDau
                khoa={slug}
                loai="xem_sau"
                banDau={daDanhDau(slug, 'xem_sau')}
                ten={ct.ten}
                poster={ct.poster}
                nam={ct.nam}
                nguon={laLocal ? 'local' : 'vsmov'}
              />
              {!laLocal && nhieuTap && (
                <NutTheoDoi
                  slug={slug}
                  ten={ct.ten}
                  poster={ct.poster}
                  tapHienTai={ct.tapHienTai}
                  banDau={dangTheoDoi(slug)}
                />
              )}
              {!laLocal && ct.mayChu.length > 0 && (
                <NutTaiVe
                  slug={slug}
                  ten={ct.ten}
                  poster={ct.poster}
                  tap={ct.mayChu[0].tap.map((t) => ({ ten: t.ten, slug: t.slug, embed: t.embed }))}
                />
              )}
            </div>

            {ct.moTa && <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/75">{ct.moTa}</p>}

            <dl className="mt-5 grid gap-2 text-sm">
              {ct.theLoai.length > 0 && (
                <Dong nhan="Thể loại">
                  {ct.theLoai.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/duyet?the-loai=${t.slug}${laLocal ? '&nguon=local' : ''}`}
                      className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/75 hover:bg-white/20 hover:text-white"
                    >
                      {t.ten}
                    </Link>
                  ))}
                </Dong>
              )}
              {ct.quocGia.length > 0 && (
                <Dong nhan="Quốc gia">
                  {ct.quocGia.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/duyet?quoc-gia=${t.slug}${laLocal ? '&nguon=local' : ''}`}
                      className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/75 hover:bg-white/20 hover:text-white"
                    >
                      {t.ten}
                    </Link>
                  ))}
                </Dong>
              )}
              {ct.daoDien.length > 0 && (
                <Dong nhan="Đạo diễn">
                  {ct.daoDien.map((ten) => (
                    <Link
                      key={ten}
                      href={`/dien-vien/${encodeURIComponent(ten)}`}
                      className="rounded bg-white/5 px-2 py-0.5 text-white/70 transition hover:bg-white/15 hover:text-white"
                    >
                      {ten}
                    </Link>
                  ))}
                </Dong>
              )}
              {ct.dienVien.length > 0 && (
                <Dong nhan="Diễn viên">
                  {/* Bấm được: 108.908 tên đã có trong chỉ mục nên mỗi tên đều
                      mở ra được danh sách phim của người đó. Để chữ chết thì
                      công quét đó chỉ phục vụ mỗi ô tìm kiếm. */}
                  {ct.dienVien.slice(0, 12).map((ten) => (
                    <Link
                      key={ten}
                      href={`/dien-vien/${encodeURIComponent(ten)}`}
                      className="rounded bg-white/5 px-2 py-0.5 text-white/70 transition hover:bg-white/15 hover:text-white"
                    >
                      {ten}
                    </Link>
                  ))}
                </Dong>
              )}
            </dl>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-12">
        {/* Bọc Suspense: dải chọn phần phải tra thêm một lượt tìm kiếm ở nguồn,
            đừng để nó chặn phần còn lại của trang. Phim local không có phần. */}
        {!laLocal && (
          <Suspense fallback={null}>
            <ChonPhan ten={ct.ten} slugHienTai={slug} />
          </Suspense>
        )}

        <div className="mt-6" />

        {ct.mayChu.map((m, i) => (
          <div key={i} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-white/70">
              {m.ten} · {m.tap.length} tập
            </h2>
            <DanhSachTap slug={slug} tap={m.tap} server={i} />
          </div>
        ))}
        {ct.mayChu.length === 0 && (
          <p className="py-10 text-center text-sm text-white/40">Phim này chưa có nguồn phát.</p>
        )}

        {/* Gợi ý dựng từ kho trong máy, không gọi mạng — xem GoiYPhim.tsx */}
        {!laLocal && <GoiYPhim slug={slug} />}
      </div>
    </div>
  )
}

function Dong({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <dt className="w-20 shrink-0 text-white/40">{nhan}</dt>
      <dd className="flex flex-wrap items-center gap-1.5">{children}</dd>
    </div>
  )
}
