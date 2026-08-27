/**
 * Quét thư mục nguồn, dựng kho phim local trong SQLite.
 *
 * Ba việc nặng: tách tên/năm từ tên file, gom nhiều file cùng thư mục thành
 * phim bộ, và làm giàu metadata bằng chính API vsmov (khỏi cần TMDB key).
 * ffprobe cho biết codec để quyết định phát thẳng hay phải chuyển mã.
 */
import { readdir, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { db, thuMucNguon } from './db'
import { khongDau } from './khong-dau'
import { docThongTin, canChuyenMa, trichKhungHinh, coFfmpeg } from './ffmpeg'
import { timKiem, layChiTiet } from './vsmov'

const DUOI_VIDEO = new Set(['.mp4', '.mkv', '.webm', '.m4v', '.avi', '.mov', '.ts'])
const DUOI_PHU_DE = new Set(['.srt', '.vtt'])

const TOKEN_KY_THUAT =
  /\b(19\d{2}|20\d{2}|2160p|1080p|720p|480p|4k|uhd|bluray|blu-ray|bdrip|web-?dl|webrip|hdrip|brrip|dvdrip|remux|x264|x265|h264|h265|hevc|avc|aac|ac3|dts|ddp?5|truehd|10bit|hdr|proper|repack|extended|vietsub|thuyet-?minh|long-?tieng)\b/i

export type KetQuaQuet = {
  themPhim: number
  themTap: number
  boQua: number
  thuMuc: number
  loi: string[]
}

function slugHoa(s: string): string {
  return (
    khongDau(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'phim'
  )
}

/** Tách tên phim và năm từ tên file kiểu `Ten.Phim.2019.1080p.BluRay.x264.mkv`. */
export function tachTen(tenFile: string): { ten: string; nam?: number } {
  let s = tenFile.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ')
  const mNam = s.match(/\b(19\d{2}|20\d{2})\b/)
  const nam = mNam ? Number(mNam[1]) : undefined
  const cat = s.search(TOKEN_KY_THUAT)
  if (cat > 0) s = s.slice(0, cat)
  s = s
    .replace(/[([{].*$/, '')
    .replace(/[\s\-–—_]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { ten: s || tenFile, nam }
}

/** Số tập suy từ tên file: S01E02, Tap 3, Ep.04, hoặc con số cuối cùng. */
export function soTapTu(tenFile: string, duPhong: number): number {
  const s = tenFile.replace(/\.[^.]+$/, '')
  const m1 = s.match(/s\d{1,2}[\s._-]*e(\d{1,3})/i)
  if (m1) return Number(m1[1])
  const m2 = s.match(/(?:tap|tập|ep|episode|phan)[\s._-]*(\d{1,3})/i)
  if (m2) return Number(m2[1])
  const soCuoi = s.match(/(\d{1,3})(?!.*\d)/)
  if (soCuoi) return Number(soCuoi[1])
  return duPhong
}

type TepVideo = { duongDan: string; ten: string; thuMuc: string }

async function duyetThuMuc(goc: string, ra: TepVideo[], sau = 0) {
  if (sau > 6) return
  let muc
  try {
    muc = await readdir(goc, { withFileTypes: true })
  } catch {
    return
  }
  for (const m of muc) {
    const d = path.join(goc, m.name)
    if (m.isDirectory()) {
      if (/^(subs?|phu-?de|sample|extras?|featurettes)$/i.test(m.name)) continue
      await duyetThuMuc(d, ra, sau + 1)
    } else if (DUOI_VIDEO.has(path.extname(m.name).toLowerCase())) {
      // Bỏ file sample vài chục MB nằm cạnh phim thật
      if (/\bsample\b/i.test(m.name)) continue
      ra.push({ duongDan: d, ten: m.name, thuMuc: goc })
    }
  }
}

/** Tìm phụ đề rời: cùng tên khác đuôi, hoặc trong thư mục con Subs/. */
async function timPhuDe(tepVideo: string): Promise<{ duongDan: string; ngonNgu: string; nhan: string }[]> {
  const thuMuc = path.dirname(tepVideo)
  const goc = path.basename(tepVideo, path.extname(tepVideo))
  const gocThuong = goc.toLowerCase()
  const ra: { duongDan: string; ngonNgu: string; nhan: string }[] = []

  const noiTim = [thuMuc, path.join(thuMuc, 'Subs'), path.join(thuMuc, 'subs'), path.join(thuMuc, 'Sub')]
  for (const noi of noiTim) {
    let muc
    try {
      muc = await readdir(noi, { withFileTypes: true })
    } catch {
      continue
    }
    for (const m of muc) {
      if (!m.isFile()) continue
      const duoi = path.extname(m.name).toLowerCase()
      if (!DUOI_PHU_DE.has(duoi)) continue
      const ten = path.basename(m.name, duoi)
      const tenThuong = ten.toLowerCase()
      // trong thư mục Subs riêng thì nhận hết, cạnh video thì phải trùng tên gốc
      const khop = noi === thuMuc ? tenThuong.startsWith(gocThuong) : true
      if (!khop) continue
      const hau = tenThuong.slice(gocThuong.length).replace(/^[._-]+/, '')
      const ngonNgu = /vie|vi\b|viet/.test(hau || tenThuong) ? 'vie' : /eng|en\b/.test(hau || tenThuong) ? 'eng' : 'und'
      ra.push({
        duongDan: path.join(noi, m.name),
        ngonNgu,
        nhan: hau || (ngonNgu === 'vie' ? 'Tiếng Việt' : ngonNgu === 'eng' ? 'English' : ten),
      })
    }
  }
  return ra
}

type MetaNguon = {
  ten?: string
  tenGoc?: string
  nam?: number
  poster?: string
  backdrop?: string
  moTa?: string
  theLoai?: { ten: string; slug: string }[]
  quocGia?: { ten: string; slug: string }[]
}

/** Tra lại chính API vsmov để lấy poster + thể loại + quốc gia. Chỉ nhận khi khớp đủ chắc. */
async function traMetadata(ten: string, nam?: number): Promise<MetaNguon | null> {
  try {
    const kq = await timKiem(ten, 1, 10)
    if (!kq.items.length) return null
    const canhTen = khongDau(ten)
    const ungVien = kq.items.filter((p) => {
      const a = khongDau(p.ten)
      const b = khongDau(p.tenGoc || '')
      const khop =
        a === canhTen ||
        b === canhTen ||
        (a.includes(canhTen) && canhTen.length / a.length > 0.7) ||
        (canhTen.includes(a) && a.length / canhTen.length > 0.7) ||
        (!!b && (b.includes(canhTen) || canhTen.includes(b)) && Math.min(b.length, canhTen.length) > 4)
      return khop
    })
    if (!ungVien.length) return null
    // Cùng năm thì ưu tiên, không thì lấy ứng viên đầu.
    const chon = (nam && ungVien.find((p) => p.nam === nam)) || ungVien[0]
    const ct = await layChiTiet(chon.slug)
    return {
      ten: chon.ten,
      tenGoc: chon.tenGoc,
      nam: chon.nam,
      poster: chon.poster,
      backdrop: chon.anhNgang,
      moTa: ct?.moTa,
      theLoai: ct?.theLoai,
      quocGia: ct?.quocGia,
    }
  } catch {
    return null
  }
}

function slugDuyNhat(goc: string, boQua?: number): string {
  let s = 'local-' + goc
  let i = 2
  for (;;) {
    const co = db.prepare('select id from phim where slug = ?').get(s) as { id: number } | undefined
    if (!co || co.id === boQua) return s
    s = 'local-' + goc + '-' + i++
  }
}

async function luuPhim(o: {
  ten: string
  nam?: number
  loai: 'le' | 'bo'
  thuMuc: string
  tep: TepVideo[]
}): Promise<'them' | 'capnhat'> {
  const daCo = db.prepare('select * from phim where thu_muc = ?').get(o.thuMuc) as
    | { id: number; sua_tay: number; slug: string; poster: string | null }
    | undefined

  const meta = daCo?.sua_tay ? null : await traMetadata(o.ten, o.nam)
  const ten = meta?.ten || o.ten
  const nam = meta?.nam ?? o.nam ?? null

  let phimId: number
  if (daCo) {
    phimId = daCo.id
    if (!daCo.sua_tay) {
      db.prepare(
        `update phim set ten = ?, ten_goc = ?, nam = ?, loai = ?, poster = coalesce(?, poster),
          backdrop = coalesce(?, backdrop), mo_ta = coalesce(?, mo_ta), ten_khong_dau = ? where id = ?`,
      ).run(ten, meta?.tenGoc || null, nam, o.loai, meta?.poster || null, meta?.backdrop || null, meta?.moTa || null, khongDau(ten), phimId)
    }
  } else {
    const slug = slugDuyNhat(slugHoa(ten + (nam ? '-' + nam : '')))
    const kq = db
      .prepare(
        `insert into phim (nguon, slug, ten, ten_goc, nam, loai, poster, backdrop, mo_ta, thu_muc, ten_khong_dau)
         values ('local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slug, ten, meta?.tenGoc || null, nam, o.loai, meta?.poster || null, meta?.backdrop || null, meta?.moTa || null, o.thuMuc, khongDau(ten))
    phimId = Number(kq.lastInsertRowid)
  }

  if (meta && !daCo?.sua_tay) {
    db.prepare('delete from the_loai where phim_id = ?').run(phimId)
    db.prepare('delete from quoc_gia where phim_id = ?').run(phimId)
    for (const t of meta.theLoai || []) {
      db.prepare('insert or ignore into the_loai (phim_id, ten, slug) values (?, ?, ?)').run(phimId, t.ten, t.slug)
    }
    for (const q of meta.quocGia || []) {
      db.prepare('insert or ignore into quoc_gia (phim_id, ten, slug) values (?, ?, ?)').run(phimId, q.ten, q.slug)
    }
  }

  // Tập: đối chiếu theo đường dẫn file để không nhân bản khi quét lại.
  for (const [i, t] of o.tep.entries()) {
    const coTap = db.prepare('select id from tap where duong_dan_file = ?').get(t.duongDan) as
      | { id: number }
      | undefined
    const tt = await docThongTin(t.duongDan)
    const canMa = canChuyenMa(t.duongDan, tt) ? 1 : 0
    const soTap = o.loai === 'bo' ? soTapTu(t.ten, i + 1) : 1
    const tenTap = o.loai === 'bo' ? String(soTap) : ten

    let tapId: number
    if (coTap) {
      db.prepare(
        'update tap set phim_id = ?, so_tap = ?, ten = ?, thoi_luong = ?, codec_v = ?, codec_a = ?, can_chuyen_ma = ?, luong = ? where id = ?',
      ).run(phimId, soTap, tenTap, tt?.thoiLuong || null, tt?.codecV || null, tt?.codecA || null, canMa, JSON.stringify(tt?.luong ?? []), coTap.id)
      tapId = coTap.id
    } else {
      const kq = db
        .prepare(
          `insert into tap (phim_id, so_tap, ten, duong_dan_file, thoi_luong, codec_v, codec_a, can_chuyen_ma, luong)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(phimId, soTap, tenTap, t.duongDan, tt?.thoiLuong || null, tt?.codecV || null, tt?.codecA || null, canMa, JSON.stringify(tt?.luong ?? []))
      tapId = Number(kq.lastInsertRowid)
    }

    db.prepare('delete from phu_de where tap_id = ?').run(tapId)
    const ds = await timPhuDe(t.duongDan)
    for (const [j, p] of ds.entries()) {
      db.prepare('insert into phu_de (tap_id, ngon_ngu, nhan, duong_dan, mac_dinh) values (?, ?, ?, ?, ?)').run(
        tapId,
        p.ngonNgu,
        p.nhan,
        p.duongDan,
        p.ngonNgu === 'vie' || j === 0 ? 1 : 0,
      )
    }
  }

  // Không tra được poster thì trích một khung hình cho lưới đỡ trống trải.
  const sauKhiLuu = db.prepare('select poster from phim where id = ?').get(phimId) as { poster: string | null }
  if (!sauKhiLuu.poster && coFfmpeg() && o.tep[0]) {
    const slug = (db.prepare('select slug from phim where id = ?').get(phimId) as { slug: string }).slug
    const thuMucAnh = path.join(process.cwd(), 'public', 'poster')
    await mkdir(thuMucAnh, { recursive: true })
    const anh = path.join(thuMucAnh, slug + '.jpg')
    if (await trichKhungHinh(o.tep[0].duongDan, anh, 180)) {
      db.prepare('update phim set poster = ? where id = ?').run('/poster/' + slug + '.jpg', phimId)
    }
  }

  return daCo ? 'capnhat' : 'them'
}

export async function quetTatCa(): Promise<KetQuaQuet> {
  const kq: KetQuaQuet = { themPhim: 0, themTap: 0, boQua: 0, thuMuc: 0, loi: [] }
  const goc = thuMucNguon(true)
  if (!goc.length) {
    kq.loi.push('Chưa có thư mục nguồn nào đang bật')
    return kq
  }

  for (const g of goc) {
    if (!existsSync(g.duong_dan)) {
      kq.loi.push('Không thấy thư mục: ' + g.duong_dan)
      continue
    }
    kq.thuMuc++

    const tep: TepVideo[] = []
    await duyetThuMuc(g.duong_dan, tep)

    // Gom theo thư mục cha: thư mục có từ 2 video trở lên coi là một phim bộ.
    const theoThuMuc = new Map<string, TepVideo[]>()
    for (const t of tep) {
      const ds = theoThuMuc.get(t.thuMuc) || []
      ds.push(t)
      theoThuMuc.set(t.thuMuc, ds)
    }

    for (const [thuMuc, ds] of theoThuMuc) {
      try {
        if (ds.length >= 2 && thuMuc !== g.duong_dan) {
          // Phim bộ: tên lấy từ tên thư mục
          const { ten, nam } = tachTen(path.basename(thuMuc))
          ds.sort((a, b) => soTapTu(a.ten, 0) - soTapTu(b.ten, 0) || a.ten.localeCompare(b.ten, 'vi'))
          const r = await luuPhim({ ten, nam, loai: 'bo', thuMuc, tep: ds })
          if (r === 'them') kq.themPhim++
          kq.themTap += ds.length
        } else {
          // Mỗi file là một phim lẻ riêng
          for (const t of ds) {
            const { ten, nam } = tachTen(t.ten)
            const r = await luuPhim({ ten, nam, loai: 'le', thuMuc: t.duongDan, tep: [t] })
            if (r === 'them') kq.themPhim++
            kq.themTap++
          }
        }
      } catch (e) {
        kq.loi.push(path.basename(thuMuc) + ': ' + (e instanceof Error ? e.message : String(e)))
      }
    }
  }

  // Dọn bản ghi trỏ tới file đã bị xoá khỏi ổ đĩa.
  const moiTap = db.prepare('select id, duong_dan_file from tap').all() as {
    id: number
    duong_dan_file: string | null
  }[]
  for (const t of moiTap) {
    if (t.duong_dan_file && !existsSync(t.duong_dan_file)) {
      db.prepare('delete from tap where id = ?').run(t.id)
      kq.boQua++
    }
  }
  db.prepare('delete from phim where nguon = ? and not exists (select 1 from tap where tap.phim_id = phim.id)').run(
    'local',
  )

  return kq
}

/** Đếm nhanh số file video trong một thư mục, để kiểm trước khi lưu vào danh sách nguồn. */
export async function demVideo(duongDan: string): Promise<number> {
  const s = await stat(duongDan).catch(() => null)
  if (!s || !s.isDirectory()) return -1
  const ra: TepVideo[] = []
  await duyetThuMuc(duongDan, ra)
  return ra.length
}
