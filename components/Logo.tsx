/** Chữ ký của trang: dải phim đỏ + KHO PHIM. Dùng chung cho đầu trang, ngăn kéo, menu TV. */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`chu-hien-thi inline-flex items-center gap-1.5 text-lg font-black leading-none ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden className="h-[1.15em] w-[1.15em] shrink-0">
        <rect x="2" y="3" width="20" height="18" rx="4" fill="var(--color-nhan)" />
        <path d="M10 8.2v7.6l6-3.8z" fill="#fff" />
      </svg>
      <span className="tracking-[0.06em]">
        KHO<span className="text-[var(--color-nhan)]">PHIM</span>
      </span>
    </span>
  )
}
