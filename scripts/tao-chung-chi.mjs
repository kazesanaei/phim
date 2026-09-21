/**
 * Sinh chứng chỉ cho chế độ LAN: một CA riêng + chứng chỉ máy chủ do CA đó ký.
 *
 * VÌ SAO CẦN HTTPS: trình duyệt trên TV Box tự nâng địa chỉ gõ vào thành
 * `https://` và không tắt được, nên server phải nói được HTTPS. Đã thấy thật:
 * ERR_SSL_PROTOCOL_ERROR trên Xiaomi Box.
 *
 * VÌ SAO PHẢI CÓ CA RIÊNG THAY VÌ MỖI CHỨNG CHỈ TỰ KÝ:
 *   1. Android chỉ cho cài vào kho tin cậy thứ có `CA:true`. Chứng chỉ lá tự ký
 *      bị từ chối ngay, nên không có cách nào tắt cảnh báo.
 *   2. Router cấp IP động. Có CA thì IP đổi chỉ phải ký lại chứng chỉ lá —
 *      CA trên Box vẫn nguyên, không phải cài lại, không hiện cảnh báo mới.
 *
 * KHOÁ CA LÀ THỨ NHẠY CẢM: máy nào đã cài CA này thì mọi chứng chỉ do nó ký đều
 * được tin. Nên CA bị ràng bằng nameConstraints, chỉ ký được cho dải IP nội bộ
 * và `localhost` — lọt ra ngoài cũng không giả được trang nào trên Internet.
 * Cả hai khoá nằm trong `du-lieu/` (đã gitignore, và `*.pem` cũng gitignore).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { networkInterfaces, tmpdir } from 'node:os'
import path from 'node:path'

const THU_MUC = path.join(process.cwd(), 'du-lieu', 'tls')
const CA_KHOA = path.join(THU_MUC, 'ca-key.pem')
export const CA_CHUNG_CHI = path.join(THU_MUC, 'ca-cert.pem')
const KHOA = path.join(THU_MUC, 'key.pem')
const CHUNG_CHI = path.join(THU_MUC, 'cert.pem')

/** openssl đi kèm Git for Windows; không có trên PATH của cmd.exe. */
const NOI_CO_OPENSSL = [
  'openssl',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
]

function timOpenssl() {
  for (const c of NOI_CO_OPENSSL) {
    try {
      execFileSync(c, ['version'], { stdio: 'pipe' })
      return c
    } catch {
      // thử chỗ tiếp theo
    }
  }
  return null
}

export function diaChiLan() {
  return Object.values(networkInterfaces())
    .flatMap((ds) => ds ?? [])
    .filter((m) => m.family === 'IPv4' && !m.internal)
    .map((m) => m.address)
}

function chay(openssl, args) {
  execFileSync(openssl, args, { stdio: 'pipe' })
}

function conHan(openssl, tep, dem = 0) {
  try {
    chay(openssl, ['x509', '-noout', '-checkend', String(dem), '-in', tep])
    return true
  } catch {
    return false
  }
}

/** IP nào đang nằm trong SAN của chứng chỉ máy chủ. */
function sanHienCo(openssl) {
  try {
    const ra = execFileSync(openssl, ['x509', '-noout', '-ext', 'subjectAltName', '-in', CHUNG_CHI], {
      encoding: 'utf8',
    })
    return new Set(ra.match(/IP Address:([0-9.]+)/g)?.map((s) => s.split(':')[1]) ?? [])
  } catch {
    return new Set()
  }
}

function taoCA(openssl) {
  chay(openssl, [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', CA_KHOA, '-out', CA_CHUNG_CHI,
    '-days', '3650',
    '-subj', '/CN=Kho phim - CA noi bo',
    '-addext', 'basicConstraints=critical,CA:true,pathlen:0',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    // Ràng CA lại: chỉ ký được cho mạng nội bộ. Xem chú thích đầu tệp.
    '-addext',
    'nameConstraints=critical,permitted;IP:192.168.0.0/255.255.0.0,permitted;IP:10.0.0.0/255.0.0.0,permitted;IP:172.16.0.0/255.240.0.0,permitted;IP:127.0.0.0/255.0.0.0,permitted;DNS:localhost',
  ])
}

function kyChungChiMay(openssl, ip) {
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...ip.map((x) => 'IP:' + x)].join(',')
  const tam = path.join(tmpdir(), 'phim-csr-' + process.pid)
  mkdirSync(tam, { recursive: true })
  const csr = path.join(tam, 'may.csr')
  const ext = path.join(tam, 'may.ext')

  writeFileSync(
    ext,
    [
      'basicConstraints=critical,CA:false',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      'subjectAltName=' + san,
    ].join('\n') + '\n',
  )

  try {
    chay(openssl, ['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', KHOA, '-out', csr, '-subj', '/CN=Kho phim'])
    chay(openssl, [
      'x509', '-req', '-in', csr,
      '-CA', CA_CHUNG_CHI, '-CAkey', CA_KHOA, '-CAcreateserial',
      '-out', CHUNG_CHI,
      // 825 ngày: mốc trình duyệt còn chịu.
      '-days', '825', '-sha256',
      '-extfile', ext,
    ])
  } finally {
    rmSync(tam, { recursive: true, force: true })
  }
  return san
}

/**
 * Bảo đảm có CA và chứng chỉ máy chủ dùng được cho IP hiện tại.
 * CA chỉ tạo một lần; chứng chỉ máy chủ ký lại khi IP đổi hoặc sắp hết hạn.
 */
export function baoDamChungChi({ im = false } = {}) {
  const openssl = timOpenssl()
  if (!openssl) {
    throw new Error(
      'Không tìm thấy openssl. Nó đi kèm Git for Windows — cài Git rồi chạy lại, hoặc dùng bản HTTP ở cổng 3000.',
    )
  }

  const noi = (t) => !im && console.log(t)
  const ip = diaChiLan()
  mkdirSync(THU_MUC, { recursive: true })

  let caMoi = false
  if (!existsSync(CA_KHOA) || !existsSync(CA_CHUNG_CHI) || !conHan(openssl, CA_CHUNG_CHI)) {
    taoCA(openssl)
    caMoi = true
    noi('  Đã tạo CA nội bộ: ' + CA_CHUNG_CHI)
  }

  // Ký lại trước hạn 30 ngày, đừng đợi chết hẳn giữa lúc đang xem.
  const conDung =
    !caMoi &&
    existsSync(KHOA) &&
    existsSync(CHUNG_CHI) &&
    conHan(openssl, CHUNG_CHI, 30 * 86400) &&
    ip.every((x) => sanHienCo(openssl).has(x))

  if (conDung) {
    noi('  Chứng chỉ còn dùng được cho: ' + [...sanHienCo(openssl)].join(', '))
  } else {
    const san = kyChungChiMay(openssl, ip)
    noi('  Đã ký chứng chỉ máy chủ cho: ' + san)
  }

  return { khoa: KHOA, chungChi: CHUNG_CHI, caChungChi: CA_CHUNG_CHI, ip, caMoi }
}

// Chạy thẳng tệp này thì chỉ tạo rồi in đường dẫn.
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  const kq = baoDamChungChi()
  console.log('  CA (cài lên TV): ' + kq.caChungChi)
  console.log('  chứng chỉ máy:   ' + kq.chungChi)
}
