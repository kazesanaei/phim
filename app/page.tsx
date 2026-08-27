import { connection } from 'next/server'
import HeroXoay, { type MucHero } from '@/components/HeroXoay'
import HangPhim from '@/components/HangPhim'
import TheePhim from '@/components/TheePhim'
import { type PhimTom } from '@/lib/vsmov'
import { danhSach as layDanhSach, layChiTiet, duyet } from '@/lib/nguon'
import { layPhimLocalMoi } from '@/lib/thu-vien'
import { danhSachTiepTuc } from '@/lib/theo-doi'
import { gomPhan, tachPhan } from '@/lib/phan-phim'
import { goiY } from '@/lib/goi-y'
import { danhSachTapMoi, kiemTapMoi } from '@/lib/tap-moi'
import Link from 'next/link'

// Trang này trộn dữ liệu API (cache 600s ở lớp fetch) với hàng "Tiếp tục xem"
// đọc thẳng SQLite. KHÔNG dùng force-dynamic — nó ép cache: 'no-store' lên MỌI
// fetch nên 8 lệnh gọi vsmov phải đi mạng lại mỗi lần tải trang. Thay vào đó
// gọi connection() ngay trước phần đọc SQLite: fetch phía trên vẫn cache, chỉ
// khúc dưới chạy tại request-time nên tiến độ xem luôn tươi.

const THE_LOAI_NOI_BAT = [
  { slug: 'hanh-dong', ten: 'Hành động' },
  { slug: 'hoat-hinh', ten: 'Hoạt hình' },
  { slug: 'kinh-di', ten: 'Kinh dị' },
  { slug: 'co-trang', ten: 'Cổ trang' },
]

const SO_HERO = 5
/** Ngưỡng phiếu TMDB để vào bảng xếp hạng — chặn phim 10 điểm từ vài phiếu. */
const PHIEU_TOI_THIEU = 300

function Cuon({ children }: { children: React.ReactNode }) {
  return <div className="w-32 shrink-0 snap-start sm:w-36 md:w-40">{children}</div>
}

/** Top 10 dựng từ chính dữ liệu đã tải cho các hàng — không thêm request nào. */
function topMuoi(kho: PhimTom[]): PhimTom[] {
  const thay = new Map<string, PhimTom>()
  for (const p of kho) {
    if (!p.diem || (p.soPhieu ?? 0) < PHIEU_TOI_THIEU) continue
    // Gộp các phần: chỉ giữ phần điểm cao nhất của mỗi phim
    const khoa = tachPhan(p.ten).goc.toLowerCase()
    const cu = thay.get(khoa)
    if (!cu || Number(p.diem) > Number(cu.diem)) thay.set(khoa, p)
  }
  return [...thay.values()].sort((a, b) => Number(b.diem) - Number(a.diem)).slice(0, 10)
}

