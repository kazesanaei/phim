/**
 * Adapter nguồn KKPhim (phimapi.com) — nguồn đứng sau motchillm.fm.
 *
 * Cùng họ API với vsmov nhưng KHÁC ở ba chỗ quan trọng (đã đo thật):
 *  1. Trả THẲNG `link_m3u8` — không phải mò qua trang embed như vsmov, và
 *     segment là MPEG-TS sạch (byte đầu 0x47), không bị phủ header PNG.
 *  2. Playlist hai tầng: master -> variant. Proxy phải viết lại cả hai tầng
 *     (may là `/api/tep` viết lại mọi dòng URL nên tầng nào cũng qua được).
 *     Chỉ có MỘT mức chất lượng 1080p, nên vẫn không có gì để chọn.
 *  3. Có thể loại `phim-18` mà vsmov không có — bắt buộc lọc, xem lib/loc-18.ts.
 *
 * Danh mục trần (`/the-loai`, `/quoc-gia`) trả `data` chứ không phải `data.items`.
 */
import type { PhimTom, Trang, ChiTiet, MayChu, MucDanhMuc } from './vsmov'

const GOC = 'https://phimapi.com'
/** CDN ảnh của nguồn này — khác host với API, và phải có dấu / ở cuối. */
const ANH_GOC = 'https://phimimg.com/'
export const TEN_NGUON = 'kkphim'

type Bat = Record<string, unknown>

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

async function goi(duong: string, tim: Record<string, string | number | undefined> = {}, giay = 600): Promise<Bat> {
  const u = new URL(GOC + duong)
  for (const [k, v] of Object.entries(tim)) {
    if (v !== undefined && v !== '' && v !== null) u.searchParams.set(k, String(v))
  }
  const r = await fetch(u, { headers: { accept: 'application/json' }, next: { revalidate: giay } })
  if (!r.ok) throw new Error(`kkphim ${r.status} khi gọi ${duong}`)
  return (await r.json()) as Bat
}

function veTom(x: Bat): PhimTom {
  const tmdb = (x.tmdb || {}) as Bat
  // Poster của KKPhim đôi khi là đường tương đối, phải ghép thêm gốc ảnh.
  //
  // ĐO NGÀY 28/08/2026: `${GOC}/image.php?url=...` mà bản cũ dùng nay trả 404
  // kèm JSON — nguồn đã bỏ endpoint đó. 80/228 ảnh trang chủ chết vì nó. Cũng
  // đúng đường dẫn tương đối ấy ghép vào ANH_GOC thì 12/12 mẫu trả 200.
  // Nếu ngày nào ảnh lại mất hàng loạt, kiểm chỗ này trước.
  const anh = (u: unknown) => {
    if (typeof u !== 'string') return undefined // nguồn có lúc trả object
    const s = u.trim()
    if (!s) return undefined
    return s.startsWith('http') ? s : ANH_GOC + s.replace(/^\/+/, '')
  }
  return {
    slug: String(x.slug || ''),
    ten: String(x.name || x.slug || ''),
    tenGoc: (x.origin_name as string) || undefined,
    nam: (x.year as number) || undefined,
    /**
     * Ở KKPhim gán ĐÚNG theo tên: poster_url là ảnh dọc (800×1200), thumb_url là
     * ảnh ngang (780×440) — đo bằng ffprobe 06/10/2026. vsmov thì ngược lại; xem
     * chú thích cùng chỗ ở lib/vsmov.ts. Hai nguồn trông giống nhau nhưng KHÔNG
     * dùng chung một quy ước, nên đừng "sửa cho thống nhất".
     * Một trường rỗng thì lấy trường kia, đỡ bỏ trắng cả thẻ.
     */
    poster: anh(x.poster_url) ?? anh(x.thumb_url),
    anhNgang: anh(x.thumb_url) ?? anh(x.poster_url),
    nguon: 'vsmov', // dùng chung kiểu; nguồn thật ghi ở `nguonGoc`
    tapHienTai: (x.episode_current as string) || undefined,
    chatLuong: (x.quality as string) || undefined,
    loai: x.type === 'series' || tmdb.type === 'tv' ? 'bo' : 'le',
    diem: tmdb.vote_average && tmdb.vote_average !== '0.0' ? String(tmdb.vote_average) : undefined,
    soPhieu: Number(tmdb.vote_count) || 0,
    capNhat: typeof (x.modified as Bat | undefined)?.time === 'string' ? ((x.modified as Bat).time as string) : undefined,
    trangThai: (x.status as string) || undefined,
  }
}

