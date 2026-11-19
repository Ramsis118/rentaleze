import React, { useId } from 'react'

// Rentaleze logo (brand v1.0). Outlined artwork, no font needed.
// variant: 'light' (navy + volt, for white grounds) | 'dark' (chrome + electric, for dark grounds)
// mark: true renders only the R badge (app icon / avatar)
// Size it with a height class, e.g. className="h-8 w-auto"

const R_BOWL = 'M33 26H64a22 22 0 0 1 0 44H49V94H33Z M49 41V55H63a7 7 0 0 0 0-14Z'
const R_LEG = 'M60 70H77L93 94H76Z'
const RENTAL = 'M152.5 83V38.2H172.5Q182.3 38.2 187.6 42.6Q192.9 47.1 192.9 54.8Q192.9 59.8 190.5 63.5Q188 67.2 183.6 69.1Q179.1 71.1 172.9 71.1H159.5L165.2 65.8V83ZM180.2 83 169.1 66.7H182.5L193.8 83ZM165.2 67.2 159.5 61.3H172.2Q176.2 61.3 178.1 59.6Q180.1 57.8 180.1 54.8Q180.1 51.7 178.1 49.9Q176.2 48.2 172.2 48.2H159.5L165.2 42.3ZM203.1 83V38.2H238.1V48H215.6V73.2H239V83ZM214.7 65V55.6H235.5V65ZM249.3 83V38.2H259.7L284.4 68H279.4V38.2H291.9V83H281.4L256.8 53.2H261.7V83ZM313.5 83V48.2H299.8V38.2H340V48.2H326.2V83ZM342.5 83 362.3 38.2H374.8L394.6 83H381.4L365.9 44.4H370.9L355.4 83ZM353.3 74.3 356.6 64.9H378.5L381.7 74.3ZM401.4 83V38.2H414.1V73H435.4V83Z'
const EZE = 'M443.6 83V38.2H478.7V48H456.1V73.2H479.6V83ZM455.3 65V55.6H476.1V65ZM487.6 83V75.1L514 43.8L515.5 48.2H488.2V38.2H526.7V46.1L500.4 77.4L498.8 73H527.7V83ZM536.5 83V38.2H571.6V48H549V73.2H572.4V83ZM548.1 65V55.6H568.9V65Z'

export default function Logo({ variant = 'light', mark = false, className = 'h-8 w-auto', title = 'Rentaleze' }) {
  const id = useId().replace(/:/g, '')
  const dark = variant === 'dark'
  const silver = `url(#rzs${id})`
  const volt = `url(#rzv${id})`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={mark ? '0 0 120 120' : '0 0 583 120'}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`rzs${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset=".45" stopColor="#D3D8E1" />
          <stop offset=".55" stopColor="#AEB6C4" /><stop offset="1" stopColor="#E4E8EE" />
        </linearGradient>
        <linearGradient id={`rzv${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00C8FF" /><stop offset="1" stopColor="#1F5BFF" />
        </linearGradient>
        <linearGradient id={`rzb${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#121C44" /><stop offset="1" stopColor="#070D24" />
        </linearGradient>
        <linearGradient id={`rzr${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00C8FF" stopOpacity=".9" /><stop offset=".5" stopColor="#1F5BFF" stopOpacity=".35" />
          <stop offset="1" stopColor="#C7CCD6" stopOpacity=".6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="116" height="116" rx="30" fill={`url(#rzb${id})`} />
      <rect x="3" y="3" width="114" height="114" rx="29" fill="none" stroke={`url(#rzr${id})`} strokeWidth="2" />
      <path d={R_BOWL} fill={silver} fillRule="evenodd" />
      <path d={R_LEG} fill={volt} />
      {!mark && (
        <>
          <path d={RENTAL} fill={dark ? silver : '#0B1430'} />
          <path d={EZE} fill={dark ? volt : '#1F5BFF'} />
        </>
      )}
    </svg>
  )
}
