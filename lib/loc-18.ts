/**
 * Chặn / gắn mác nội dung 18+.
 *
 * HAI MỨC (từ 18/10/2026):
 *  - 'chan'     — phim TOÀN BỘ thiên về tình dục: ẩn khỏi mọi nơi, trang chi
 *                 tiết trả 404.
 *  - 'canh-bao' — phim đàng hoàng có yếu tố người lớn (cảnh nóng, kinh dị, tài
 *                 liệu về ngành phim người lớn): vẫn hiện, gắn mác 18+ và hỏi
 *                 lại trước khi xem.
 *
 * Mức của một phim lấy theo thứ tự:
 *  1. Chủ máy đặt TAY trong Quản trị (cột muc_tay) — luôn thắng.
 *  2. Mức tự động đã ghi trong bảng chan_18 (cột muc_tu_dong) — từ sổ đen theo
 *     thể loại 18+ của nguồn, hoặc lưới tên đã từng bắt.
 *  3. Lưới tên (lib/ten-18.ts) — cho phim chưa từng gặp.
 *
 * Vì sao vẫn cần sổ đen theo slug: endpoint danh sách KHÔNG trả thể loại (cạm
 * bẫy đã biết của họ API này), nên không lọc theo thể loại lúc duyệt được. Và
 * vsmov CÓ phim 18+ không gắn nhãn nào — README đo được lưới tên bắt 0/15.
 *
 * Vì sao sổ đen không còn chặn mù: thể loại `phim-18` của KKPhim lẫn cả phim
 * đàng hoàng (Kiều, Sa Mạc Namibia, Tra Tấn...). phanLoaiSoDen() xem các thể
 * loại còn lại của từng phim để quyết định chặn hay chỉ gắn mác.
 */
import { db } from './db'
import { xetTen18, mucTheoTheLoai, type Muc18 } from './ten-18'

export type { Muc18 } from './ten-18'
/** Giá trị lưu trong bảng: thêm 'cho-phep' = đã xét, không phải 18+. */
export type MucLuu = Muc18 | 'cho-phep'

const MUC_HOP_LE = new Set<MucLuu>(['chan', 'canh-bao', 'cho-phep'])

type Phim = { slug: string; ten: string; tenGoc?: string }

/** Thể loại bị coi là người lớn, dùng khi có dữ liệu thể loại. */
export const THE_LOAI_CAM = new Set(['phim-18', 'phim-18-', '18', 'adult', 'erotic'])

/**
 * KHÔNG cache sổ đen trong bộ nhớ.
 *
 * Bản đầu tôi cache vào một Set module-scope, và nó hỏng thật: Set được nạp
 * (rỗng) TRƯỚC khi quét sổ đen, rồi không bao giờ nạp lại — trang chi tiết của
 * phim bị chặn vẫn mở được. Bảng chỉ vài trăm dòng, đọc lại mỗi lần là chuyện
 * micro-giây. Đúng đắn quan trọng hơn một tối ưu vặt.
 */
function napBang(): Map<string, MucLuu> {
  try {
    const h = db.prepare('select slug, coalesce(muc_tay, muc_tu_dong) as muc from chan_18').all() as {
      slug: string
      muc: MucLuu
    }[]
    return new Map(h.map((x) => [x.slug, x.muc]))
  } catch {
    return new Map()
  }
}

function mucVoiBang(bang: Map<string, MucLuu>, p: Phim): Muc18 | null {
  const luu = bang.get(p.slug)
  if (luu) return luu === 'cho-phep' ? null : luu
  return xetTen18(p.ten, p.tenGoc)?.muc ?? null
}

/** Mức 18+ của một phim: 'chan', 'canh-bao' hoặc null (phim thường). */
export function mucDo18(p: Phim): Muc18 | null {
  try {
    const r = db
      .prepare('select coalesce(muc_tay, muc_tu_dong) as muc from chan_18 where slug = ?')
      .get(p.slug) as { muc: MucLuu } | undefined
    if (r) return r.muc === 'cho-phep' ? null : r.muc
  } catch {
    // bảng chưa có thì xét theo tên
  }
  return xetTen18(p.ten, p.tenGoc)?.muc ?? null
}

/**
 * Cho thẻ phim dựng từ dữ liệu TRONG MÁY (tiếp tục xem, yêu thích, lịch sử...):
 * mấy chỗ đó không đi qua locSach() nên tự hỏi mác ở đây. Trả `undefined` thay
 * cho `false` để không thêm trường thừa vào props.
 */
