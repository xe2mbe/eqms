/** Fondo decorativo de ondas de radio (SVG) usado en el HERO de PublicFMRE. */
export default function RadioWavesBg() {
  return (
    <svg width="420" height="420" viewBox="0 0 420 420" fill="none" style={{ opacity: 0.09 }}>
      <defs>
        <clipPath id="rwclip">
          <rect width="420" height="420" />
        </clipPath>
      </defs>
      <g clipPath="url(#rwclip)">
        {[48, 88, 130, 172, 214, 256, 298, 340, 382].map((r, i) => (
          <circle key={i} cx="420" cy="210" r={r} stroke="white" strokeWidth="1.6" fill="none" />
        ))}
        <circle cx="420" cy="210" r="8" fill="white" opacity="0.5" />
        <circle cx="420" cy="210" r="3" fill="white" />
      </g>
    </svg>
  )
}
