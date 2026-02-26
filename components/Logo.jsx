// components/Logo.jsx — identical to original
export default function Logo({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="100" height="100" rx="20" fill="#111111" />
      <rect width="100" height="100" rx="20" fill="none" stroke="#2c2c2c" strokeWidth="2" />
      <rect x="16" y="76" width="68" height="3.5" rx="1.75" fill="#ff1e00" />
      <text x="50" y="68" fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif" fontSize="35" fontWeight="900" textAnchor="middle" letterSpacing="-1.5">
        <tspan fill="#ffffff">R</tspan>
        <tspan fill="#ff1e00">Y</tspan>
        <tspan fill="#ffffff">R</tspan>
      </text>
    </svg>
  )
}
