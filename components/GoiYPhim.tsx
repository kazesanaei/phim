/**
 * Hai dải gợi ý ở cuối trang chi tiết: cùng thể loại và cùng diễn viên.
 *
 * VÌ SAO CẦN: xem xong một phim mà không có đường đi tiếp thì phải quay ra tìm
 * lại từ đầu — trang phim nào cũng có phần này, đây là thứ giữ người ở lại.
 *
 * Toàn bộ dựng từ kho trong máy, KHÔNG gọi mạng thêm lần nào: thể loại lấy ở
 * `kho_the_loai`, diễn viên ở chỉ mục `nguoi_phim` (108.908 tên đã quét). Nhờ
 * vậy phần này không làm trang chậm đi và vẫn chạy khi nguồn chết.
 *
 * Là server component: truy vấn SQLite chạy thẳng lúc dựng trang.
 */
import HangPhim from '@/components/HangPhim'
import TheePhim from '@/components/TheePhim'
import { phimCungTheLoai, phimTheoSlug, veTom } from '@/lib/kho-nguon'
import { phimCungNguoi } from '@/lib/quet-nguoi'
import { tachPhan } from '@/lib/ten-phan'

function Dai({ tieuDe, ds }: { tieuDe: string; ds: ReturnType<typeof veTom>[] }) {
  if (!ds.length) return null
  return (
    <HangPhim tieuDe={tieuDe}>
      {ds.map((p) => (
        <div key={p.slug} className="w-32 shrink-0 snap-start sm:w-36 md:w-40">
          <TheePhim phim={p} tenHienThi={tachPhan(p.ten).goc} />
        </div>
      ))}
    </HangPhim>
  )
}

export default function GoiYPhim({ slug }: { slug: string }) {
  const cungTheLoai = phimCungTheLoai(slug, 14).map(veTom)

  // Chỉ mục người trả về slug; phần dữ liệu dựng thẻ lấy tiếp từ kho.
  const cungNguoi = phimCungNguoi(slug, 14)
  const dsNguoi = phimTheoSlug(
    cungNguoi.map((x) => x.slug),
    14,
  ).map(veTom)

  // Tên người trùng nhiều nhất — dùng làm nhãn cho dải, cụ thể hơn "Phim liên quan".
  const tenChung = cungNguoi[0]?.chung?.[0]

  if (!cungTheLoai.length && !dsNguoi.length) return null

  return (
    <section className="mt-8">
      <Dai tieuDe={tenChung ? `Cùng ${tenChung} và ê-kíp` : 'Cùng diễn viên'} ds={dsNguoi} />
      <Dai tieuDe="Cùng thể loại" ds={cungTheLoai} />
    </section>
  )
}
