import { connection } from 'next/server'
import HeroXoay, { type MucHero } from '@/components/HeroXoay'
import HangPhim from '@/components/HangPhim'
import TheePhim from '@/components/TheePhim'
import { type PhimTom } from '@/lib/vsmov'
import { danhSach as layDanhSach, layChiTiet, duyet } from '@/lib/nguon'
import { layPhimLocalMoi } from '@/lib/thu-vien'
import { danhSachTiepTuc, danhSachXemLai } from '@/lib/theo-doi'
import { gomPhan, tachPhan } from '@/lib/phan-phim'
import { goiY } from '@/lib/goi-y'
import { danhSachTapMoi, kiemTapMoi } from '@/lib/tap-moi'
import { goiYTheoPhimDaXem } from '@/lib/quet-nguoi'
import { phimTheoSlug, veTom } from '@/lib/kho-nguon'
import { ghiLichTap } from '@/lib/lich-tap'
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

/**
 * Lối tắt "xem theo" ngay dưới banner. Người xem Việt hay chọn phim theo NƯỚC
 * trước rồi mới tới thể loại — các trang phim trong nước đều đặt hàng này lên
 * đầu. Thuyết minh / Lồng tiếng là lựa chọn thật của nhà có bố mẹ và trẻ con.
 * Slug lấy từ danh mục thật của nguồn (đã thử từng cái đều ra phim).
 */
