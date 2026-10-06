/**
 * Lớp gọi API vsmov.com + chuẩn hoá dữ liệu.
 *
 * Hai cạm bẫy của nguồn này (đã đo thực tế, đừng "sửa" lại):
 *  1. Hai kiểu envelope: /danh-sach và /tim-kiem trả `items` ở gốc, còn ba
 *     endpoint danh mục trần (/the-loai, /quoc-gia, /nam) trả `data.items`.
 *  2. /danh-sach/* BỎ QUA mọi tham số lọc. Muốn lọc thì phải đi qua
 *     /the-loai/{slug}, /quoc-gia/{slug} hoặc /nam/{year}.
 */

const GOC = 'https://vsmov.com/api'

export type PhimTom = {
  slug: string
  ten: string
  tenGoc?: string
  nam?: number
  poster?: string
  anhNgang?: string
  nguon: 'vsmov' | 'local'
  tapHienTai?: string
  chatLuong?: string
  loai?: 'le' | 'bo'
  diem?: string
  /** Số phiếu TMDB — cần để lọc phim 10 điểm từ vài phiếu ra khỏi bảng xếp hạng. */
  soPhieu?: number
  /** Lúc nguồn cập nhật phim lần cuối (ISO) — dùng để suy lịch ra tập. */
  capNhat?: string
  /** 'ongoing' | 'completed' ... — chỉ có ở chi tiết và một số danh sách. */
  trangThai?: string
}

export type Trang = {
  items: PhimTom[]
  tongSo: number
  tongTrang: number
  trang: number
}

export type Tap = { ten: string; slug: string; embed: string }
export type MayChu = { ten: string; tap: Tap[] }

export type ChiTiet = PhimTom & {
  moTa: string
  thoiLuong?: string
  ngonNgu?: string
  tongTap?: string
  trangThai?: string
  dienVien: string[]
  daoDien: string[]
  theLoai: { ten: string; slug: string }[]
  quocGia: { ten: string; slug: string }[]
  mayChu: MayChu[]
}

export type MucDanhMuc = { ten: string; slug: string }

