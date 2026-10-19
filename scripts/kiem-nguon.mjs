/**
 * Bộ kiểm nguồn — chạy: node scripts/kiem-nguon.mjs
 *
 * Đây là hệ thống cảnh báo sớm. Nguồn vsmov đổi cấu trúc là các phép dưới đây
 * gãy ngay, thay vì phải mò trong giao diện.
 *
 * Sáu phép đầu chạy độc lập, không cần bật app. Hai phép cuối (chốt chặn đường
 * dẫn, tải thử bằng ffmpeg) tự bỏ qua nếu app chưa chạy / chưa có ffmpeg.
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { srtSangVtt, doiThoiGian } from '../lib/phu-de.ts'
import { bocVoTS, docSegment } from '../lib/hls.ts'
import { tachPhan } from '../lib/ten-phan.ts'
import { xepTap } from '../lib/xep-tap.ts'
import { nhipTuMoc, truocDay } from '../lib/nhip-tap.ts'
import { bienTheTuKhoa, khopTuKhoa, slugHoa } from '../lib/tu-khoa.ts'
import { xetTen18, mucTheoTheLoai } from '../lib/ten-18.ts'
import { chuanHoa, themAfter, nutAfterCredit, nhanNut } from '../lib/after-credit.ts'
import { laCham } from '../lib/do-cham.ts'
import { chonMal, docAniSkip, laAnime } from '../lib/aniskip-khop.ts'

const GOC = 'https://vsmov.com/api'
const APP = process.env.APP || 'http://127.0.0.1:3000'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36'

/**
 * Vé phiên cho các phép gọi vào app.
 *
 * Bật chế độ LAN thì mọi request không có vé đều nhận 401. Trước đây bộ kiểm hiểu
 * 401 là "app chưa chạy" và BỎ QUA — tức là đúng ba phép an toàn quan trọng nhất
 * (chốt proxy, chống CSRF, chặn 18+) âm thầm không được kiểm, mà dòng tổng vẫn ghi
 * "0 hỏng". Muốn kiểm phải tắt LAN tay, quên bật lại là mở toang cửa.
 *
 * Tự ký một vé 10 phút bằng chính khoá trong DB, y như lib/xac-thuc.ts. Ai đọc
 * được tệp DB thì vốn đã làm được việc này, nên không mở thêm lỗ nào.
 */
async function veKiem() {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const { createHmac } = await import('node:crypto')
    const d = new DatabaseSync('du-lieu/phim.db')
    d.exec('pragma busy_timeout = 5000')
    const k = d.prepare("select gia_tri from cai_dat where khoa = 'khoa_ky'").get()?.gia_tri
    d.close()
    if (!k) return ''
    const than = String(Date.now() + 10 * 60_000)
    return 'phim_phien=' + than + '.' + createHmac('sha256', k).update(than).digest('hex')
  } catch {
    return ''
  }
}
const VE = await veKiem()
const goiApp = (duong, init = {}) =>
  fetch(APP + duong, { ...init, headers: { ...(init.headers || {}), ...(VE ? { cookie: VE } : {}) } })

let dat = 0
let hong = 0
let boQua = 0

async function phep(ten, chay) {
  try {
    const kq = await chay()
    if (kq === 'bo-qua') {
      boQua++
      console.log('  ~  ' + ten + ' (bỏ qua)')
    } else {
      dat++
      console.log('  v  ' + ten + (kq ? ' — ' + kq : ''))
    }
  } catch (e) {
    hong++
    console.log('  X  ' + ten)
    console.log('       ' + (e && e.message ? e.message.split('\n')[0] : e))
  }
}

const json = async (u) => {
  const r = await fetch(u, { headers: { accept: 'application/json' } })
  assert.equal(r.status, 200, u + ' trả HTTP ' + r.status)
  return r.json()
}

