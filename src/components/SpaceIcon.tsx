import { useId } from 'react'

interface SpaceIconProps {
  variant?: number
  className?: string
}

export function SpaceIcon({ variant = 0, className = '' }: SpaceIconProps) {
  const kind = Math.abs(variant) % 4
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      {kind === 0 && (
        <>
          <ellipse cx="32" cy="34" rx="25" ry="9" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="32" cy="30" r="15" fill="currentColor" opacity=".88" />
          <circle cx="26" cy="25" r="4" fill="#fff3aa" opacity=".8" />
        </>
      )}
      {kind === 1 && (
        <>
          <path d="M34 8c11 8 15 20 10 33L31 54 18 41C18 27 23 15 34 8Z" fill="currentColor" />
          <circle cx="32" cy="28" r="7" fill="#081634" stroke="#bdf7ff" strokeWidth="3" />
          <path d="m20 39-8 8 11 1m19-9 8 8-11 1" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="m28 52 4 8 4-8" fill="#ffe57d" />
        </>
      )}
      {kind === 2 && (
        <path d="m32 7 7 16 18 2-13 12 4 18-16-9-16 9 4-18L7 25l18-2 7-16Z" fill="currentColor" />
      )}
      {kind === 3 && (
        <>
          <path d="M42 10a22 22 0 1 0 12 36A24 24 0 0 1 42 10Z" fill="currentColor" />
          <circle cx="49" cy="17" r="3" fill="#ffe57d" />
        </>
      )}
    </svg>
  )
}

export function RocketIcon({ className = '' }: { className?: string }) {
  const gradientId = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f8fbff" />
          <stop offset=".58" stopColor="#bdeeff" />
          <stop offset="1" stopColor="#8fa6ff" />
        </linearGradient>
      </defs>
      <path d="M67 10c24 14 32 40 20 68L60 98 33 77C27 50 38 24 67 10Z" fill={`url(#${gradientId})`} stroke="#7ae8ff" strokeWidth="4" />
      <path d="M67 10c10 7 17 15 21 25l-40 2c5-11 11-20 19-27Z" fill="#9b78ff" opacity=".88" />
      <circle cx="65" cy="52" r="14" fill="#14285e" stroke="#d2fbff" strokeWidth="4" />
      <circle cx="62" cy="49" r="7" fill="#46dfff" opacity=".92" />
      <path d="m36 67-21 18 25 2m46-21 19 19-24 3" fill="#a36fff" stroke="#ddc5ff" strokeWidth="4" strokeLinejoin="round" />
      <path d="m47 93 12 22 12-22" fill="#ffda61" />
      <path d="m52 94 7 15 7-15" fill="#ff8ed8" />
      <path d="M18 96c10 0 17 3 24 8" fill="none" stroke="#63e6ff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </svg>
  )
}

export function SpaceRobot({ className = '' }: { className?: string }) {
  const faceId = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id={faceId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#9ccfff" />
        </linearGradient>
      </defs>
      <path d="M64 18v-8" stroke="#79eaff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="64" cy="8" r="5" fill="#ffe57c" />
      <rect x="24" y="20" width="80" height="68" rx="30" fill={`url(#${faceId})`} stroke="#78dcff" strokeWidth="4" />
      <rect x="34" y="31" width="60" height="43" rx="18" fill="#091a47" />
      <ellipse cx="51" cy="52" rx="5" ry="9" fill="#64efff" />
      <ellipse cx="77" cy="52" rx="5" ry="9" fill="#64efff" />
      <path d="M56 65c5 3 11 3 16 0" fill="none" stroke="#9ff5ff" strokeWidth="3" strokeLinecap="round" />
      <path d="M36 89 26 112m66-23 10 23M49 88l-6 26m36-26 6 26" fill="none" stroke="#8b9dff" strokeWidth="9" strokeLinecap="round" />
      <rect x="45" y="80" width="38" height="28" rx="12" fill="#e7f7ff" stroke="#78dcff" strokeWidth="4" />
      <circle cx="64" cy="94" r="6" fill="#7d65ff" />
    </svg>
  )
}