/** Nội dung phim là HTML của bên thứ ba — luôn lột thẻ, không bao giờ nhúng thô. */
function lotThe(s: unknown): string {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

type Bat = Record<string, unknown>

/**
 * Chỉ nhận chuỗi thật. Nguồn thỉnh thoảng trả OBJECT ở các trường ảnh; kiểu ép
 * `as string` cho nó lọt qua, xuống tới lớp ghi kho thì `String(v)` biến thành
 * chuỗi "[object Object]" và ảnh đó chết vĩnh viễn. Đã có 360 phim dính lỗi này
 * trong kho đệm dựng sẵn — chặn ngay từ đây.
 */
function chuoi(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

async function goi(duong: string, tim: Record<string, string | number | undefined> = {}, giay = 600): Promise<Bat> {
  const u = new URL(GOC + duong)
  for (const [k, v] of Object.entries(tim)) {
    if (v !== undefined && v !== '' && v !== null) u.searchParams.set(k, String(v))
  }
  /**
   * `giay <= 0` = bỏ qua Data Cache của Next.
   *
   * Cần lối này cho vòng quét chỉ mục diễn viên: nó đi qua 18.719 phim, mỗi phim
   * đúng MỘT lần, nên đệm không bao giờ được dùng lại — chỉ tổ ghi ngần ấy tệp
   * JSON vào .next/cache. Đo rồi: KHÔNG nhanh hơn (nút thắt là nguồn), nhưng
   * tránh được đống rác đó. Các trang bình thường vẫn giữ đệm như cũ.
   */
  const r = await fetch(u, {
    headers: { accept: 'application/json' },
    ...(giay > 0 ? { next: { revalidate: giay } } : { cache: 'no-store' as const }),
  })
  if (!r.ok) throw new Error(`vsmov ${r.status} khi gọi ${duong}`)
  return (await r.json()) as Bat
}

function veTom(x: Bat): PhimTom {
  const tmdb = (x.tmdb || {}) as Bat
  return {
    slug: String(x.slug || ''),
    ten: String(x.name || x.slug || ''),
    tenGoc: chuoi(x.origin_name),
    nam: (x.year as number) || undefined,
    /**
     * Ở vsmov, `poster_url` là ảnh NGANG và `thumb_url` là ảnh DỌC — ngược với
     * cái tên. Đo 06/10/2026 bằng ffprobe trên 24 phim ngẫu nhiên: 24/24 như vậy
     * (poster_url 500×282, thumb_url 500×750). Trước đó gán theo tên nên mọi khung
     * ảnh nhận nhầm loại rồi bị cắt giữa: thẻ PC ra một dải hẹp, thẻ TV cụt đầu,
     * trình phát ra ảnh dọc hai bên đen.
     *
     * KKPhim thì NGƯỢC LẠI (poster_url dọc 800×1200, thumb_url ngang 780×440) —
     * đừng "sửa cho thống nhất" lib/nguon-kkphim.ts theo tệp này.
     *
     * Nguồn thỉnh thoảng trả một trường rỗng ({}), nên vẫn lấy chéo cho nhau thay
     * vì bỏ trắng cả thẻ.
     */
    poster: chuoi(x.thumb_url) ?? chuoi(x.poster_url),
    anhNgang: chuoi(x.poster_url) ?? chuoi(x.thumb_url),
    nguon: 'vsmov',
    tapHienTai: chuoi(x.episode_current),
    chatLuong: chuoi(x.quality),
    loai: x.type === 'series' || tmdb.type === 'tv' ? 'bo' : 'le',
    diem: tmdb.vote_average && tmdb.vote_average !== '0.0' ? String(tmdb.vote_average) : undefined,
    soPhieu: Number(tmdb.vote_count) || 0,
    capNhat: chuoi((x.modified as Bat | undefined)?.time),
    trangThai: chuoi(x.status),
  }
}

/** Gộp cả hai kiểu envelope về một dạng. */
function veTrang(j: Bat, trang: number): Trang {
  const data = (j.data || {}) as Bat
  const tho = (j.items || data.items || []) as Bat[]
  const pg = ((j.pagination || (data.params as Bat)?.pagination || {}) as Bat)
  const tongSo = Number(pg.totalItems ?? tho.length)
  const moiTrang = Number(pg.totalItemsPerPage ?? 20) || 20
  return {
    items: tho.map(veTom).filter((p) => p.slug),
    tongSo,
    tongTrang: Number(pg.totalPages ?? Math.max(1, Math.ceil(tongSo / moiTrang))),
    trang: Number(pg.currentPage ?? trang),
  }
}

export const DANH_SACH = [
  { slug: 'phim-moi-cap-nhat', ten: 'Mới cập nhật' },
  { slug: 'phim-le', ten: 'Phim lẻ' },
  { slug: 'phim-bo', ten: 'Phim bộ' },
  { slug: 'subteam', ten: 'Subteam' },
] as const

export async function layDanhSach(slug: string, trang = 1, gioiHan?: number): Promise<Trang> {
  return veTrang(await goi(`/danh-sach/${slug}`, { page: trang, limit: gioiHan }), trang)
}

export async function timKiem(tuKhoa: string, trang = 1, gioiHan?: number): Promise<Trang> {
  if (!tuKhoa.trim()) return { items: [], tongSo: 0, tongTrang: 1, trang: 1 }
  return veTrang(await goi('/tim-kiem', { keyword: tuKhoa, page: trang, limit: gioiHan }, 60), trang)
}

export type ThamSoDuyet = {
  danhSach?: string
  theLoai?: string
  quocGia?: string
  nam?: string
  trang?: number
}

/**
 * Chọn endpoint gốc theo trục lọc chính rồi đẩy phần còn lại vào query.
 * Đây là chỗ xử lý cạm bẫy #2 — đừng gộp về /danh-sach cho gọn.
 */
export async function duyet(t: ThamSoDuyet): Promise<Trang> {
  const trang = t.trang || 1
  if (t.theLoai) {
    return veTrang(await goi(`/the-loai/${t.theLoai}`, { country: t.quocGia, year: t.nam, page: trang }), trang)
  }
  if (t.quocGia) {
    return veTrang(await goi(`/quoc-gia/${t.quocGia}`, { year: t.nam, page: trang }), trang)
  }
  if (t.nam) {
    return veTrang(await goi(`/nam/${t.nam}`, { page: trang }), trang)
  }
  const ds = DANH_SACH.some((d) => d.slug === t.danhSach) ? t.danhSach! : 'phim-moi-cap-nhat'
  return veTrang(await goi(`/danh-sach/${ds}`, { page: trang }), trang)
}

async function danhMuc(duong: string): Promise<MucDanhMuc[]> {
  const j = await goi(duong, {}, 86400)
  const data = (j.data || {}) as Bat
  const tho = (j.items || data.items || []) as Bat[]
  return tho.map((x) => ({ ten: String(x.name), slug: String(x.slug) })).filter((x) => x.slug)
}

export async function layDanhMuc(): Promise<{ theLoai: MucDanhMuc[]; quocGia: MucDanhMuc[]; nam: MucDanhMuc[] }> {
  const [theLoai, quocGia, nam] = await Promise.all([
    danhMuc('/the-loai'),
    danhMuc('/quoc-gia'),
    danhMuc('/nam'),
  ])
  return { theLoai, quocGia, nam }
}

/**
 * `dungDem = false` cho vòng quét hàng loạt — xem chú thích trong `goi()`.
 */
export async function layChiTiet(slug: string, dungDem = true): Promise<ChiTiet | null> {
  let j: Bat
  try {
    j = await goi(`/phim/${slug}`, {}, dungDem ? 600 : 0)
  } catch {
    return null
  }
  const m = (j.movie || {}) as Bat
  if (!m.slug) return null
  const eps = (j.episodes || []) as Bat[]
  return {
    ...veTom(m),
    moTa: lotThe(m.content),
    thoiLuong: (m.time as string) || undefined,
    ngonNgu: (m.lang as string) || undefined,
    tongTap: (m.episode_total as string) || undefined,
    trangThai: (m.status as string) || undefined,
    dienVien: ((m.actor || []) as string[]).filter(Boolean),
    daoDien: ((m.director || []) as string[]).filter(Boolean),
    theLoai: ((m.category || []) as Bat[]).map((c) => ({ ten: String(c.name), slug: String(c.slug) })),
    quocGia: ((m.country || []) as Bat[]).map((c) => ({ ten: String(c.name), slug: String(c.slug) })),
    mayChu: eps
      .map((s) => ({
        // tên server trong dữ liệu có kèm xuống dòng và khoảng trắng thừa
        ten: String(s.server_name || 'Server').replace(/\s+/g, ' ').trim(),
        tap: ((s.server_data || []) as Bat[])
          .map((e) => ({ ten: String(e.name || ''), slug: String(e.slug || ''), embed: String(e.link_embed || '') }))
          .filter((e) => e.embed),
      }))
      .filter((s) => s.tap.length),
  }
}
