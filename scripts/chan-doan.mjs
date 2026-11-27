/**
 * Chẩn đoán vì sao một phim không phát được — chạy trên CHÍNH máy đang chạy app.
 *
 *   npm run chan-doan -- <link trang xem hoặc slug phim>
 *   npm run chan-doan -- http://127.0.0.1:3000/xem/ten-phim?tap=1
 *   npm run chan-doan -- ten-phim
 *
 * Đi đúng đường trình phát đi: API nguồn → playlist → playlist con → mảnh video đầu, rồi đi lại
 * qua proxy /api/tep của app nếu app đang chạy. In từng bước và một câu kết luận.
 *
 * Vì sao cần chạy ở máy người xem: máy chủ mới của KKPhim (a.kvp726.com) chỉ trả lời IP Việt Nam,
 * và mạng công ty có bộ lọc web / soi HTTPS riêng — ở nơi khác đo không ra những thứ đó.
 */
import { docTrangLoiNguon, giaiThichLoiMang } from '../lib/mien-phat.ts'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const vao = process.argv[2] || ''
const congApp = Number(process.argv[3]) || 3000

if (!vao) {
  console.log('\n  Cách dùng: npm run chan-doan -- <link trang xem hoặc slug phim>\n')
  process.exit(1)
}

let slug = vao.trim()
let tapCan = null
try {
  const u = new URL(vao)
  const m = u.pathname.match(/\/(?:xem|phim)\/([a-z0-9-]+)/)
  if (m) slug = m[1]
  tapCan = u.searchParams.get('tap')
} catch {
  // không phải URL — coi như slug
}

const ketLuan = []
const in1 = (dau, chu) => console.log(`  ${dau} ${chu}`)

async function goi(url, giay = 15) {
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA, referer: new URL(url).origin + '/' },
      redirect: 'follow',
      signal: AbortSignal.timeout(giay * 1000),
    })
    const ct = r.headers.get('content-type') || ''
    const buf = Buffer.from(await r.arrayBuffer())
    return { r, ct, buf, chu: buf.toString('utf8') }
  } catch (e) {
    return { loi: giaiThichLoiMang(e, new URL(url).hostname) }
  }
}

/** Xét một playlist / mảnh video tải thẳng từ nguồn. Trả nội dung playlist nếu đọc được. */
async function xetTep(url, nhan) {
  const k = await goi(url)
  if (k.loi) {
    in1('X', `${nhan}: ${k.loi}`)
    ketLuan.push(k.loi)
    return null
  }
  const { r, ct, buf, chu } = k
  if (chu.trimStart().startsWith('#EXTM3U')) {
    in1('v', `${nhan}: mã ${r.status}, playlist ${chu.split('\n').length} dòng`)
    return chu
  }
  if (ct.includes('text/html') || chu.trimStart().startsWith('<')) {
    const t = docTrangLoiNguon(chu)
    if (t.chanNuocNgoai) {
      const cau =
        `Máy chủ ${new URL(url).hostname} chặn IP nước ngoài; máy này đang ra mạng bằng IP ` +
        `${t.ip ?? '?'} (${t.nuoc ?? 'không rõ nước'}). Tắt VPN / proxy công ty hoặc dùng mạng khác (4G điện thoại).`
      in1('X', `${nhan}: ${cau}`)
      ketLuan.push(cau)
    } else {
      in1('X', `${nhan}: mã ${r.status}, nguồn trả TRANG WEB thay vì video: ${chu.replace(/\s+/g, ' ').slice(0, 120)}`)
      ketLuan.push(`Máy chủ ${new URL(url).hostname} trả trang web (mã ${r.status}) thay vì video.`)
    }
    return null
  }
  if (!r.ok) {
    in1('X', `${nhan}: mã ${r.status} (${ct || 'không rõ kiểu'})`)
    ketLuan.push(`Máy chủ ${new URL(url).hostname} trả mã ${r.status}.`)
    return null
  }
  const ts = buf.indexOf(0x47) >= 0 && buf[buf.indexOf(0x47) + 188] === 0x47
  const png = buf[0] === 0x89 && buf[1] === 0x50
  in1('v', `${nhan}: mã ${r.status}, ${(buf.length / 1024).toFixed(0)} KB, ${ts ? 'luồng MPEG-TS' : 'dữ liệu lạ'}${png ? ' (bọc vỏ ảnh PNG, trình phát tự bóc)' : ''}`)
  if (!ts) ketLuan.push(`Mảnh video tải về không phải MPEG-TS (${ct}).`)
  return null
}