export function TownItemIcon({ itemId }: { itemId: string }) {
  const common = <path d="M7 60h58" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".35" />
  return (
    <svg viewBox="0 0 72 72" aria-hidden="true">
      {common}
      {itemId === 'tree' && <><path d="M36 57V35" stroke="#ad7a65" strokeWidth="6" /><circle cx="36" cy="28" r="16" fill="#56dcb5" /><circle cx="27" cy="30" r="9" fill="#61efca" /><circle cx="44" cy="20" r="8" fill="#99f3d8" /></>}
      {itemId === 'flowers' && <><path d="M22 57V40m15 17V35m14 22V43" stroke="#5dd7a7" strokeWidth="3" /><circle cx="22" cy="37" r="7" fill="#ff8ed8" /><circle cx="37" cy="31" r="8" fill="#ffe472" /><circle cx="51" cy="40" r="7" fill="#86eaff" /></>}
      {itemId === 'bench' && <><path d="M17 35h39v10H17zM21 47v11m31-11v11M19 29h35" fill="#ffc674" stroke="#8766d7" strokeWidth="4" strokeLinejoin="round" /></>}
      {itemId === 'small-house' && <><path d="M13 56v-9a23 23 0 0 1 46 0v9Z" fill="#3c76c9" stroke="#7eeaff" strokeWidth="3" /><path d="M20 44a16 16 0 0 1 32 0" fill="#91d8ff" opacity=".7" /><rect x="31" y="42" width="12" height="14" rx="5" fill="#ffe27a" /><path d="M36 21v-8" stroke="#ffe27a" strokeWidth="3" /><circle cx="36" cy="11" r="4" fill="#ff9ed7" /></>}
      {itemId === 'shop' && <><path d="M14 32h44v26H14z" fill="#4a65c6" stroke="#7eeaff" strokeWidth="3" /><path d="M11 29h50l-5-10H16Z" fill="#b66cff" stroke="#f5b0ff" strokeWidth="3" /><path d="M18 32v7m12-7v7m12-7v7m12-7v7" stroke="#ffe27a" strokeWidth="4" /><rect x="29" y="44" width="14" height="14" fill="#ffe27a" /></>}
      {itemId === 'park' && <><ellipse cx="36" cy="53" rx="27" ry="9" fill="#406d9c" /><ellipse cx="36" cy="48" rx="24" ry="8" fill="#55d4a8" /><circle cx="23" cy="41" r="8" fill="#7ce9ca" /><circle cx="47" cy="39" r="10" fill="#78e2b4" /><path d="M36 49V30" stroke="#ffe27a" strokeWidth="3" /><circle cx="36" cy="27" r="5" fill="#ff90d8" /></>}
      {itemId === 'streetlight' && <><path d="M36 57V24" stroke="#91b4ff" strokeWidth="5" /><path d="M25 27h22l-5-12H30Z" fill="#ffe27a" stroke="#7eeaff" strokeWidth="3" /><circle cx="36" cy="20" r="5" fill="#fff4ae" /></>}
      {itemId === 'big-tree' && <><path d="M36 59V30" stroke="#a87b6f" strokeWidth="7" /><circle cx="36" cy="25" r="20" fill="#46c7a5" /><circle cx="24" cy="28" r="11" fill="#7ae8c8" /><circle cx="49" cy="22" r="12" fill="#8ff1d4" /><circle cx="36" cy="15" r="7" fill="#ffe27a" /></>}
      {itemId === 'second-house' && <><path d="M8 57v-8a28 28 0 0 1 56 0v8Z" fill="#4058bd" stroke="#8aeaff" strokeWidth="3" /><path d="M16 46a20 20 0 0 1 40 0" fill="#8d7dff" opacity=".72" /><circle cx="25" cy="45" r="5" fill="#ffe27a" /><circle cx="47" cy="45" r="5" fill="#ffe27a" /><rect x="31" y="45" width="10" height="12" rx="4" fill="#75ebff" /></>}
    </svg>
  )
}
