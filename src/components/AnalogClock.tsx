interface AnalogClockProps {
  hour: number
  minute: number
}

export function AnalogClock({ hour, minute }: AnalogClockProps) {
  const minuteAngle = minute * 6
  const hourAngle = ((hour % 12) + minute / 60) * 30

  return (
    <svg
      className="analog-clock"
      viewBox="0 0 220 220"
      role="img"
      aria-label="アナログ時計の図"
    >
      <circle className="analog-clock__glow" cx="110" cy="110" r="96" />
      <circle className="analog-clock__face" cx="110" cy="110" r="88" />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30 * Math.PI / 180
        const x1 = 110 + Math.sin(angle) * 72
        const y1 = 110 - Math.cos(angle) * 72
        const x2 = 110 + Math.sin(angle) * 80
        const y2 = 110 - Math.cos(angle) * 80
        return <line key={index} className="analog-clock__tick" x1={x1} y1={y1} x2={x2} y2={y2} />
      })}
      <text x="110" y="43">12</text>
      <text x="177" y="117">3</text>
      <text x="110" y="184">6</text>
      <text x="43" y="117">9</text>
      <line className="analog-clock__hand analog-clock__hand--hour" x1="110" y1="110" x2="110" y2="64" transform={`rotate(${hourAngle} 110 110)`} />
      <line className="analog-clock__hand analog-clock__hand--minute" x1="110" y1="110" x2="110" y2="43" transform={`rotate(${minuteAngle} 110 110)`} />
      <circle className="analog-clock__pin" cx="110" cy="110" r="6" />
    </svg>
  )
}
