/**
 * Dữ liệu cho thanh đầu trang: phim đang xem dở + danh mục để đổ vào menu Duyệt.
 *
 * VÌ SAO LÀ API CHỨ KHÔNG NẰM TRONG layout.tsx:
 * layout dùng chung cho mọi trang. Đọc SQLite ở đó là ép TẤT CẢ các trang sang
 * dựng lúc chạy, mất luôn phần tĩnh của /dang-nhap, /quan-tri, /tai-ve. Để đây
 * thì header nạp khi người dùng mở menu lần đầu, các trang giữ nguyên như cũ.
 */
import { chanCheoTrang, traLoiLoi } from '@/lib/an-toan'
import { danhSachTiepTuc } from '@/lib/theo-doi'
import { layDanhMuc } from '@/lib/nguon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Nguồn trả 187 quốc gia theo bảng chữ cái, đổ hết ra menu thì cột dài quá màn
 * hình và thứ người ta thật sự tìm lại nằm tít dưới. Đẩy các nước hay xem lên
 * đầu, phần còn lại vẫn vào được qua trang Duyệt.
 */
const QUOC_GIA_HAY_XEM = [
  'viet-nam', 'han-quoc', 'trung-quoc', 'nhat-ban', 'thai-lan', 'au-my',
  'hoa-ky', 'anh', 'phap', 'an-do', 'hong-kong', 'dai-loan',
  'duc', 'canada', 'uc', 'nga', 'tay-ban-nha', 'philippines',
]
const SO_QUOC_GIA = 24
const SO_NAM = 18

function xepQuocGia(ds: { ten: string; slug: string }[]) {
  const thu = (s: string) => {
    const i = QUOC_GIA_HAY_XEM.indexOf(s)
    return i < 0 ? QUOC_GIA_HAY_XEM.length : i
  }
  return [...ds].sort((a, b) => thu(a.slug) - thu(b.slug)).slice(0, SO_QUOC_GIA)
}

/** Danh mục năm của nguồn có cả 2050, 2031... Bỏ năm không có thật rồi xếp mới trước. */
function xepNam(ds: { ten: string; slug: string }[]) {
  const nay = new Date().getFullYear()
  return ds
    .filter((x) => {
      const n = Number(x.slug)
      return Number.isFinite(n) && n >= 1960 && n <= nay + 1
    })
    .sort((a, b) => Number(b.slug) - Number(a.slug))
    .slice(0, SO_NAM)
}

export async function GET(req: Request) {
  try {
    chanCheoTrang(req)

    const tiepTuc = danhSachTiepTuc(12).map((x) => {
      const phanTram = x.thoi_luong ? Math.min(100, Math.max(2, (x.vi_tri / x.thoi_luong) * 100)) : 0
      const conLai = Math.max(0, Math.round((x.thoi_luong - x.vi_tri) / 60))
      return {
        khoa: x.khoa,
        slug: x.slug,
        tap: x.tap,
        ten: x.ten || x.slug,
        poster: x.poster,
        phanTram,
        nhan: conLai > 0 ? `Còn ${conLai} phút` : 'Sắp xong',
      }
    })

    // Mất mạng thì menu Duyệt trống, nhưng header vẫn phải chạy — đừng để
    // một lệnh gọi nguồn hỏng làm chết cả thanh điều hướng.
    let dm: Awaited<ReturnType<typeof layDanhMuc>> = { theLoai: [], quocGia: [], nam: [] }
    try {
      dm = await layDanhMuc()
    } catch (e) {
      console.warn('[phim] không lấy được danh mục cho đầu trang:', e instanceof Error ? e.message : e)
    }

    return Response.json({
      tiepTuc,
      theLoai: dm.theLoai,
      quocGia: xepQuocGia(dm.quocGia),
      nam: xepNam(dm.nam),
    })
  } catch (e) {
    return traLoiLoi(e)
  }
}
