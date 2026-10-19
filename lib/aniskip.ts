/**
 * Mốc opening / ending tự động cho ANIME, lấy từ AniSkip — phần gọi mạng và lưu
 * đệm. Phần thuần (khớp tên, đọc dữ liệu) ở lib/aniskip-khop.ts.
 *
 *   tên gốc phim ──Jikan──▶ mã MyAnimeList ──AniSkip──▶ mốc op/ed của tập
 *
 * Lưu đệm cả hai bước trong SQLite: Jikan giới hạn khoảng 3 yêu cầu/giây, và mốc
 * của một tập gần như không đổi. Không tìm thấy cũng lưu (để khỏi hỏi lại liên
 * tục), nhưng hết hạn sớm hơn — cộng đồng có thể gửi mốc sau.
 *
 * Mọi lệnh gọi đều có hạn chờ: nguồn ngoài treo thì trình phát vẫn chạy, chỉ là
 * không có nút tự động.
 */
import { db } from './db'
import { chonMal, docAniSkip, type MocAniSkip } from './aniskip-khop'

const JIKAN = 'https://api.jikan.moe/v4'
const ANISKIP = 'https://api.aniskip.com/v2'
const HAN_CHO_MS = 6000

/** Mã MAL: tìm được thì giữ 30 ngày, không chắc thì 3 ngày mới dò lại. */
const NGAY_GIU_MAL = 30
const NGAY_DO_LAI_MAL = 3
/** Mốc của tập: có thì giữ 7 ngày, chưa có thì 1 ngày hỏi lại. */
const NGAY_GIU_MOC = 7
const NGAY_HOI_LAI_MOC = 1

async function goiJson(url: string): Promise<unknown> {
  const r = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(HAN_CHO_MS),
    cache: 'no-store',
  })
  // AniSkip trả 404 khi tập chưa có mốc — đó là "không có", không phải lỗi
  if (r.status === 404) return { found: false, results: [] }
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/** Mã MAL của một phim, hoặc null. `undefined` từ bảng = chưa dò lần nào. */
export async function layMalId(
  slug: string,
  phim: { tenGoc?: string; ten?: string; nam?: number; laBo?: boolean },
): Promise<number | null> {
  const h = db
    .prepare(
      `select mal_id, kiem_luc > datetime('now', case when mal_id is null then ? else ? end) as con_han
         from anime_mal where slug = ?`,
    )
    .get(`-${NGAY_DO_LAI_MAL} days`, `-${NGAY_GIU_MAL} days`, slug) as { mal_id: number | null; con_han: number } | undefined
  if (h?.con_han) return h.mal_id

  const q = (phim.tenGoc || phim.ten || '').trim()
  if (!q) return null
  let id: number | null = null
  try {
    const j = (await goiJson(`${JIKAN}/anime?q=${encodeURIComponent(q.slice(0, 100))}&limit=15`)) as { data?: unknown }
    id = chonMal(j?.data, phim)
  } catch {
    // Jikan lỗi / quá giới hạn: lần sau thử lại, KHÔNG ghi null kẻo khoá 3 ngày oan
    return h?.mal_id ?? null
  }
  db.prepare(
    `insert into anime_mal (slug, mal_id, kiem_luc) values (?, ?, datetime('now'))
     on conflict(slug) do update set mal_id = excluded.mal_id, kiem_luc = excluded.kiem_luc`,
  ).run(slug, id)
  return id
}

/** Mốc op/ed của một tập. */
export async function layMocTap(malId: number, tap: number): Promise<MocAniSkip> {
  const khoa = `${malId}:${tap}`
  const h = db
    .prepare(
      `select du_lieu, kiem_luc > datetime('now', case when du_lieu = '{"op":null,"ed":null}' then ? else ? end) as con_han
         from aniskip_dem where khoa = ?`,
    )
    .get(`-${NGAY_HOI_LAI_MOC} days`, `-${NGAY_GIU_MOC} days`, khoa) as { du_lieu: string; con_han: number } | undefined
  if (h?.con_han) {
    try {
      return JSON.parse(h.du_lieu) as MocAniSkip
    } catch {
      // hỏng thì lấy lại bên dưới
    }
  }

  let moc: MocAniSkip
  try {
    moc = docAniSkip(
      await goiJson(
        `${ANISKIP}/skip-times/${malId}/${tap}?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&episodeLength=0`,
      ),
    )
  } catch {
    return { op: null, ed: null }
  }
  db.prepare(
    `insert into aniskip_dem (khoa, du_lieu, kiem_luc) values (?, ?, datetime('now'))
     on conflict(khoa) do update set du_lieu = excluded.du_lieu, kiem_luc = excluded.kiem_luc`,
  ).run(khoa, JSON.stringify(moc))
  return moc
}