function veTrang(j: Bat, trang: number): Trang {
  const data = (j.data || {}) as Bat
  const tho = (j.items || data.items || []) as Bat[]
  const pg = (j.pagination || (data.params as Bat)?.pagination || {}) as Bat
  const tongSo = Number(pg.totalItems ?? tho.length)
  const moiTrang = Number(pg.totalItemsPerPage ?? 24) || 24
  return {
    items: tho.map(veTom).filter((p) => p.slug),
    tongSo,
    tongTrang: Number(pg.totalPages ?? Math.max(1, Math.ceil(tongSo / moiTrang))),
    trang: Number(pg.currentPage ?? trang),
  }
}

export async function layDanhSach(slug: string, trang = 1, gioiHan?: number): Promise<Trang> {
  return veTrang(await goi(`/danh-sach/${slug}`, { page: trang, limit: gioiHan }), trang)
}

export async function timKiem(tuKhoa: string, trang = 1, gioiHan?: number): Promise<Trang> {
  if (!tuKhoa.trim()) return { items: [], tongSo: 0, tongTrang: 1, trang: 1 }
  return veTrang(await goi('/v1/api/tim-kiem', { keyword: tuKhoa, page: trang, limit: gioiHan }, 60), trang)
}

export async function theoTheLoai(slug: string, trang = 1, them: Record<string, string | undefined> = {}): Promise<Trang> {
  return veTrang(await goi(`/v1/api/the-loai/${slug}`, { page: trang, ...them }), trang)
}

/** Danh mục trần trả `data` là MẢNG, không bọc trong `items` như vsmov. */
async function danhMuc(duong: string): Promise<MucDanhMuc[]> {
  const j = await goi(duong, {}, 86400)
  const d = j.data
  const tho = (Array.isArray(d) ? d : ((d as Bat)?.items ?? j.items ?? [])) as Bat[]
  return tho.map((x) => ({ ten: String(x.name), slug: String(x.slug) })).filter((x) => x.slug)
}

export async function layDanhMuc(): Promise<{ theLoai: MucDanhMuc[]; quocGia: MucDanhMuc[] }> {
  const [theLoai, quocGia] = await Promise.all([danhMuc('/the-loai'), danhMuc('/quoc-gia')])
  return { theLoai, quocGia }
}

export async function layChiTiet(slug: string): Promise<ChiTiet | null> {
  let j: Bat
  try {
    j = await goi(`/phim/${slug}`, {}, 600)
  } catch {
    return null
  }
  const m = (j.movie || {}) as Bat
  if (!m.slug) return null
  const eps = (j.episodes || []) as Bat[]

  const mayChu: MayChu[] = eps
    .map((s) => ({
      ten: 'KKPhim · ' + String(s.server_name || 'Server').replace(/\s+/g, ' ').trim(),
      tap: ((s.server_data || []) as Bat[])
        // Ưu tiên m3u8; không có thì đành lấy embed
        .map((e) => ({
          ten: String(e.name || ''),
          slug: String(e.slug || ''),
          embed: String(e.link_m3u8 || e.link_embed || ''),
        }))
        .filter((e) => e.embed),
    }))
    .filter((s) => s.tap.length)

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
    mayChu,
  }
}

/** Quét trọn thể loại 18+ để dựng sổ đen. Chỉ chạy một lần, ~4 trang. */
export async function quetSlug18(): Promise<string[]> {
  const ra: string[] = []
  let trang = 1
  let tongTrang = 1
  do {
    const kq = await theoTheLoai('phim-18', trang)
    for (const p of kq.items) ra.push(p.slug)
    tongTrang = kq.tongTrang
    trang++
    await new Promise((r) => setTimeout(r, 150))
  } while (trang <= tongTrang && trang <= 20)
  return ra
}