/** Dòng URL đầu tiên (không phải #) trong playlist, giải theo địa chỉ playlist. */
function dongDau(pl, goc) {
  const d = pl.split(/\r?\n/).map((x) => x.trim()).find((x) => x && !x.startsWith('#'))
  return d ? new URL(d, goc).href : null
}

async function quaApp(url) {
  const app = `http://127.0.0.1:${congApp}/api/tep?u=${encodeURIComponent(url)}`
  try {
    const r = await fetch(app, { headers: { 'sec-fetch-site': 'same-origin' }, signal: AbortSignal.timeout(30000) })
    const ct = r.headers.get('content-type') || ''
    if (r.ok) return in1('v', `Qua app (/api/tep): mã ${r.status}, ${ct.split(';')[0]}`)
    const j = ct.includes('json') ? await r.json().catch(() => null) : null
    if (r.status === 401) return in1('~', 'Qua app: app đang bật mật khẩu LAN, bỏ qua bước này.')
    in1('X', `Qua app (/api/tep): mã ${r.status}${j?.loi ? ' — ' + j.loi : ''}`)
    if (j?.loi && !ketLuan.includes(j.loi)) ketLuan.push('App báo: ' + j.loi)
  } catch {
    in1('~', `Qua app: không thấy app chạy ở cổng ${congApp} (bỏ qua bước này).`)
  }
}

console.log(`\n  Chẩn đoán phim: ${slug}${tapCan ? ' · tập ' + tapCan : ''}\n`)

// 1. KKPhim
const kk = await goi('https://phimapi.com/phim/' + slug)
let m3u8 = null
if (kk.loi) {
  in1('X', 'KKPhim (phimapi.com): ' + kk.loi)
  ketLuan.push(kk.loi)
} else {
  let j = null
  try {
    j = JSON.parse(kk.chu)
  } catch {}
  const eps = j?.episodes || []
  if (!j?.movie?.slug) in1('~', 'KKPhim: không có phim này.')
  else {
    in1('v', `KKPhim: "${j.movie.name}", ${eps.length} máy chủ`)
    for (const s of eps) {
      const ds = s.server_data || []
      const tap = (tapCan && ds.find((e) => e.slug === tapCan || e.name === tapCan || String(Number(e.name)) === tapCan)) || ds[0]
      if (!tap) continue
      const link = tap.link_m3u8 || tap.link_embed || ''
      in1(' ', `  ${String(s.server_name).trim()} · tập ${tap.name}: ${link ? new URL(link).hostname : '(trống)'}`)
      if (!m3u8 && tap.link_m3u8) m3u8 = tap.link_m3u8
    }
  }
}

// 2. vsmov (chỉ để biết còn máy chủ khác không)
const vs = await goi('https://vsmov.com/api/phim/' + slug)
if (vs.loi) in1('X', 'vsmov: ' + vs.loi)
else {
  let j = null
  try {
    j = JSON.parse(vs.chu)
  } catch {}
  in1(j?.movie?.slug ? 'v' : '~', j?.movie?.slug ? `vsmov: có phim này, ${(j.episodes || []).length} máy chủ` : 'vsmov: không có phim này.')
}

// 3. Đi theo playlist của KKPhim
if (m3u8) {
  console.log('')
  const pl = await xetTep(m3u8, 'Playlist gốc')
  if (pl) {
    let con = pl
    let gocCon = m3u8
    if (/#EXT-X-STREAM-INF/.test(pl)) {
      gocCon = dongDau(pl, m3u8)
      con = gocCon ? await xetTep(gocCon, 'Playlist con') : null
    }
    const seg = con ? dongDau(con, gocCon) : null
    if (seg) await xetTep(seg, `Mảnh video đầu (${new URL(seg).hostname})`)
  }
  await quaApp(m3u8)
}

console.log('\n  KẾT LUẬN')
if (!ketLuan.length) {
  console.log(
    m3u8
      ? '  Từ máy này tải được trọn chuỗi phát. Nếu trình duyệt vẫn báo lỗi: build lại app (npm run chay),\n  mở lại trang phim, và gửi dòng "Chi tiết: ..." trên màn hình lỗi.'
      : '  Không tìm thấy link phát m3u8 nào để thử. Kiểm lại slug phim.',
  )
} else for (const c of [...new Set(ketLuan)]) console.log('  - ' + c)
console.log('')
