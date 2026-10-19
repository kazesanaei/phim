/**
 * Phần THUẦN của tích hợp AniSkip: chọn đúng anime trên MyAnimeList từ kết quả
 * tìm kiếm của Jikan, và đọc mốc opening / ending AniSkip trả về. Không phụ thuộc
 * gì để bộ kiểm nạp thẳng được (bẫy #12 trong README). Phần gọi mạng + lưu đệm ở
 * lib/aniskip.ts.
 *
 * AniSkip (api.aniskip.com) là cơ sở dữ liệu cộng đồng: người xem gửi mốc opening
 * (op) và ending (ed) cho từng tập anime, khoá theo mã MyAnimeList (MAL). Các web
 * anime dựng nút "Bỏ qua intro / outro" từ đây. Hết ending mà tập còn chạy tiếp
 * thì phần còn lại chính là cảnh sau credit.
 *
 * NGUYÊN TẮC: khớp nhầm anime còn tệ hơn không có nút — tua sai chỗ giữa tập. Nên
 * chỉ nhận khi tên khớp CHẮC (trùng hẳn sau khi chuẩn hoá), mơ hồ thì bỏ.
 */

export type DoanMoc = { tu: number; den: number }
export type MocAniSkip = { op: DoanMoc | null; ed: DoanMoc | null }

/** Chuẩn hoá tên để so: chữ thường, bỏ dấu, bỏ ký tự không phải chữ/số. */
export function chuanTen(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

type Bat = Record<string, unknown>

/** Mọi tên của một mục Jikan: tên chính, tiếng Anh, tiếng Nhật, tên khác. */
function cacTen(a: Bat): string[] {
  const ra: string[] = []
  for (const k of ['title', 'title_english', 'title_japanese']) if (typeof a[k] === 'string') ra.push(a[k] as string)
  if (Array.isArray(a.title_synonyms)) ra.push(...a.title_synonyms.filter((x): x is string => typeof x === 'string'))
  if (Array.isArray(a.titles)) {
    for (const t of a.titles as Bat[]) if (t && typeof t.title === 'string') ra.push(t.title)
  }
  return ra
}

function namCua(a: Bat): number | null {
  if (typeof a.year === 'number') return a.year
  const tu = ((a.aired as Bat | undefined)?.prop as Bat | undefined)?.from as Bat | undefined
  return typeof tu?.year === 'number' ? tu.year : null
}

/**
 * Chọn mã MAL từ kết quả `GET /v4/anime?q=…` của Jikan (mảng `data`).
 *
 * Chỉ xét mục có một tên TRÙNG HẲN tên gốc hoặc tên Việt sau khi chuẩn hoá. Nhiều
 * mục cùng trùng (bản TV và bản movie cùng tên, bản làm lại) thì dùng năm và kiểu
 * (TV cho phim bộ, Movie cho phim lẻ) để tách; vẫn hoà thì bỏ, không đoán.
 */
export function chonMal(data: unknown, phim: { tenGoc?: string; ten?: string; nam?: number; laBo?: boolean }): number | null {
  if (!Array.isArray(data)) return null
  const can = [phim.tenGoc, phim.ten].filter((x): x is string => !!x).map(chuanTen).filter((x) => x.length >= 2)
  if (!can.length) return null

  const ung = (data as Bat[])
    .filter((a) => a && typeof a.mal_id === 'number')
    .filter((a) => cacTen(a).some((t) => can.includes(chuanTen(t))))
    .map((a) => {
      let diem = 0
      const nam = namCua(a)
      if (phim.nam && nam) diem += nam === phim.nam ? 2 : Math.abs(nam - phim.nam) <= 1 ? 1 : -2
      const kieu = String(a.type || '').toLowerCase()
      if (phim.laBo !== undefined) diem += (phim.laBo ? kieu === 'tv' || kieu === 'ona' : kieu === 'movie') ? 1 : 0
      return { id: a.mal_id as number, diem }
    })
    .sort((x, y) => y.diem - x.diem)

  if (!ung.length) return null
  if (ung.length > 1 && ung[0].diem === ung[1].diem && ung[0].id !== ung[1].id) return null
  return ung[0].id
}

/**
 * Đọc mốc từ `GET /v2/skip-times/{malId}/{tập}` của AniSkip. Đọc PHÒNG THỦ: nhận
 * cả kiểu v2 (`interval.startTime`, `skipType`) lẫn v1 (`interval.start_time`,
 * `skip_type`); gặp gì lạ thì bỏ qua mục đó chứ không ném lỗi.
 * `mixed-op` / `mixed-ed` (opening/ending lồng cảnh phim) coi như op / ed.
 */
export function docAniSkip(json: unknown): MocAniSkip {
  const ra: MocAniSkip = { op: null, ed: null }
  const j = json as Bat | null
  if (!j || j.found === false || !Array.isArray(j.results)) return ra
  for (const r of j.results as Bat[]) {
    const kieu = String(r?.skipType ?? r?.skip_type ?? '')
    const iv = (r?.interval ?? {}) as Bat
    const tu = Number(iv.startTime ?? iv.start_time)
    const den = Number(iv.endTime ?? iv.end_time)
    if (!Number.isFinite(tu) || !Number.isFinite(den) || tu < 0 || den - tu < 5) continue
    const muc = { tu: Math.round(tu * 10) / 10, den: Math.round(den * 10) / 10 }
    if ((kieu === 'op' || kieu === 'mixed-op') && !ra.op) ra.op = muc
    if ((kieu === 'ed' || kieu === 'mixed-ed') && !ra.ed) ra.ed = muc
  }
  return ra
}

/** Số tập từ mã tập chung ("1", "01", "tap-12"); phim lẻ / "full" là tập 1. */
export function soTapAniSkip(maTap: string): number {
  const m = (maTap || '').match(/\d+/)
  const so = m ? Number(m[0]) : 1
  return so >= 1 && so <= 5000 ? so : 1
}

/** Anime = hoạt hình Nhật. Phim hoạt hình Mỹ, Trung... không có trên AniSkip. */
export function laAnime(theLoai: { slug: string }[], quocGia: { slug: string }[]): boolean {
  return theLoai.some((t) => t.slug === 'hoat-hinh') && quocGia.some((q) => q.slug === 'nhat-ban')
}
