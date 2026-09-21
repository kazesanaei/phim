'use client'

/**
 * Chọn chế độ hiển thị: hai nút rời PC và TV, cái đang dùng tô đỏ.
 *
 * VÌ SAO HAI NÚT CHỨ KHÔNG PHẢI MỘT NÚT GẠT: một nút gạt buộc người ta đọc chữ
 * mới biết đang ở đâu ("Chế độ TV" là đang ở TV, hay bấm để sang TV?). Hai nút
 * thì nhìn phát biết, và đổi chỉ mất một lần bấm — quan trọng khi phải lê con
 * trỏ ảo bằng remote.
 *
 * Lựa chọn nhớ theo TỪNG MÁY (localStorage + cookie), không nằm trong cơ sở dữ
 * liệu: laptop và Xiaomi Box dùng chung một máy chủ, nếu để trong DB thì bật TV
 * ở Box sẽ làm phóng to luôn màn hình laptop.
 */
import { useEffect, useState } from 'react'
import { datCheDo, docCheDo, type CheDo } from '@/lib/che-do'

function Man({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M3 4h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v10h16V6H4zm3 14h10v2H7v-2z"
      />
    </svg>
  )
}

function May({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" d="M4 5h16a1 1 0 0 1 1 1v9h-2V7H5v8H3V6a1 1 0 0 1 1-1zM2 17h20v2H2v-2z" />
    </svg>
  )
}

export default function NutCheDo({ dayDu = false }: { dayDu?: boolean }) {
  // Dựng ra 'pc' trước cho khớp máy chủ, rồi mới đọc giá trị thật — tránh vênh HTML.
  const [cd, datCd] = useState<CheDo>('pc')
  const [xong, datXong] = useState(false)

  useEffect(() => {
    datCd(docCheDo())
    datXong(true)
  }, [])

  function doi(moi: CheDo) {
    if (moi === cd) return
    datCheDo(moi)
    datCd(moi)
  }

  const chung =
    'flex items-center gap-1.5 border px-2.5 py-1.5 text-xs transition sm:px-3 focus-visible:ring-2 focus-visible:ring-white'

  function nut(ma: CheDo, nhan: string, Icon: typeof Man, bo: string) {
    const dang = xong && cd === ma
    return (
      <button
        type="button"
        onClick={() => doi(ma)}
        aria-pressed={dang}
        title={dang ? `Đang ở chế độ ${nhan}` : `Chuyển sang chế độ ${nhan}`}
        className={`${chung} ${bo} ${
          dang
            ? 'border-[var(--color-nhan)] bg-[var(--color-nhan)]/15 font-semibold text-white'
            : 'border-[var(--color-vien)] text-white/55 hover:border-white/40 hover:text-white'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className={dayDu ? '' : 'hidden sm:inline'}>{nhan}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center" role="group" aria-label="Chế độ hiển thị">
      {/* Bỏ viền giữa để hai nút dính thành một cụm, nhìn ra ngay là một lựa chọn hai đường */}
      {nut('pc', 'PC', May, 'rounded-l -mr-px')}
      {nut('tv', 'TV', Man, 'rounded-r')}
    </div>
  )
}