export function coMac18(slug: string, ten: string): true | undefined {
  return mucDo18({ slug, ten }) === 'canh-bao' || undefined
}

/** Phim có bị CHẶN HẲN không. Phim chỉ gắn mác thì không. */
export function bacBo(p: Phim): boolean {
  return mucDo18(p) === 'chan'
}

/** Lọc một danh sách: bỏ phim bị chặn, gắn `la18` cho phim chỉ gắn mác. */
export function locSach<T extends Phim>(ds: T[]): (T & { la18?: boolean })[] {
  const bang = napBang()
  const ra: (T & { la18?: boolean })[] = []
  for (const p of ds) {
    const muc = mucVoiBang(bang, p)
    if (muc === 'chan') continue
    ra.push(muc === 'canh-bao' ? { ...p, la18: true } : p)
  }
  return ra
}

export function xoaBoNhoDem() {
  // Giữ lại cho tương thích; giờ không còn bộ nhớ đệm nào để xoá.
}

/**
 * Ghi lại phim lưới tên vừa bắt, để nó hiện trong danh sách ở Quản trị và chủ
 * máy bỏ chặn được nếu bắt nhầm. `insert or ignore`: dòng đã có (nhất là dòng
 * đặt tay) thì không đụng tới.
 */
export function ghiNhanTheoTen(p: Phim): void {
  const k = xetTen18(p.ten, p.tenGoc)
  if (!k) return
  try {
    db.prepare(
      `insert or ignore into chan_18 (slug, ly_do, ten, ten_goc, muc_tu_dong, cap_nhat)
       values (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(p.slug, k.lyDo, p.ten, p.tenGoc ?? null, k.muc)
  } catch {
    // ghi nhận chỉ để xem lại — lỗi thì thôi, không được làm gãy việc đang làm
  }
}

/**
 * Thêm phim từ thể loại 18+ của nguồn vào sổ đen.
 * Chưa có thể loại (chưa phân loại) thì mặc định CHẶN như trước — an toàn hơn.
 */
export function themVaoSoDen(ds: (string | { slug: string; ten?: string; tenGoc?: string })[]) {
  const cau = db.prepare(
    `insert into chan_18 (slug, ly_do, ten, ten_goc, muc_tu_dong, cap_nhat)
     values (?, 'Thể loại 18+ của nguồn', ?, ?, 'chan', datetime('now'))
     on conflict(slug) do update set
       ten = coalesce(excluded.ten, ten), ten_goc = coalesce(excluded.ten_goc, ten_goc)`,
  )
  for (const x of ds) {
    const p = typeof x === 'string' ? { slug: x } : x
    if (p.slug) cau.run(p.slug, ('ten' in p && p.ten) || null, ('tenGoc' in p && p.tenGoc) || null)
  }
}

/**
 * Phân loại một phim trong sổ đen theo các thể loại còn lại của nó (lấy từ
 * trang chi tiết). Chỉ đổi mức TỰ ĐỘNG; mức đặt tay giữ nguyên.
 */
export function phanLoaiSoDen(slug: string, theLoai: { ten: string; slug: string }[]): Muc18 {
  const k = mucTheoTheLoai(theLoai.map((t) => t.slug))
  db.prepare(
    `update chan_18 set muc_tu_dong = ?, ly_do = ?, the_loai = ?, cap_nhat = datetime('now') where slug = ?`,
  ).run(k.muc, k.lyDo, theLoai.map((t) => t.ten).join(', '), slug)
  return k.muc
}

export function demSoDen(): number {
  try {
    return (
      db.prepare("select count(*) as n from chan_18 where coalesce(muc_tay, muc_tu_dong) = 'chan'").get() as {
        n: number
      }
    ).n
  } catch {
    return 0
  }
}

export type Dong18 = {
  slug: string
  ten: string | null
  ten_goc: string | null
  ly_do: string | null
  the_loai: string | null
  muc_tu_dong: MucLuu
  muc_tay: MucLuu | null
  muc: MucLuu
  tao_luc: string
}

/** Toàn bộ danh sách cho Quản trị, phim bị chặn trước. */
export function danhSach18(): Dong18[] {
  try {
    return db
      .prepare(
        `select slug, ten, ten_goc, ly_do, the_loai, muc_tu_dong, muc_tay,
                coalesce(muc_tay, muc_tu_dong) as muc, tao_luc
           from chan_18
          order by case coalesce(muc_tay, muc_tu_dong) when 'chan' then 0 when 'canh-bao' then 1 else 2 end,
                   coalesce(ten, slug) collate nocase`,
      )
      .all() as Dong18[]
  } catch {
    return []
  }
}

/**
 * Chủ máy đặt mức bằng tay. `null` = trả về mức tự động.
 * Phim chưa có trong bảng (thêm tay theo slug) thì tạo dòng mới.
 */
export function datMuc18(slug: string, muc: MucLuu | null, thongTin: { ten?: string; tenGoc?: string } = {}) {
  if (muc !== null && !MUC_HOP_LE.has(muc)) throw new Error('Mức không hợp lệ')
  db.prepare(
    `insert into chan_18 (slug, ly_do, ten, ten_goc, muc_tu_dong, muc_tay, cap_nhat)
     values (?, 'Đặt tay', ?, ?, 'cho-phep', ?, datetime('now'))
     on conflict(slug) do update set muc_tay = excluded.muc_tay,
       ten = coalesce(ten, excluded.ten), ten_goc = coalesce(ten_goc, excluded.ten_goc),
       cap_nhat = datetime('now')`,
  ).run(slug, thongTin.ten ?? null, thongTin.tenGoc ?? null, muc)
}

/**
 * Dọn kho đệm theo lưới tên hiện tại.
 *
 * VÌ SAO CẦN CHẠY LẠI ĐƯỢC: kho 18.719 phim được ghi bằng lưới lọc CŨ. Mỗi lần
 * đổi lưới phải xét lại kho một lượt — phim mới bị chặn thì rút khỏi kho, phim
 * chỉ gắn mác thì để lại (nó vẫn được xem, chỉ có mác).
 *
 * Dòng do lưới tên ghi trước đây cũng được xét lại: lưới nới ra thì phim từng
 * bị chặn oan được thả về mức đúng (không xoá dòng, để vẫn tra lại được).
 *
 * Trả về số phim vừa rút khỏi kho.
 */
export function donKho18(): number {
  const rows = db.prepare('select slug, ten, ten_goc from kho_phim').all() as {
    slug: string
    ten: string
    ten_goc: string | null
  }[]

  const xetLai = db
    .prepare(`select slug, ten, ten_goc from chan_18 where ly_do like 'Tên%' or ly_do = 'ten'`)
    .all() as { slug: string; ten: string | null; ten_goc: string | null }[]
  const capNhatDong = db.prepare(`update chan_18 set muc_tu_dong = ?, ly_do = ?, cap_nhat = datetime('now') where slug = ?`)
  const ghi = db.prepare(
    `insert or ignore into chan_18 (slug, ly_do, ten, ten_goc, muc_tu_dong, cap_nhat)
     values (?, ?, ?, ?, ?, datetime('now'))`,
  )
  const xoaKho = db.prepare('delete from kho_phim where slug = ?')
  const xoaTl = db.prepare('delete from kho_the_loai where slug_phim = ?')

  let rut = 0
  db.exec('begin')
  try {
    for (const r of xetLai) {
      // Dòng cũ chưa lưu tên thì không xét lại được, giữ nguyên
      if (!r.ten) continue
      const k = xetTen18(r.ten, r.ten_goc ?? undefined)
      capNhatDong.run(k?.muc ?? 'cho-phep', k?.lyDo ?? 'Tên không còn dấu hiệu 18+', r.slug)
    }
    const bang = napBang()
    for (const r of rows) {
      const k = xetTen18(r.ten, r.ten_goc ?? undefined)
      if (k) ghi.run(r.slug, k.lyDo, r.ten, r.ten_goc, k.muc)
      // Theo mức HIỆU LỰC: đặt tay "cho phép" / "gắn mác" thì không rút dù tên dính lưới
      if (mucVoiBang(bang, { slug: r.slug, ten: r.ten, tenGoc: r.ten_goc ?? undefined }) === 'chan') {
        xoaKho.run(r.slug)
        xoaTl.run(r.slug)
        rut++
      }
    }
    db.exec('commit')
  } catch (e) {
    db.exec('rollback')
    throw e
  }
  return rut
}
