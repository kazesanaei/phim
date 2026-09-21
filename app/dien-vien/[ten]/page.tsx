/**
 * Trang một người: toàn bộ phim họ đóng hoặc đạo diễn.
 *
 * Dựng hoàn toàn từ chỉ mục `nguoi_phim` trong máy — không gọi ra nguồn, vì
 * nguồn KHÔNG tra được theo tên người (đã thử, xem lib/quet-nguoi.ts).
 *
 * Tên đi qua URL nên phải so BỎ DẤU: người dùng có thể tới đây từ một tên viết
 * hoa/thường khác, và tên trong kho cũng không nhất quán.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import TheePhim from '@/components/TheePhim'
import { phimTheoSlug, veTom } from '@/lib/kho-nguon'
import { phimTheoNguoi, timTenNguoi } from '@/lib/quet-nguoi'
import { tachPhan } from '@/lib/ten-phan'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/dien-vien/[ten]'>): Promise<Metadata> {
  const { ten } = await params
  return { title: decodeURIComponent(ten) + ' — Kho phim' }
}

export default async function TrangNguoi({ params }: PageProps<'/dien-vien/[ten]'>) {
  const { ten: thoTen } = await params
  const ten = decodeURIComponent(thoTen).trim()
  if (!ten) notFound()

  // Lấy 400 slug rồi dựng thẻ: đủ cho cả những người đóng rất nhiều phim.
  const ds = phimTheoSlug(phimTheoNguoi(ten, 400), 120).map(veTom)
  // Tên chuẩn trong kho (đúng hoa thường, đúng dấu) + biết là diễn viên hay đạo diễn.
  const hoSo = timTenNguoi(ten, 4)
  const chinh = hoSo.find((h) => h.ten.toLowerCase() === ten.toLowerCase()) ?? hoSo[0]
  const vaiTro = [...new Set(hoSo.filter((h) => h.ten === chinh?.ten).map((h) => h.loai))]

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <p className="text-xs uppercase tracking-wide text-white/35">
        {vaiTro.length === 0
          ? 'Người'
          : vaiTro.includes('dv') && vaiTro.includes('dd')
            ? 'Diễn viên · Đạo diễn'
            : vaiTro.includes('dd')
              ? 'Đạo diễn'
              : 'Diễn viên'}
      </p>
      <h1 className="mt-1 text-2xl font-black md:text-3xl">{chinh?.ten ?? ten}</h1>
      <p className="mt-1 text-sm text-white/45">{ds.length} phim trong kho</p>

      {ds.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-white/40">Chưa có phim nào của người này trong kho.</p>
          <p className="mt-2 text-xs text-white/30">
            Chỉ mục diễn viên dựng từ kho đệm. Nếu vừa thêm phim mới, quét lại ở{' '}
            <Link href="/quan-tri" className="underline underline-offset-2 hover:text-white">
              Quản trị → Diễn viên
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="luoi-phim mt-5 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {ds.map((p) => (
            <TheePhim key={p.slug} phim={p} tenHienThi={tachPhan(p.ten).goc} />
          ))}
        </div>
      )}
    </div>
  )
}
