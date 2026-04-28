// Static crosshair overlay at the geometric center of the map. Tells the
// user exactly where the next pin will drop. Pointer-events disabled so
// the user can pan/zoom the map normally.
export default function Crosshair() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-[800] -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer dark stroke for legibility against bright satellite imagery */}
        <g stroke="rgba(0,0,0,0.55)" strokeWidth="4" strokeLinecap="round">
          <line x1="28" y1="6" x2="28" y2="20" />
          <line x1="28" y1="36" x2="28" y2="50" />
          <line x1="6" y1="28" x2="20" y2="28" />
          <line x1="36" y1="28" x2="50" y2="28" />
        </g>
        {/* Inner white stroke */}
        <g stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
          <line x1="28" y1="6" x2="28" y2="20" />
          <line x1="28" y1="36" x2="28" y2="50" />
          <line x1="6" y1="28" x2="20" y2="28" />
          <line x1="36" y1="28" x2="50" y2="28" />
        </g>
        {/* Center dot */}
        <circle cx="28" cy="28" r="4" fill="#FFFFFF" />
        <circle cx="28" cy="28" r="2" fill="#0A0A0A" />
      </svg>
    </div>
  );
}
