// Kiểm tra trọn đường đi của người xem trong app Kho phim, NGAY TRÊN BOX, qua DevTools của WebView.
//   node kiem-tra-app.mjs <cổng devtools> <mốc giờ bấm mở app (ms)>     — kiem-tra-app.sh lo adb rồi gọi tệp này
// Mở app → trang chủ → lướt remote → mở phim → phát → tua → dừng/phát → quay về → tìm kiếm.
// Mỗi bước: thời gian, độ mượt, lỗi JS/mạng. Không sửa gì (chỉ bấm phím như remote).
// In báo cáo gọn để chụp màn hình, lưu bản đủ ở ~/bao-cao-app.json để so lần sau.
import { writeFileSync } from 'node:fs'

const CONG = Number(process.argv[2] || 9222)
const GOC = 'http://127.0.0.1:3000'
const MOC_MO = Number(process.argv[3] || 0)
const nghi = (ms) => new Promise((r) => setTimeout(r, ms))
const bc = { luc: new Date().toISOString(), buoc: {}, loi: [], mang: [] }
const dong = (s) => console.log(s)

// ---------- nối DevTools ----------
async function timTrang() {
  for (let i = 0; i < 40; i++) {
    try {
      const ds = await (await fetch(`http://127.0.0.1:${CONG}/json`)).json()
      const t = ds.find((x) => x.type === 'page' && x.url.startsWith('http://127.0.0.1:3000')) ||
        (process.env.KT_TAI_LAI && ds.find((x) => x.type === 'page'))
      if (t) return t
    } catch {}
    await nghi(500)
  }
  throw new Error('Không thấy trang 127.0.0.1:3000 trong app Kho phim sau 20 giây')
}
const trang = await timTrang()
const ws = new WebSocket(trang.webSocketDebuggerUrl)
await new Promise((ok, loi) => { ws.onopen = ok; ws.onerror = loi })
let soId = 0
const cho = new Map()
const nghe = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && cho.has(d.id)) { cho.get(d.id)(d); cho.delete(d.id); return }
  if (d.method) for (const f of nghe) f(d.method, d.params)
}
const goi = (method, params = {}) => new Promise((ok, loi) => {
  const id = ++soId
  cho.set(id, (d) => (d.error ? loi(new Error(`${method}: ${d.error.message}`)) : ok(d.result)))
  ws.send(JSON.stringify({ id, method, params }))
})
// Trang đang chuyển (history.back, location.assign) thì lệnh đo bị huỷ — chờ trang mới rồi chạy lại
const chay = async (bt) => {
  for (let lan = 0; ; lan++) {
    try {
      const r = await goi('Runtime.evaluate', { expression: bt, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) throw new Error('Lỗi khi đo: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
      return r.result.value
    } catch (e) {
      if (lan >= 40 || !/navigated|context|closed/i.test(e.message)) throw e
      await nghi(250)
    }
  }
}
const doiDen = async (bt, ms = 20000, buoc = 100) => {
  const bd = Date.now()
  while (Date.now() - bd < ms) {
    try { if (await chay(bt)) return Date.now() - bd } catch {}
    await nghi(buoc)
  }
  return null
}

// ---------- gom lỗi ----------
let buocHienTai = 'mo-app'
const yeuCau = new Map()
nghe.push((m, p) => {
  if (m === 'Runtime.exceptionThrown') {
    bc.loi.push({ buoc: buocHienTai, loai: 'JS', noi: (p.exceptionDetails.exception?.description || p.exceptionDetails.text || '').split('\n')[0] })
  } else if (m === 'Runtime.consoleAPICalled' && p.type === 'error') {
    bc.loi.push({ buoc: buocHienTai, loai: 'console', noi: p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160) })
  } else if (m === 'Network.requestWillBeSent') {
    yeuCau.set(p.requestId, p.request.url)
  } else if (m === 'Network.responseReceived' && p.response.status >= 400 && p.response.status !== 401) {
    bc.mang.push({ buoc: buocHienTai, ma: p.response.status, url: p.response.url.replace('http://127.0.0.1:3000', '').slice(0, 120) })
  } else if (m === 'Network.loadingFailed' && !p.canceled) {
    bc.mang.push({ buoc: buocHienTai, ma: p.errorText, url: (yeuCau.get(p.requestId) || '').replace('http://127.0.0.1:3000', '').slice(0, 120) })
  }
})
await goi('Runtime.enable')
await goi('Network.enable')
await goi('Performance.enable')
// Thử trên máy tính: KT_CHAM=6 bóp CPU trình duyệt cho chậm ngang box, KT_TAI_LAI=1 tải lại trang để đo bước mở app.
// Trên box không đặt hai biến này (WebView chạy đúng tốc độ thật, app vừa được mở mới).
if (process.env.KT_CHAM) await goi('Emulation.setCPUThrottlingRate', { rate: Number(process.env.KT_CHAM) })
if (process.env.KT_TAI_LAI) {
  await goi('Page.enable')
  await chay(`(() => { location.replace('${GOC}/'); return true })()`).catch(() => {})
  await nghi(500)
}

const PHIM = { ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27 }
async function bam(key) {
  const p = { key, code: key, windowsVirtualKeyCode: PHIM[key], nativeVirtualKeyCode: PHIM[key] }
  await goi('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...p, ...(key === 'Enter' ? { text: '\r' } : {}) })
  if (key === 'Enter') await goi('Input.dispatchKeyEvent', { type: 'char', ...p, text: '\r' })
  await goi('Input.dispatchKeyEvent', { type: 'keyUp', ...p })
}
const metric = async () => Object.fromEntries((await goi('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))

// Đếm khung + độ trễ phím → ô chọn đổi (như do-muot.mjs)
const CAI_DEM = `(() => { const d = window.__dem = { khung: [], tre: [], bam: 0, truoc: document.activeElement, chay: true };
  if (!window.__demPhim) { window.__demPhim = 1; addEventListener('keydown', () => { if (window.__dem) window.__dem.bam = performance.now() }, true) }
  const vong = (t) => { if (!d.chay) return; d.khung.push(t);
    if (document.activeElement !== d.truoc) { d.truoc = document.activeElement; if (d.bam) { d.tre.push(t - d.bam); d.bam = 0 } }
    requestAnimationFrame(vong) }; requestAnimationFrame(vong); return true })()`
async function demTrong(fn) {
  const m0 = await metric()
  await chay(CAI_DEM)
  const bd = Date.now()
  await fn()
  const giay = (Date.now() - bd) / 1000
  const { khung, tre } = await chay(`(() => { const d = window.__dem; d.chay = false; return { khung: d.khung, tre: d.tre } })()`)
  const m1 = await metric()
  let giat = 0, toiDa = 0
  for (let i = 1; i < khung.length; i++) { const k = khung[i] - khung[i - 1]; if (k > 50) giat++; if (k > toiDa) toiDa = k }
  return {
    fps: +(khung.length / giay).toFixed(0), giat, khungLauNhat: +toiDa.toFixed(0),
    treTB: tre.length ? +(tre.reduce((a, b) => a + b, 0) / tre.length).toFixed(0) : null,
    treMax: tre.length ? +Math.max(...tre).toFixed(0) : null, doiO: tre.length,
    styleMs: +((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(0),
    layoutMs: +((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(0),
    jsMs: +((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0),
  }
}
const inDem = (d) => `fps ${d.fps} | giật ${d.giat} (lâu nhất ${d.khungLauNhat} ms) | trễ phím ${d.treTB ?? '-'}/${d.treMax ?? '-'} ms` +
  ` | style ${d.styleMs} bố cục ${d.layoutMs} JS ${d.jsMs} ms`

// ---------- 1. Mở app → trang chủ ----------
await doiDen(`document.readyState === 'complete'`, 30000)
const mo = await chay(`(() => { const n = performance.getEntriesByType('navigation')[0] || {};
  const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
  const anh = performance.getEntriesByType('resource').filter((r) => r.name.includes('/api/anh'));
  const imgs = [...document.images].filter((i) => i.complete && i.naturalWidth);
  const thua = imgs.filter((i) => i.clientWidth).map((i) => i.naturalWidth / i.clientWidth);
  return { goc: performance.timeOrigin, ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd,
    lcp: lcp ? lcp.startTime : null, phanTu: document.getElementsByTagName('*').length,
    oChon: document.querySelectorAll('a[href],button').length, anhTai: anh.length,
    anhKB: Math.round(anh.reduce((a, r) => a + (r.encodedBodySize || r.transferSize || 0), 0) / 1024),
    anhCham: Math.round(Math.max(0, ...anh.map((r) => r.duration))), anhRong: imgs.length ? Math.round(imgs.reduce((a, i) => a + i.naturalWidth, 0) / imgs.length) : 0,
    thuaTB: thua.length ? +(thua.reduce((a, b) => a + b, 0) / thua.length).toFixed(1) : 0,
    khung: innerWidth + 'x' + innerHeight, nhe: document.documentElement.dataset.nhe || '', cheDo: document.documentElement.dataset.cheDo } })()`)
const tuLucBam = MOC_MO ? Math.round(mo.goc + mo.load - MOC_MO) : null
bc.buoc.moApp = { ...mo, tuLucBam }
dong(`1. MỞ APP → TRANG CHỦ`)
dong(`   bấm mở → trang xong: ${tuLucBam ?? '?'} ms | máy chủ trả HTML ${Math.round(mo.ttfb)} ms | dựng xong ${Math.round(mo.dcl)} ms | tải xong ${Math.round(mo.load)} ms | ảnh lớn nhất hiện ${mo.lcp ? Math.round(mo.lcp) : '?'} ms`)
dong(`   ${mo.phanTu} phần tử, ${mo.oChon} ô bấm | ảnh: ${mo.anhTai} tấm ${mo.anhKB} KB, chậm nhất ${mo.anhCham} ms, rộng TB ${mo.anhRong}px = ${mo.thuaTB}x chỗ hiện`)
dong(`   khung ${mo.khung}, chế độ ${mo.cheDo}${mo.nhe ? ', nhẹ' : ', CHƯA nhẹ (bản cũ?)'}`)

// ---------- 2. Lướt trang chủ bằng remote ----------
buocHienTai = 'luot'
await chay(`(() => { scrollTo(0, 0); const a = document.querySelector('.hang-phim a[href^="/phim/"]'); a && a.focus(); return !!a })()`)
await nghi(600)
const luot = await demTrong(async () => {
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp']) {
    await bam(k); await nghi(300)
  }
  await nghi(800)
})
bc.buoc.luot = luot
dong(`2. LƯỚT TRANG CHỦ (18 phím): ${inDem(luot)} | đổi ô ${luot.doiO}/18`)

// ---------- 3. Mở một phim ----------
buocHienTai = 'mo-phim'
await chay(`(() => { scrollTo(0, 0); const a = document.querySelector('.hang-phim a[href^="/phim/"]'); a && a.focus(); return !!a })()`)
await nghi(500)
const slug = await chay(`(document.activeElement.getAttribute('href') || '').replace('/phim/', '')`)
let bd = Date.now()
if (slug) await bam('Enter')
const moPhim = !slug ? null : await doiDen(`!!document.querySelector('[aria-modal="true"] a[href^="/xem/"], main a[href^="/xem/"]')`, 20000)
bc.buoc.moPhim = { slug, ms: moPhim, url: await chay('location.pathname') }
dong(`3. MỞ PHIM "${slug}": ${moPhim ?? 'KHÔNG MỞ ĐƯỢC (20 giây)'}${moPhim != null ? ' ms' : ''}`)

// ---------- 4. Bấm Xem → phát ----------
buocHienTai = 'phat'
const coNutXem = await chay(`(() => { const v = document.querySelector('[aria-modal="true"]') || document;
  const a = v.querySelector('a[href^="/xem/"]'); if (a) a.focus(); return !!a })()`)
bd = Date.now()
if (coNutXem) await bam('Enter')
const vaoTrang = coNutXem ? await doiDen(`location.pathname.startsWith('/xem/') && !!document.getElementById('video-chinh')`, 20000) : null
const phat = vaoTrang != null ? await doiDen(`(() => { const v = document.getElementById('video-chinh'); return v && !v.paused && v.currentTime > 0.3 && v.readyState >= 3 })()`, 45000, 200) : null
const tongPhat = phat != null ? Date.now() - bd : null
bc.buoc.phat = { vaoTrang, tongPhat, url: await chay('location.pathname') }
dong(`4. XEM: vào trang xem ${vaoTrang ?? 'KHÔNG'}${vaoTrang != null ? ' ms' : ''} | từ lúc bấm tới khi phim chạy: ${tongPhat ?? 'KHÔNG CHẠY (45 giây)'}${tongPhat != null ? ' ms' : ''}`)

if (phat != null) {
  // 10 giây phát: khung hình video rớt + độ mượt giao diện
  const q0 = await chay(`(() => { const q = document.getElementById('video-chinh').getVideoPlaybackQuality(); return [q.totalVideoFrames, q.droppedVideoFrames] })()`)
  const xem = await demTrong(() => nghi(10000))
  const q1 = await chay(`(() => { const v = document.getElementById('video-chinh'); const q = v.getVideoPlaybackQuality();
    return [q.totalVideoFrames, q.droppedVideoFrames, v.videoWidth + 'x' + v.videoHeight, v.buffered.length ? Math.round(v.buffered.end(v.buffered.length - 1) - v.currentTime) : 0] })()`)
  bc.buoc.dangXem = { ...xem, khungVideo: q1[0] - q0[0], rot: q1[1] - q0[1], coPhim: q1[2], demTruocGiay: q1[3] }
  dong(`   10 giây xem: video ${q1[2]}, ${q1[0] - q0[0]} khung, rớt ${q1[1] - q0[1]} | đệm trước ${q1[3]} giây | giao diện: fps ${xem.fps}, giật ${xem.giat}`)
  // Tốc độ tải từng đoạn video qua máy chủ phim (/api/tep) — phim khựng vì mạng hay vì máy
  const doan = await chay(`(() => performance.getEntriesByType('resource')
    .filter((r) => r.name.includes('/api/tep?u=') && !/m3u8/i.test(decodeURIComponent(r.name)))
    .map((r) => ({ kb: Math.round((r.encodedBodySize || r.transferSize || 0) / 1024), ms: Math.round(r.duration),
      u: decodeURIComponent(r.name.split('u=')[1] || '') })))()`)
  const coSo = doan.filter((d) => d.kb > 50)
  if (coSo.length) {
    const kb = coSo.reduce((a, d) => a + d.kb, 0), ms = coSo.reduce((a, d) => a + d.ms, 0)
    bc.buoc.doanVideo = { so: coSo.length, kbTB: Math.round(kb / coSo.length), kbs: Math.round(kb / (ms / 1000)), url: coSo.slice(-3).map((d) => d.u) }
    dong(`   đoạn video: ${coSo.length} đoạn, TB ${bc.buoc.doanVideo.kbTB} KB/đoạn, tải ${bc.buoc.doanVideo.kbs} KB/s (một luồng qua máy chủ phim)`)
  }

  // 5. Tua tới 10 giây ×3 bằng mũi tên phải
  buocHienTai = 'tua'
  const t0 = await chay(`document.getElementById('video-chinh').currentTime`)
  bd = Date.now()
  for (let i = 0; i < 3; i++) { await bam('ArrowRight'); await nghi(250) }
  const tua = await doiDen(`(() => { const v = document.getElementById('video-chinh'); return v.currentTime > ${t0} + 20 && !v.paused && !v.seeking && v.readyState >= 3 })()`, 30000, 150)
  bc.buoc.tua = { ms: tua != null ? Date.now() - bd : null, nhay: +(await chay(`document.getElementById('video-chinh').currentTime`) - t0).toFixed(0) }
  dong(`5. TUA +30s: chạy lại sau ${bc.buoc.tua.ms ?? 'KHÔNG (30 giây)'}${bc.buoc.tua.ms != null ? ' ms' : ''} (nhảy ${bc.buoc.tua.nhay}s)`)

  // 6. Dừng / phát bằng OK
  buocHienTai = 'dung-phat'
  await bam('Enter')
  const dung = await doiDen(`document.getElementById('video-chinh').paused`, 5000, 50)
  await nghi(800)
  await bam('Enter')
  const tiep = await doiDen(`(() => { const v = document.getElementById('video-chinh'); return !v.paused && v.readyState >= 3 })()`, 8000, 50)
  bc.buoc.dungPhat = { dung, tiep }
  dong(`6. OK dừng: ${dung ?? 'KHÔNG'}${dung != null ? ' ms' : ''} | OK phát tiếp: ${tiep ?? 'KHÔNG'}${tiep != null ? ' ms' : ''}`)
}

// ---------- 7. Quay về trang chủ (như nút Back: app gửi Escape cho trang trước) ----------
buocHienTai = 've-trang-chu'
bd = Date.now()
// Lùi tối đa 2 bước (trang xem → hộp thoại phim → trang chủ), không lùi quá ra ngoài app
for (let i = 0; i < 2 && (await chay(`location.origin + location.pathname`)) !== GOC + '/'; i++) {
  await chay(`(() => { history.back(); return true })()`)
  await nghi(600)
}
const ve = await doiDen(`location.pathname === '/' && document.querySelectorAll('.hang-phim a[href^="/phim/"]').length > 5`, 20000)
bc.buoc.ve = { ms: ve }
dong(`7. VỀ TRANG CHỦ: ${ve ?? 'KHÔNG (20 giây)'}${ve != null ? ' ms' : ''}`)

// ---------- 8. Tìm kiếm ----------
buocHienTai = 'tim'
bd = Date.now()
await chay(`(() => { location.assign('${GOC}/tim-kiem?q=' + encodeURIComponent('tình yêu')); return true })()`)
await nghi(300)
const tim = await doiDen(`location.pathname === '/tim-kiem' && document.readyState === 'complete' && document.querySelectorAll('a[href^="/phim/"]').length > 0`, 25000)
bc.buoc.tim = { ms: tim, ketQua: await chay(`document.querySelectorAll('a[href^="/phim/"]').length`) }
dong(`8. TÌM "tình yêu": ${tim ?? 'KHÔNG RA (25 giây)'}${tim != null ? ' ms' : ''}, ${bc.buoc.tim.ketQua} kết quả`)

// về lại trang chủ cho bố
await chay(`(() => { location.assign('${GOC}/'); return true })()`)
await nghi(1500)
bc.boNhoJS = Math.round((await metric()).JSHeapUsedSize / 1048576)

// ---------- lỗi ----------
dong('')
dong(`LỖI JS/console: ${bc.loi.length} | LỖI MẠNG: ${bc.mang.length}`)
const gon = (ds) => { const m = new Map(); for (const x of ds) { const k = JSON.stringify(x); m.set(k, (m.get(k) || 0) + 1) } return [...m] }
for (const [k, n] of gon(bc.loi).slice(0, 6)) { const x = JSON.parse(k); dong(`   [${x.buoc}] ${x.loai}: ${x.noi}${n > 1 ? ` (×${n})` : ''}`) }
for (const [k, n] of gon(bc.mang).slice(0, 8)) { const x = JSON.parse(k); dong(`   [${x.buoc}] ${x.ma} ${x.url}${n > 1 ? ` (×${n})` : ''}`) }
dong(`Bộ nhớ JS trang: ${bc.boNhoJS} MB`)
writeFileSync(process.env.HOME + '/bao-cao-app.json', JSON.stringify(bc, null, 1))
ws.close()