export default async function TrangChu() {
  const [moi, le, bo, ...theLoai] = await Promise.all([
    layDanhSach('phim-moi-cap-nhat', 1),
    layDanhSach('phim-le', 1),
    layDanhSach('phim-bo', 1),
    ...THE_LOAI_NOI_BAT.map((t) => duyet({ theLoai: t.slug, trang: 1 })),
  ])

  // Banner: vài phim mới nhất có ảnh ngang, kèm mô tả. Các lệnh gọi chi tiết
  // chạy song song và đều nằm trong cache 600s nên không cộng dồn độ trễ.
  const ungVienHero = moi.items.filter((p) => p.anhNgang).slice(0, SO_HERO)
  const chiTietHero = await Promise.all(ungVienHero.map((p) => layChiTiet(p.slug)))
  const dsHero: MucHero[] = ungVienHero.map((phim, i) => ({ phim, moTa: chiTietHero[i]?.moTa }))

  const top10 = topMuoi([...moi.items, ...le.items, ...bo.items, ...theLoai.flatMap((t) => t.items)])

  // Ranh giới prerender: mọi fetch vsmov phía trên được cache; SQLite phía dưới
  // đọc tại request-time nên "Tiếp tục xem" phản ánh ngay lần xem gần nhất.
  await connection()
  const tiepTuc = danhSachTiepTuc(20)
  const local = layPhimLocalMoi(20)

  // Kiểm tập mới cho phim đang theo dõi — chạy nền, tự giới hạn nhịp nên mở
  // trang liên tục cũng không làm nguồn bị dồn.
  kiemTapMoi()
  const tapMoi = danhSachTapMoi()
  const cacGoiY = await goiY()

  return (
    <div className="pb-10">
      <HeroXoay ds={dsHero} />

      {/* Các hàng đè lên đáy banner một chút, đúng kiểu trang phim */}
      <div className="relative z-10 mx-auto -mt-8 max-w-[1600px] md:-mt-16">
        {tiepTuc.length > 0 && (
          <HangPhim tieuDe="Tiếp tục xem" xemThem="/bo-suu-tap">
            {tiepTuc.map((x) => {
              const phim: PhimTom = {
                slug: x.slug,
                ten: x.ten || x.slug,
                poster: x.poster || undefined,
                nguon: (x.nguon as 'vsmov' | 'local') || 'vsmov',
              }
              const pt = x.thoi_luong ? (x.vi_tri / x.thoi_luong) * 100 : 0
              const conLai = Math.max(0, Math.round((x.thoi_luong - x.vi_tri) / 60))
              return (
                <Cuon key={x.khoa}>
                  <TheePhim
                    phim={phim}
                    href={`/xem/${x.slug}${x.tap ? '?tap=' + x.tap : ''}`}
                    khoaXoa={x.khoa}
                    tienDo={{ phanTram: pt, nhan: conLai > 0 ? `Còn ${conLai} phút` : 'Sắp xong' }}
                  />
                </Cuon>
              )
            })}
          </HangPhim>
        )}

        {tapMoi.length > 0 && (
          <HangPhim tieuDe="Tập mới cho bạn" xemThem="/bo-suu-tap">
            {tapMoi.map((t) => (
              <Cuon key={t.slug}>
                <TheePhim
                  phim={{
                    slug: t.slug,
                    ten: t.ten || t.slug,
                    poster: t.poster || undefined,
                    nguon: 'vsmov',
                    tapHienTai: t.tap_da_biet || undefined,
                  }}
                  huyHieu="Tập mới"
                />
              </Cuon>
            ))}
          </HangPhim>
        )}

        {/* Nhãn nói đúng số thật: ngưỡng phiếu lọc chặt nên không phải lúc nào
            cũng đủ 10 — thà ít mà thật còn hơn độn phim vài phiếu vào cho tròn số */}
        {top10.length >= 5 && (
          <HangPhim tieuDe={`Top ${top10.length} điểm cao`} xemThem="/duyet">
            {top10.map((p, i) => (
              <div key={p.slug} className="w-40 shrink-0 snap-start pl-8 sm:w-44 md:w-48">
                <TheePhim phim={p} thuHang={i + 1} tenHienThi={tachPhan(p.ten).goc} />
              </div>
            ))}
          </HangPhim>
        )}

        <HangPhim tieuDe="Mới cập nhật" xemThem="/duyet?danh-sach=phim-moi-cap-nhat">
          {gomPhan(moi.items).map((n) => (
            <Cuon key={n.daiDien.slug}>
              <TheePhim phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
            </Cuon>
          ))}
        </HangPhim>

        {local.length > 0 && (
          <HangPhim tieuDe="Kho phim của tôi" xemThem="/duyet?nguon=local">
            {local.map((p) => (
              <Cuon key={p.slug}>
                <TheePhim phim={p} huyHieu="Trong máy" />
              </Cuon>
            ))}
          </HangPhim>
        )}

        <HangPhim tieuDe="Phim lẻ" xemThem="/duyet?danh-sach=phim-le">
          {gomPhan(le.items).map((n) => (
            <Cuon key={n.daiDien.slug}>
              <TheePhim phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
            </Cuon>
          ))}
        </HangPhim>

        <HangPhim tieuDe="Phim bộ" xemThem="/duyet?danh-sach=phim-bo">
          {gomPhan(bo.items).map((n) => (
            <Cuon key={n.daiDien.slug}>
              <TheePhim phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
            </Cuon>
          ))}
        </HangPhim>

        {THE_LOAI_NOI_BAT.map((t, i) => (
          <HangPhim key={t.slug} tieuDe={t.ten} xemThem={`/duyet?the-loai=${t.slug}`}>
            {gomPhan(theLoai[i].items).map((n) => (
              <Cuon key={n.daiDien.slug}>
                <TheePhim phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
              </Cuon>
            ))}
          </HangPhim>
        ))}

        {cacGoiY.map((g) => (
          <HangPhim key={g.theLoai} tieuDe={`Vì bạn hay xem ${g.tenTheLoai}`} xemThem={`/duyet?the-loai=${g.theLoai}`}>
            {gomPhan(g.items).map((n) => (
              <Cuon key={n.daiDien.slug}>
                <TheePhim phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
              </Cuon>
            ))}
          </HangPhim>
        ))}

        {local.length === 0 && (
          <p className="px-4 pt-6 text-sm text-white/40">
            Chưa có phim nào trong máy.{' '}
            <Link href="/quan-tri" className="underline underline-offset-2 hover:text-white">
              Thêm thư mục phim
            </Link>{' '}
            để gộp kho trên ổ cứng vào đây.
          </p>
        )}
      </div>
    </div>
  )
}