function timFfmpeg() {
  if (!spawnSync('ffmpeg', ['-version'], { windowsHide: true }).error) return 'ffmpeg'
  const la = process.env.LOCALAPPDATA
  if (!la) return null
  const lien = path.join(la, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')
  if (existsSync(lien)) return lien
  const goi = path.join(la, 'Microsoft', 'WinGet', 'Packages')
  try {
    for (const d of readdirSync(goi)) {
      if (!d.startsWith('Gyan.FFmpeg')) continue
      for (const b of readdirSync(path.join(goi, d))) {
        const p = path.join(goi, d, b, 'bin', 'ffmpeg.exe')
        if (existsSync(p)) return p
      }
    }
  } catch {}
  return null
}

console.log('\nKIỂM NGUỒN PHIM\n')

// 1
await phep('Danh sách phim mới có dữ liệu và có phân trang', async () => {
  const j = await json(GOC + '/danh-sach/phim-moi-cap-nhat?page=1&limit=5')
  assert.ok(Array.isArray(j.items) && j.items.length > 0, 'items rỗng')
  assert.ok(j.pagination && j.pagination.totalPages > 0, 'thiếu pagination')
  assert.ok(j.items[0].slug && j.items[0].name, 'thiếu slug/name')
  return j.pagination.totalItems.toLocaleString('vi-VN') + ' phim'
})

// 2 — bắt lỗi lệch envelope: danh mục trần trả data.items chứ không phải items
await phep('Danh mục thể loại trả về ở data.items (không phải items)', async () => {
  const j = await json(GOC + '/the-loai')
  assert.ok(!Array.isArray(j.items), 'nguồn đã đổi: giờ trả items ở gốc')
  assert.ok(j.data && Array.isArray(j.data.items) && j.data.items.length > 0, 'data.items rỗng')
  return j.data.items.length + ' thể loại'
})

// 3 — bắt lỗi nguồn âm thầm bỏ qua bộ lọc
await phep('Lọc kết hợp thật sự thu hẹp kết quả', async () => {
  const a = await json(GOC + '/the-loai/hanh-dong?page=1&limit=1')
  const b = await json(GOC + '/the-loai/hanh-dong?page=1&limit=1&country=han-quoc')
  const c = await json(GOC + '/the-loai/hanh-dong?page=1&limit=1&country=han-quoc&year=2024')
  assert.ok(b.pagination.totalItems < a.pagination.totalItems, 'thêm country không đổi số lượng')
  assert.ok(c.pagination.totalItems < b.pagination.totalItems, 'thêm year không đổi số lượng')
  return `${a.pagination.totalItems} -> ${b.pagination.totalItems} -> ${c.pagination.totalItems}`
})

// 4
let embedMau = null
let m3u8Mau = null
await phep('Phim bộ có link_embed, suy ra m3u8 tải được, segment đầu sống', async () => {
  const j = await json(GOC + '/phim/the-gioi-hoan-my')
  const sv = j.episodes && j.episodes[0]
  assert.ok(sv && sv.server_data && sv.server_data.length, 'không có tập nào')
  embedMau = sv.server_data[0].link_embed
  assert.ok(embedMau, 'tập không có link_embed')

  const u = new URL(embedMau)
  const hash = u.pathname.split('/').filter(Boolean).pop()
  m3u8Mau = u.origin + '/stream/' + hash + '/master.m3u8'

  const r = await fetch(m3u8Mau, { headers: { 'user-agent': UA } })
  assert.equal(r.status, 200, 'm3u8 trả HTTP ' + r.status)
  const pl = await r.text()
  assert.ok(pl.includes('#EXTINF'), 'playlist không có EXTINF')

  const seg = pl.split(/\r?\n/).find((d) => d.trim() && !d.startsWith('#'))
  assert.ok(seg, 'playlist không có segment')
  const rs = await fetch(seg, { headers: { 'user-agent': UA, range: 'bytes=0-100' } })
  assert.ok(rs.status === 200 || rs.status === 206, 'segment trả HTTP ' + rs.status)
  return pl.split('#EXTINF').length - 1 + ' segment'
})

// 5
let vttMau = null
await phep('Trang embed cho ra ít nhất một track .vtt tải được', async () => {
  assert.ok(embedMau, 'phép 4 chưa lấy được embed')
  const r = await fetch(embedMau, { headers: { 'user-agent': UA, referer: 'https://vsmov.com/' } })
  const html = await r.text()
  const i = html.indexOf('subtitles')
  assert.ok(i > 0, 'HTML không còn biến subtitles')
  const dau = html.indexOf('[', i)
  const cuoi = html.indexOf(']', dau)
  const ds = JSON.parse(html.slice(dau, cuoi + 1))
  assert.ok(ds.length > 0, 'danh sách phụ đề rỗng')

  vttMau = new URL(ds[0].url, new URL(embedMau).origin).href
  const rv = await fetch(vttMau, { headers: { 'user-agent': UA } })
  assert.equal(rv.status, 200, 'vtt trả HTTP ' + rv.status)
  assert.ok((rv.headers.get('content-type') || '').includes('text/vtt'), 'content-type không phải text/vtt')
  return ds.map((s) => s.code).join(', ')
})

// 6 — chuẩn hoá phụ đề: nguồn gắn nhãn WEBVTT nhưng mốc thời gian dùng dấu phẩy
await phep('Chuẩn hoá phụ đề đổi dấu phẩy thành chấm và dời được thời gian', async () => {
  const tho = 'WEBVTT\n\n1\n00:00:17,750 --> 00:00:20,774\nXin chào\n'
  const vtt = srtSangVtt(tho)
  assert.ok(vtt.includes('00:00:17.750 --> 00:00:20.774'), 'không đổi được dấu phẩy: ' + vtt)

  const doi = doiThoiGian(vtt, 1.25)
  assert.ok(doi.includes('00:00:19.000'), 'dời thời gian sai: ' + doi)

  if (vttMau) {
    const chu = await (await fetch(vttMau, { headers: { 'user-agent': UA } })).text()
    const sau = srtSangVtt(chu)
    const soCue = (sau.match(/-->/g) || []).length
    assert.ok(soCue > 10, 'phụ đề thật chỉ ra ' + soCue + ' cue')
    return soCue + ' cue trên file thật'
  }
  return 'chỉ kiểm mẫu tổng hợp'
})

// 6b — tách "- Phần N" để gom các phần của cùng một phim vào một thẻ
await phep('Tách phần: cắt đúng đuôi, không cắt nhầm tên chứa chữ "Phần"', async () => {
  const dung = [
    ['Gia Đình Heck - Phần 9', 'Gia Đình Heck', 9],
    ['Chuyện Người Hầu Gái - Phần 3', 'Chuyện Người Hầu Gái', 3],
    ['Luật Pháp Và Trật Tự: Nạn Nhân Đặc Biệt - Phần 16', 'Luật Pháp Và Trật Tự: Nạn Nhân Đặc Biệt', 16],
    ['Shameless - Season 2', 'Shameless', 2],
  ]
  for (const [vao, goc, so] of dung) {
    const r = tachPhan(vao)
    assert.equal(r.goc, goc, `tách sai "${vao}" -> "${r.goc}"`)
    assert.equal(r.phan, so, `số phần sai cho "${vao}"`)
  }
  // Không được cắt: tên vốn chứa chữ "Phần"/"Season" mà không phải hậu tố phần
  for (const vao of ['Phần Mềm Diệt Virus', 'Season 1', 'Hello, Love, Goodbye', 'Vực Thẳm']) {
    const r = tachPhan(vao)
    assert.equal(r.phan, null, `cắt nhầm "${vao}" thành phần ${r.phan}`)
    assert.equal(r.goc, vao, `đổi nhầm tên "${vao}"`)
  }
  return dung.length + ' ca cắt đúng, 4 ca giữ nguyên'
})

await phep('Sắp tập theo số: nguồn trả lộn xộn, "Full" thì giữ nguyên', async () => {
  // Đúng kiểu lộn xộn đo được trên Đảo Hải Tặc: khối mới ở đầu, khối cũ ở sau
  const vao = ['1156', '1157', '1178', '1127', '1', '2'].map((ten) => ({ ten }))
  assert.deepEqual(
    xepTap(vao).map((t) => t.ten),
    ['1', '2', '1127', '1156', '1157', '1178'],
  )
  const coChu = ['Full', '1', 'Tập đặc biệt'].map((ten) => ({ ten }))
  assert.deepEqual(xepTap(coChu), coChu, 'có tên không phải số thì phải giữ nguyên thứ tự nguồn')
  return 'đúng thứ tự, không đụng danh sách có tập đặc biệt'
})

await phep('Tìm dự phòng: tên tiếng Anh dài vẫn ra phim, không kéo theo phim lạ', async () => {
  // Ca thật: "A love other than yours" gõ vào ô tìm mà ra rỗng
  const q = 'A love other than yours'
  assert.equal(slugHoa(q), 'a-love-other-than-yours')
  assert.deepEqual(bienTheTuKhoa(q), ['love other than yours', 'love other than', 'love other'])
  assert.deepEqual(bienTheTuKhoa('Người nhện'), ['nguoi nhen'], 'phải có biến thể bỏ dấu')
  assert.deepEqual(bienTheTuKhoa('bo gia'), [], 'từ khoá ngắn không dấu thì không có gì để thử thêm')
  const phim = { ten: 'Tình Yêu Ngoài Anh', tenGoc: 'A Love Other Than Yours', slug: 'tinh-yeu-ngoai-anh' }
  assert.ok(khopTuKhoa(q, phim), 'phải khớp theo tên gốc')
  assert.ok(khopTuKhoa('tinh yeu ngoai anh', phim), 'phải khớp tên Việt gõ không dấu')
  // Biến thể "love other" lỏng nên nguồn trả cả phim khác — lọc phải loại ra
  assert.ok(!khopTuKhoa(q, { ten: 'Love Other Side', tenGoc: 'Love Other Side' }), 'kéo nhầm phim thiếu từ')
  return 'slug đoán đúng, 3 biến thể, lọc đúng'
})

await phep('Lọc 18+ hai mức: chặn phim tình dục, chỉ gắn mác phim đàng hoàng', async () => {
  // Phim AV thật từng lọt lưới cũ (có trong kho đệm dựng sẵn)
  assert.equal(xetTen18('Tôi Bị Anh Trai Trẻ...', 'SONE-381妹の若い彼氏に恥ずかしいほど')?.muc, 'chan')
  assert.equal(xetTen18('FSDSS-982', 'FSDSS-982')?.muc, 'chan', 'tên gốc chỉ là mã AV')
  assert.equal(xetTen18('Phim Sex Nhật', '')?.muc, 'chan')
  // Phim đàng hoàng có từ nhạy cảm: chỉ gắn mác, không chặn
  assert.equal(xetTen18('Sau Khi Porn Kết Thúc', 'After Porn Ends')?.muc, 'canh-bao', 'phim tài liệu')
  assert.equal(xetTen18('Những Khoảnh Khắc Tình Yêu', 'Scenes of a Sexual Nature')?.muc, 'canh-bao')
  // Không được bắt oan
  assert.equal(xetTen18('THX 1138', 'THX-1138'), null, 'phim George Lucas bị bắt oan')
  assert.equal(xetTen18('Ma Cây: Lửa Địa Ngục', 'Evil Dead Burn'), null, 'phim kinh dị bị bắt')
  assert.equal(xetTen18('Mộng Du Tình Dục', 'Sexsomnia'), null)
  // Thể loại 18+ của nguồn: còn là kinh dị thì chỉ gắn mác, chỉ tình cảm thì chặn
  assert.equal(mucTheoTheLoai(['phim-18', 'kinh-di']).muc, 'canh-bao')
  assert.equal(mucTheoTheLoai(['phim-18', 'tinh-cam', 'co-trang']).muc, 'chan')
  // Phim chiếu rạp phổ biến (nhiều phiếu TMDB) chỉ gắn mác; tên là mã AV thì chặn dù gắn thể loại gì
  assert.equal(mucTheoTheLoai(['phim-18', 'tam-ly', 'tinh-cam'], { soPhieu: 1500 }).muc, 'canh-bao')
  assert.equal(mucTheoTheLoai(['phim-18', 'tam-ly'], { soPhieu: 12 }).muc, 'chan')
  assert.equal(mucTheoTheLoai(['phim-18', 'hanh-dong'], { ten: 'SONE-381', tenGoc: 'SONE-381' }).muc, 'chan')
  return '3 ca chặn, 2 ca gắn mác, 3 ca không bắt oan, 5 ca theo thể loại'
})

await phep('After credit: nút hiện đúng lúc, xem xong cảnh 1 mới mời sang cảnh 2', async () => {
  // Phim 2 giờ: chạy chữ từ 1:50:00, hai cảnh sau credit ở 1:55:00 và 1:58:00
  let m = chuanHoa({ batDauCredit: 6600, after: [] })
  m = themAfter(themAfter(m, 6900), 7080)
  assert.equal(themAfter(m, 6901).after.length, 2, 'bấm hai lần liền phải gộp thành một mốc')
  assert.equal(nutAfterCredit(m, 6500), null, 'chưa tới chạy chữ mà đã hiện nút')
  assert.deepEqual(nutAfterCredit(m, 6600), { chiSo: 0, den: 6900 })
  assert.equal(nhanNut(m, 0), 'Tới after credit 1')
  assert.equal(nutAfterCredit(m, 6930), null, 'đang xem cảnh 1 mà đã mời sang cảnh 2')
  assert.deepEqual(nutAfterCredit(m, 6960), { chiSo: 1, den: 7080 }, 'xem cảnh 1 được 60 giây phải mời sang cảnh 2')
  assert.equal(nutAfterCredit(m, 7080), null, 'qua cảnh cuối rồi thì nhường chỗ cho nút tập kế')
  // Chưa đánh dấu chạy chữ: hiện 8 phút trước cảnh 1, không lòi ra giữa phim
  const k = chuanHoa({ batDauCredit: null, after: [6900] })
  assert.equal(nutAfterCredit(k, 6000), null)
  assert.deepEqual(nutAfterCredit(k, 6420), { chiSo: 0, den: 6900 })
  assert.equal(nhanNut(k, 0), 'Tới after credit', 'một cảnh thì khỏi đánh số')
  assert.deepEqual(chuanHoa({ batDauCredit: -5, after: ['x', NaN, -1, 30] }), { batDauCredit: null, after: [30] }, 'dữ liệu bẩn lọt qua')
  return '10 ca: mốc chạy chữ, chuyển cảnh, gộp mốc trùng, lọc dữ liệu bẩn'
})

await phep('Máy chủ chậm: bắt chờ lâu và giật lắt nhắt, tha cho lần chờ do tua', async () => {
  const s = 1000
  const T = 10_000_000
  const lan = (tu, den, sauTua = false) => ({ tu: T - tu * s, den: T - den * s, sauTua })
  assert.equal(laCham([], { tu: T - 11 * s, sauTua: false }, T), null, 'chờ 11 giây đã coi là chậm')
  assert.ok(laCham([], { tu: T - 12 * s, sauTua: false }, T), 'chờ liền 12 giây mà không bắt')
  assert.equal(laCham([], { tu: T - 15 * s, sauTua: true }, T), null, 'tua xong chờ 15 giây là bình thường')
  assert.ok(laCham([], { tu: T - 20 * s, sauTua: true }, T), 'tua xong chờ 20 giây mà không bắt')
  assert.ok(laCham([lan(100, 93), lan(60, 53), lan(20, 13)], null, T), 'giật 3 lần × 7 giây mà không bắt')
  assert.equal(laCham([lan(60, 50), lan(20, 10)], null, T), null, 'giật 2 lần đã đổi máy chủ')
  assert.equal(laCham([lan(100, 92, true), lan(60, 52, true), lan(20, 12, true)], null, T), null, 'người hay tua bị đá oan')
  assert.equal(laCham([lan(300, 290), lan(250, 240), lan(200, 190)], null, T), null, 'giật từ 3 phút trước vẫn bị tính')
  return '8 ca: chờ liền, sau tua, giật lắt nhắt, quá cửa sổ'
})

await phep('AniSkip: chỉ nhận anime khớp chắc, đọc được cả hai kiểu dữ liệu', async () => {
  const jikan = [
    { mal_id: 38000, title: 'Kimetsu no Yaiba', title_english: 'Demon Slayer: Kimetsu no Yaiba', type: 'TV', year: 2019 },
    { mal_id: 40456, title: 'Kimetsu no Yaiba Movie: Mugen Ressha-hen', type: 'Movie', year: 2020 },
  ]
  assert.equal(chonMal(jikan, { tenGoc: 'Kimetsu no Yaiba', nam: 2019, laBo: true }), 38000)
  assert.equal(chonMal(jikan, { tenGoc: 'Demon Slayer' }), null, 'khớp một phần tên mà đã nhận')
  const hxh = [
    { mal_id: 136, title: 'Hunter x Hunter', type: 'TV', year: 1999 },
    { mal_id: 11061, title: 'Hunter x Hunter (2011)', title_english: 'Hunter x Hunter', type: 'TV', year: 2011 },
  ]
  assert.equal(chonMal(hxh, { tenGoc: 'Hunter x Hunter', nam: 2011, laBo: true }), 11061, 'năm phải tách được bản 2011')
  assert.equal(chonMal(hxh, { tenGoc: 'Hunter x Hunter', laBo: true }), null, 'hai bản trùng tên mà dám đoán')
  assert.deepEqual(
    docAniSkip({ found: true, results: [{ interval: { startTime: 88.5, endTime: 178.6 }, skipType: 'op' }, { interval: { start_time: 1320, end_time: 1410 }, skip_type: 'mixed-ed' }] }),
    { op: { tu: 88.5, den: 178.6 }, ed: { tu: 1320, den: 1410 } },
  )
  assert.deepEqual(docAniSkip({ found: false }), { op: null, ed: null })
  assert.ok(laAnime([{ slug: 'hoat-hinh' }], [{ slug: 'nhat-ban' }]))
  assert.ok(!laAnime([{ slug: 'hoat-hinh' }], [{ slug: 'au-my' }]), 'hoạt hình Mỹ không có trên AniSkip')
  return '4 ca chọn MAL, 2 kiểu dữ liệu, nhận diện anime'
})

await phep('Lịch ra tập: chỉ khẳng định khi dữ liệu đủ chắc', async () => {
  // Mốc giờ Việt Nam 20:00 — Date.UTC trừ 7 tiếng
  const vn = (y, m, d) => Date.UTC(y, m - 1, d, 13)
  // 2026-10-01 là Thứ Năm
  const thu5 = [vn(2026, 10, 1), vn(2026, 10, 8), vn(2026, 10, 15), vn(2026, 10, 22)]
  assert.equal(nhipTuMoc(thu5), 'Thường có tập mới vào Thứ Năm')
  assert.equal(nhipTuMoc(thu5.slice(0, 2)), null, 'mới 2 lần mà đã nói thành quy luật')
  // Cùng một lần cập nhật ghi hai lần (trang chi tiết + danh sách) không được thành 'mỗi ngày'
  assert.equal(nhipTuMoc([...thu5, ...thu5]), 'Thường có tập mới vào Thứ Năm', 'mốc trùng làm sai nhịp')
  const hangNgay = [1, 2, 3, 4, 5].map((d) => vn(2026, 10, d))
  assert.equal(nhipTuMoc(hangNgay), 'Ra tập gần như mỗi ngày')
  // 2026-10-05 Thứ Hai, 06 Thứ Ba
  const haiTap = [vn(2026, 10, 5), vn(2026, 10, 6), vn(2026, 10, 12), vn(2026, 10, 13), vn(2026, 10, 19)]
  assert.equal(nhipTuMoc(haiTap), 'Thường có tập mới vào Thứ Hai và Thứ Ba')
  // Lộn xộn không theo thứ nào -> không được bịa
  const lungTung = [vn(2026, 9, 1), vn(2026, 9, 5), vn(2026, 9, 13), vn(2026, 9, 24), vn(2026, 10, 2)]
  assert.equal(nhipTuMoc(lungTung), null, 'dữ liệu không có nhịp mà vẫn đưa ra một câu')
  const bay = Date.UTC(2026, 9, 6, 5)
  assert.equal(truocDay(new Date(bay - 3 * 86400000).toISOString(), bay), '3 ngày trước')
  assert.equal(truocDay('rác', bay), null)
  return 'thứ cố định, hằng ngày, hai tập/tuần, và không bịa khi lộn xộn'
})

await phep('Quy ước ảnh của nguồn: vsmov poster_url ngang, KKPhim poster_url dọc', async () => {
  const ff = timFfmpeg()
  if (!ff) return 'bo-qua'
  const probe = ff.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe'))
  const tam = await mkdtemp(path.join(os.tmpdir(), 'kiem-anh-'))
  async function kichThuoc(url, ten) {
    const r = await fetch(url, { headers: { 'user-agent': UA } })
    assert.equal(r.status, 200, 'tải ảnh ' + url + ' trả HTTP ' + r.status)
    const t = path.join(tam, ten)
    await writeFile(t, Buffer.from(await r.arrayBuffer()))
    const o = spawnSync(probe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', t], {
      encoding: 'utf8',
      windowsHide: true,
    })
    const [w, h] = String(o.stdout).trim().split(',').map(Number)
    assert.ok(w && h, 'ffprobe không đọc được ' + url)
    return { w, h }
  }
  try {
    // Nếu một ngày nguồn đổi quy ước, phép này hỏng TRƯỚC khi giao diện hỏng.
    // Hỏng ở vsmov: đổi lại hai dòng gán ảnh trong lib/vsmov.ts.
    // Hỏng ở KKPhim: đổi hai dòng trong lib/nguon-kkphim.ts.
    // Khoảng 5% phim có một trường ảnh là {} thay vì chuỗi — chỉ lấy phim đủ cả hai
    const duAnh = (x) => typeof x.poster_url === 'string' && x.poster_url && typeof x.thumb_url === 'string' && x.thumb_url
    const vs = (await json(GOC + '/danh-sach/phim-moi-cap-nhat?page=1')).items.filter(duAnh).slice(0, 3)
    for (const [i, x] of vs.entries()) {
      const p = await kichThuoc(x.poster_url, 'vp' + i)
      const t = await kichThuoc(x.thumb_url, 'vt' + i)
      assert.ok(p.w > p.h, 'vsmov poster_url không còn là ảnh ngang: ' + p.w + 'x' + p.h + ' (' + x.slug + ')')
      assert.ok(t.h > t.w, 'vsmov thumb_url không còn là ảnh dọc: ' + t.w + 'x' + t.h + ' (' + x.slug + ')')
    }
    const kk = (await json('https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1')).items.filter(duAnh).slice(0, 3)
    const goc = (u) => (u.startsWith('http') ? u : 'https://phimimg.com/' + u.replace(/^\/+/, ''))
    for (const [i, x] of kk.entries()) {
      const p = await kichThuoc(goc(x.poster_url), 'kp' + i)
      const t = await kichThuoc(goc(x.thumb_url), 'kt' + i)
      assert.ok(p.h > p.w, 'KKPhim poster_url không còn là ảnh dọc: ' + p.w + 'x' + p.h + ' (' + x.slug + ')')
      assert.ok(t.w > t.h, 'KKPhim thumb_url không còn là ảnh ngang: ' + t.w + 'x' + t.h + ' (' + x.slug + ')')
    }
    return '3 phim mỗi nguồn, đúng quy ước đang dùng'
  } finally {
    // maxRetries: Windows hay giữ tệp .mp4 vừa ghi vài trăm ms (trình diệt virus
    // quét), xoá ngay là EPERM — bộ kiểm báo hỏng oan dù phần kiểm đã đạt.
    rmSync(tam, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

// 7 — chốt chặn: cần app đang chạy
await phep('Chốt chặn proxy: miền lạ và đường dẫn ngoài thư mục nguồn đều bị 403', async () => {
  let song = false
  try {
    song = (await goiApp('/api/tep', { signal: AbortSignal.timeout(3000) })).status === 400
  } catch {
    return 'bo-qua'
  }
  if (!song) return 'bo-qua'

  const a = await goiApp('/api/tep?u=' + encodeURIComponent('https://example.com/x.m3u8'))
  assert.equal(a.status, 403, 'miền lạ không bị chặn, trả ' + a.status)

  const b = await goiApp('/api/tep?f=' + encodeURIComponent('C:\\Windows\\win.ini'))
  assert.equal(b.status, 403, 'đọc file ngoài thư mục nguồn không bị chặn, trả ' + b.status)

  const c = await goiApp('/api/tep?f=' + encodeURIComponent('..\\..\\..\\Windows\\win.ini'))
  assert.equal(c.status, 403, 'đường dẫn .. không bị chặn, trả ' + c.status)
  return 'cả 3 lối vào đều 403'
})

// 7b — chống CSRF: POST cross-site phải bị chặn, same-origin phải qua
await phep('Chống CSRF: cross-site bị 403, same-origin qua', async () => {
  let song = false
  try {
    song = (await goiApp('/api/tep', { signal: AbortSignal.timeout(3000) })).status === 400
  } catch {
    return 'bo-qua'
  }
  if (!song) return 'bo-qua'

  const than = JSON.stringify({ viec: 'tien-do', khoa: 'kiem-csrf:1', slug: 'kiem-csrf', viTri: 1, thoiLuong: 100 })
  const cheo = await goiApp('/api/xem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
    body: than,
  })
  assert.equal(cheo.status, 403, 'POST cross-site KHÔNG bị chặn, trả ' + cheo.status)

  const cung = await goiApp('/api/xem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: than,
  })
  assert.equal(cung.status, 200, 'POST same-origin bị chặn nhầm, trả ' + cung.status)
  // dọn bản ghi vừa ghi
  await goiApp('/api/xem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ viec: 'xoa-tien-do', khoa: 'kiem-csrf:1' }),
  })
  return 'cross-site 403, same-origin 200'
})

// 7c — chặn 18+ và khử trùng khi gộp nguồn
await phep('Chặn 18+ và khử trùng nguồn', async () => {
  let song = false
  try {
    song = (await goiApp('/api/tep', { signal: AbortSignal.timeout(3000) })).status === 400
  } catch {
    return 'bo-qua'
  }
  if (!song) return 'bo-qua'

  const { DatabaseSync } = await import('node:sqlite')
  const d = new DatabaseSync('du-lieu/phim.db')
  // Chỉ phim bị CHẶN mới phải 404 — phim gắn mác 18+ vẫn mở được (có bảng cảnh báo)
  const den = d
    .prepare("select slug from chan_18 where coalesce(muc_tay, muc_tu_dong) = 'chan' limit 5")
    .all()
    .map((x) => x.slug)
  if (!den.length) return 'bo-qua'

  // Trang chi tiết phim 18+ KHÔNG được dựng ra nội dung phim
  for (const s of den) {
    const h = await (await goiApp('/phim/' + s, { headers: { 'sec-fetch-site': 'same-origin' } })).text()
    assert.ok(!/<h1/.test(h), 'phim 18+ vẫn dựng ra tiêu đề: ' + s.slice(0, 16))
  }

  // Kho đệm không được chứa phim nằm trong sổ đen
  const lot = d
    .prepare(
      "select count(*) as n from kho_phim k join chan_18 c on c.slug = k.slug where coalesce(c.muc_tay, c.muc_tu_dong) = 'chan'",
    )
    .get().n
  assert.equal(lot, 0, lot + ' phim 18+ lọt vào kho đệm')

  // Trang duyệt gộp nguồn không được lặp slug
  const hd = await (await goiApp('/duyet?danh-sach=phim-moi-cap-nhat', { headers: { 'sec-fetch-site': 'same-origin' } })).text()
  const slug = [...hd.matchAll(/href="\/phim\/([^"]+)"/g)].map((m) => m[1])
  assert.equal(slug.length, new Set(slug).size, 'trang duyệt còn slug lặp')

  return den.length + ' phim 18+ bị chặn, ' + slug.length + ' thẻ không lặp'
})

// 8 — tải thử 30 giây, kiểm phụ đề có nhúng vào file thật không
await phep('ffmpeg tải 30 giây đầu ra MP4 có luồng phụ đề mov_text', async () => {
  const ff = timFfmpeg()
  if (!ff || !m3u8Mau || !vttMau) return 'bo-qua'

  const tam = await mkdtemp(path.join(os.tmpdir(), 'kiem-phim-'))
  try {
    const sub = path.join(tam, 'vie.vtt')
    await writeFile(sub, srtSangVtt(await (await fetch(vttMau, { headers: { 'user-agent': UA } })).text()), 'utf8')
    const ra = path.join(tam, 'thu.mp4')

    // Đi đúng đường của bộ tải thật: tự bóc vỏ PNG rồi bơm TS vào stdin ffmpeg.
    const pl = await (await fetch(m3u8Mau, { headers: { 'user-agent': UA } })).text()
    const seg = docSegment(pl, m3u8Mau).slice(0, 5)
    assert.ok(seg.length, 'không đọc được segment nào từ playlist')

    await new Promise((xong, hong) => {
      const p = spawn(
        ff,
        [
          '-hide_banner', '-loglevel', 'error',
          '-f', 'mpegts', '-i', 'pipe:0',
          '-i', sub,
          '-map', '0:v:0', '-map', '0:a:0?', '-map', '1:0',
          '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text',
          '-metadata:s:s:0', 'language=vie',
          '-bsf:a', 'aac_adtstoasc', '-y', ra,
        ],
        { windowsHide: true },
      )
      let loi = ''
      p.stderr.on('data', (d) => (loi += d))
      p.stdin.on('error', () => {})
      p.on('error', hong)
      p.on('close', (m) => (m === 0 ? xong() : hong(new Error('ffmpeg mã ' + m + ': ' + loi.slice(0, 300)))))
      ;(async () => {
        for (const u of seg) {
          const rs = await fetch(u, { headers: { 'user-agent': UA } })
          const khoi = bocVoTS(Buffer.from(await rs.arrayBuffer()))
          if (khoi.length === 0) throw new Error('bóc vỏ ra khối rỗng')
          p.stdin.write(khoi)
        }
        p.stdin.end()
      })().catch(hong)
    })

    assert.ok(existsSync(ra), 'không sinh ra file mp4')

    const probe = spawnSync(
      ff.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace('ffmpeg', 'ffprobe')),
      ['-v', 'quiet', '-print_format', 'json', '-show_streams', ra],
      { encoding: 'utf8', windowsHide: true },
    )
    const luong = JSON.parse(probe.stdout || '{}').streams || []
    const phuDe = luong.find((s) => s.codec_type === 'subtitle')
    assert.ok(phuDe, 'file tải về KHÔNG có luồng phụ đề')
    assert.equal(phuDe.codec_name, 'mov_text', 'phụ đề không phải mov_text: ' + phuDe.codec_name)
    assert.equal(phuDe.tags && phuDe.tags.language, 'vie', 'thiếu mã ngôn ngữ vie')
    return luong.map((s) => s.codec_type + ':' + s.codec_name).join(', ')
  } finally {
    rmSync(tam, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

console.log(`\n${dat} đạt · ${hong} hỏng · ${boQua} bỏ qua\n`)
process.exit(hong ? 1 : 0)
