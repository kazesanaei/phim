import { Suspense } from 'react'
import ThanhLoc from '@/components/ThanhLoc'
import TheePhim from '@/components/TheePhim'
import PhanTrang from '@/components/PhanTrang'
import { type MucDanhMuc, type PhimTom } from '@/lib/vsmov'
import { duyet, layDanhMuc } from '@/lib/nguon'
import { phimLocal, danhMucLocal } from '@/lib/thu-vien'
import { gomPhan } from '@/lib/phan-phim'
import { demKho, locKho, veTom } from '@/lib/kho-nguon'

export const revalidate = 300

function motChuoi(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

type KetQua = { items: PhimTom[]; tongSo: number; tongTrang: number; trang: number }
/** Thẻ kèm số phần khi lấy từ kho đệm (kho đếm được trên toàn danh mục). */
type The = { phim: PhimTom; ten: string; soPhan: number }

export default async function TrangDuyet({ searchParams }: PageProps<'/duyet'>) {
  const sp = await searchParams
  const laLocal = motChuoi(sp.nguon) === 'local'
  const trang = Math.max(1, Number(motChuoi(sp.trang)) || 1)
  const dsTheLoai = motChuoi(sp['the-loai']).split(',').filter(Boolean)
  const quocGia = motChuoi(sp['quoc-gia'])
  const nam = motChuoi(sp.nam)
  const danhSach = motChuoi(sp['danh-sach'])
  const sapXep = motChuoi(sp['sap-xep'])

  const soKho = demKho()
  // Dùng kho đệm khi cần thứ nguồn KHÔNG làm được: sắp xếp, hoặc nhiều thể loại.
  // Còn lại vẫn hỏi thẳng nguồn cho dữ liệu tươi nhất.
  const dungKho = !laLocal && soKho > 0 && (!!sapXep || dsTheLoai.length > 1)

  let kq: KetQua
  let the: The[]
  let dm: { theLoai: MucDanhMuc[]; quocGia: MucDanhMuc[]; nam: MucDanhMuc[] }

  if (laLocal) {
    kq = phimLocal({ theLoai: dsTheLoai[0], quocGia, nam, trang, tim: motChuoi(sp.q) })
    the = gomPhan(kq.items).map((n) => ({ phim: n.daiDien, ten: n.ten, soPhan: n.soPhan }))
    const l = danhMucLocal()
    dm = {
      theLoai: l.theLoai,
      quocGia: l.quocGia,
      nam: l.nam.map((n) => ({ ten: String(n.nam), slug: String(n.nam) })),
    }
  } else if (dungKho) {
    const r = locKho({
      theLoai: dsTheLoai,
      nam,
      loai: danhSach === 'phim-bo' ? 'bo' : danhSach === 'phim-le' ? 'le' : undefined,
      sapXep: (sapXep || 'moi') as 'diem' | 'nam' | 'ten' | 'moi',
      trang,
      gomPhan: true,
    })
    kq = { items: r.items.map(veTom), tongSo: r.tongSo, tongTrang: r.tongTrang, trang: r.trang }
    // Kho đếm được TỔNG số phần trên toàn danh mục, không chỉ trong trang này.
    the = r.items.map((h, i) => ({
      phim: kq.items[i],
      ten: h.goc_ten || h.ten,
      soPhan: h.tong_phan ?? 1,
    }))
    dm = await layDanhMuc()
  } else {
    const [r, d] = await Promise.all([
      duyet({ danhSach, theLoai: dsTheLoai[0], quocGia, nam, trang }),
      layDanhMuc(),
    ])
    kq = r
    dm = d
    the = gomPhan(r.items).map((n) => ({ phim: n.daiDien, ten: n.ten, soPhan: n.soPhan }))
  }

  const duong = (t: number) => {
    const m = new URLSearchParams()
    if (laLocal) m.set('nguon', 'local')
    if (danhSach) m.set('danh-sach', danhSach)
    if (dsTheLoai.length) m.set('the-loai', dsTheLoai.join(','))
    if (quocGia) m.set('quoc-gia', quocGia)
    if (nam) m.set('nam', nam)
    if (sapXep) m.set('sap-xep', sapXep)
    if (t > 1) m.set('trang', String(t))
    return '/duyet' + (m.toString() ? '?' + m.toString() : '')
  }

  const tenLoc = [
    ...dsTheLoai.map((s) => dm.theLoai.find((x) => x.slug === s)?.ten).filter(Boolean),
    dm.quocGia.find((x) => x.slug === quocGia)?.ten,
    nam,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {laLocal ? 'Kho phim của tôi' : tenLoc.length ? tenLoc.join(' · ') : 'Duyệt phim'}
          </h1>
          <p className="mt-0.5 text-sm text-white/45">
            {kq.tongSo.toLocaleString('vi-VN')} phim
            {kq.tongTrang > 1 && ` · trang ${kq.trang}/${kq.tongTrang}`}
            {dungKho && ' · lọc từ kho đệm trong máy'}
          </p>
        </div>
        <Suspense fallback={null}>
          <ThanhLoc theLoai={dm.theLoai} quocGia={dm.quocGia} nam={dm.nam} coKho={soKho > 0} />
        </Suspense>
      </div>

      {!laLocal && soKho === 0 && (
        <p className="mb-4 rounded border border-[var(--color-vien)] bg-[var(--color-nen-2)] px-4 py-2.5 text-xs text-white/50">
          Muốn <strong className="text-white/75">sắp xếp theo điểm/năm</strong> hoặc{' '}
          <strong className="text-white/75">lọc nhiều thể loại cùng lúc</strong>? Nguồn không hỗ trợ hai việc này — vào{' '}
          <a href="/quan-tri" className="underline underline-offset-2 hover:text-white">
            Quản trị → Kho đệm
          </a>{' '}
          quét một lần là dùng được.
        </p>
      )}

      {the.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/40">
          {laLocal
            ? 'Kho trong máy chưa có phim nào khớp. Vào Quản trị để thêm thư mục và quét.'
            : 'Không tìm thấy phim nào khớp bộ lọc này.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {the.map((t) => (
            <TheePhim
              key={t.phim.slug}
              phim={t.phim}
              tenHienThi={t.ten}
              soPhan={t.soPhan}
              huyHieu={laLocal ? 'Trong máy' : undefined}
            />
          ))}
        </div>
      )}

      <PhanTrang trang={kq.trang} tongTrang={kq.tongTrang} duong={duong} />
    </div>
  )
}
