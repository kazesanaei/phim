/** Chuyển đổi và tinh chỉnh phụ đề. Trình duyệt chỉ đọc WebVTT, không đọc SRT. */

const MOC = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/g

function hai(n: number) {
  return String(n).padStart(2, '0')
}

function dinhDang(giay: number): string {
  const g = Math.max(0, giay)
  const gio = Math.floor(g / 3600)
  const phut = Math.floor((g % 3600) / 60)
  const giay2 = Math.floor(g % 60)
  const ms = Math.round((g - Math.floor(g)) * 1000)
  return hai(gio) + ':' + hai(phut) + ':' + hai(giay2) + '.' + String(ms).padStart(3, '0')
}

/** SRT sang VTT: đổi dấu phẩy thành chấm ở mốc thời gian, thêm đầu đề WEBVTT. */
export function srtSangVtt(noiDung: string): string {
  const s = noiDung
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(MOC, (_m, h, p, g, ms) => `${hai(+h)}:${p}:${g}.${ms.padEnd(3, '0')}`)
  return s.trimStart().startsWith('WEBVTT') ? s : 'WEBVTT\n\n' + s
}

/** Dời toàn bộ mốc thời gian đi `buGiay` giây (âm là sớm hơn). */
export function doiThoiGian(vtt: string, buGiay: number): string {
  if (!buGiay) return vtt
  return vtt.replace(MOC, (_m, h, p, g, ms) => {
    const goc = +h * 3600 + +p * 60 + +g + +String(ms).padEnd(3, '0') / 1000
    return dinhDang(goc + buGiay)
  })
}

/** Nhãn dễ đọc cho mã ngôn ngữ. */
const TEN_NGON_NGU: Record<string, string> = {
  vie: 'Tiếng Việt',
  vi: 'Tiếng Việt',
  eng: 'English',
  en: 'English',
  jpn: 'Nihongo',
  ja: 'Nihongo',
  kor: 'Hangugeo',
  ko: 'Hangugeo',
  chi: 'Zhongwen',
  zh: 'Zhongwen',
  tha: 'Thai',
  fra: 'Francais',
  spa: 'Espanol',
}

export function nhanNgonNgu(ma: string | undefined, duPhong = 'Phụ đề'): string {
  if (!ma) return duPhong
  const k = ma.toLowerCase()
  return TEN_NGON_NGU[k] || ma.toUpperCase()
}