const LOI_TAT: { nhan: string; href: string }[] = [
  { nhan: 'Hàn Quốc', href: '/duyet?quoc-gia=han-quoc' },
  { nhan: 'Trung Quốc', href: '/duyet?quoc-gia=trung-quoc' },
  { nhan: 'Âu Mỹ', href: '/duyet?quoc-gia=au-my' },
  { nhan: 'Nhật Bản', href: '/duyet?quoc-gia=nhat-ban' },
  { nhan: 'Thái Lan', href: '/duyet?quoc-gia=thai-lan' },
  { nhan: 'Đài Loan', href: '/duyet?quoc-gia=dai-loan' },
  { nhan: 'Việt Nam', href: '/duyet?quoc-gia=viet-nam' },
]
const LOI_TAT_TIENG: { nhan: string; href: string }[] = [
  { nhan: 'Thuyết minh', href: '/duyet?danh-sach=phim-thuyet-minh' },
  { nhan: 'Lồng tiếng', href: '/duyet?danh-sach=phim-long-tieng' },
  { nhan: 'Hoạt hình', href: '/duyet?danh-sach=hoat-hinh' },
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
  const xemLai = danhSachXemLai(20)

  // Ghi các lần phim bộ lên tập mới để suy lịch ra tập (xem lib/lich-tap.ts).
  // insert-or-ignore theo (phim, tập) nên tải trang liên tục cũng không phình.
  ghiLichTap([...moi.items, ...bo.items])

  // Kiểm tập mới cho phim đang theo dõi — chạy nền, tự giới hạn nhịp nên mở
  // trang liên tục cũng không làm nguồn bị dồn.
  kiemTapMoi()
  const tapMoi = danhSachTapMoi()
  const cacGoiY = await goiY()

  /* "Vì bạn đã xem <phim>" — nêu đích danh bộ phim vừa xem thay vì chỉ nói thể
     loại. Dựng từ chỉ mục diễn viên trong máy, không gọi thêm ra nguồn. */
  const theoPhimDaXem = goiYTheoPhimDaXem(2).map((g) => ({
    ...g,
    items: phimTheoSlug(g.goiY, 14).map(veTom),
  }))

  /**
   * Hâm nóng kho ảnh cho đúng những poster sắp hiện. Bắn rồi quên, không chờ.
   *
   * Ảnh đã đệm về trong 6–20 ms, chưa đệm thì 150 ms đến 1,8 giây — mà trang này
   * có gần 190 poster trong khi chỉ được mở 3 kết nối ra CDN cùng lúc. Hâm trước
   * là cách duy nhất để người xem không phải đợi cái hàng đó.
   *
   * Hâm cả poster dọc lẫn ảnh ngang vì máy chủ không biết máy khách đang ở chế
   * độ PC hay TV — hai chế độ dùng hai loại ảnh khác nhau. Hàng hâm tự bỏ qua
   * ảnh đã có trên đĩa nên lần tải trang thứ hai không sinh việc gì.
   */
  const anhCanHam = [...tiepTuc, ...xemLai, ...local, ...top10, ...moi.items, ...le.items, ...bo.items,
    ...theLoai.flatMap((t) => t.items), ...cacGoiY.flatMap((g) => g.items),
    ...theoPhimDaXem.flatMap((g) => g.items)]
  /**
   * Nạp `lib/anh.ts` bằng import ĐỘNG, và không chạy lúc `next build`.
   *
   * Import tĩnh làm build gãy thật: `next build` dựng sẵn trang này, mà
   * `lib/anh.ts` có `existsSync(tepDem(...))` với đường dẫn ghép động.
   * Turbopack phân tích tĩnh cái đó thành một mẫu khớp 10.360 tệp trong
   * `du-lieu/anh/`, và trang `/` hết 60 giây vẫn chưa dựng xong — hỏng cả ba
   * lần thử, build thoát mã 1. Đưa vào import động là lib/anh.ts không còn nằm
   * trong đồ thị mô-đun của trang.
   *
   * Chặn theo NEXT_PHASE vì hâm ảnh lúc build là vô nghĩa: tiến trình dựng
   * xong là chết, đệm chưa kịp đầy mà lại giữ worker bận.
   */
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    void import('@/lib/anh')
      .then((m) =>
        m.hamNongAnh(
          anhCanHam.flatMap((p) => [p.poster, 'anhNgang' in p ? p.anhNgang : 'anh_ngang' in p ? p.anh_ngang : null]),
          400,
        ),
      )
      .catch(() => {
        // Hâm ảnh là việc phụ — hỏng thì trang vẫn phải hiện bình thường.
      })
  }

  return (
    <div className="pb-10">
      <HeroXoay ds={dsHero} />

      {/* Các hàng đè lên đáy banner một chút, đúng kiểu trang phim */}
      <div className="troi-len relative z-10 mx-auto -mt-8 max-w-[1600px] md:-mt-16">
        {/* Ẩn trên TV: ngăn bên trái đã có đủ Quốc gia, mà trên màn cao 540px
            thêm một hàng ở đây là đẩy hàng phim đầu tiên lọt khỏi màn. */}
        <nav aria-label="Xem theo" className="an-tren-tv an-cuon flex items-center gap-2 overflow-x-auto px-4 pb-2 pt-1">
          {LOI_TAT.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/80 backdrop-blur transition hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              {m.nhan}
            </Link>
          ))}
          <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-white/15" />
          {LOI_TAT_TIENG.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/80 backdrop-blur transition hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              {m.nhan}
            </Link>
          ))}
        </nav>

        {tiepTuc.length > 0 && (
          <HangPhim tieuDe="Tiếp tục xem" xemThem="/bo-suu-tap">
            {tiepTuc.map((x) => {
              const phim: PhimTom = {
                slug: x.slug,
                ten: x.ten || x.slug,
                poster: x.poster || undefined,
                anhNgang: x.anh_ngang || undefined,
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
            {/* pl-14 chừa chỗ cho số thứ hạng nằm bên trái poster. Số 2 chữ rộng
                ~66px ở khung 1440, nên pl-8 (32px) cũ là không đủ — đo được số
                chỉ lòi ra 12px, tức khuất sau poster tới 65–78%. */}
            {top10.map((p, i) => (
              <div key={p.slug} className="w-40 shrink-0 snap-start pl-14 sm:w-44 md:w-48">
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

        {/* Đặt TRƯỚC "Vì bạn hay xem <thể loại>": gọi đích danh bộ phim thì
            thuyết phục hơn hẳn một cái tên thể loại chung chung. */}
        {theoPhimDaXem.map((g) =>
          g.items.length >= 4 ? (
            <HangPhim key={'dx-' + g.slug} tieuDe={`Vì bạn đã xem ${g.ten}`} xemThem={`/phim/${g.slug}`}>
              {g.items.map((p) => (
                <Cuon key={p.slug}>
                  <TheePhim phim={p} tenHienThi={tachPhan(p.ten).goc} />
                </Cuon>
              ))}
            </HangPhim>
          ) : null,
        )}

        {cacGoiY.map((g) => (
          <HangPhim key={g.theLoai} tieuDe={`Vì bạn hay xem ${g.tenTheLoai}`} xemThem={`/duyet?the-loai=${g.theLoai}`}>
            {gomPhan(g.items).map((n) => (
              <Cuon key={n.daiDien.slug}>
                <TheePhim phim={n.daiDien} tenHienThi={n.ten} soPhan={n.soPhan} />
              </Cuon>
            ))}
          </HangPhim>
        ))}

        {/* Xem xong là bản ghi rơi khỏi "Tiếp tục xem", phim biến mất hẳn khỏi
            trang chủ. Hàng này giữ lại lối về. Đặt gần cuối vì nội dung mới vẫn
            phải được ưu tiên hơn phim đã xem rồi.
            Link không kèm `?tap=`: xem lại thì bắt đầu từ tập đầu. Player cũng
            không nhảy tới chỗ cũ — nó bỏ qua tiến độ nằm trong 20 giây cuối. */}
        {xemLai.length > 0 && (
          <HangPhim tieuDe="Xem lại" xemThem="/bo-suu-tap">
            {xemLai.map((x) => (
              <Cuon key={x.khoa}>
                <TheePhim
                  phim={{
                    slug: x.slug,
                    ten: x.ten || x.slug,
                    poster: x.poster || undefined,
                    anhNgang: x.anh_ngang || undefined,
                    nguon: (x.nguon as 'vsmov' | 'local') || 'vsmov',
                  }}
                  href={`/xem/${x.slug}`}
                  huyHieu="Đã xem"
                />
              </Cuon>
            ))}
          </HangPhim>
        )}

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
