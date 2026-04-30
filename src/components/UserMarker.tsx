import { OverlayView } from "@react-google-maps/api";

type Props = {
  lat: number;
  lng: number;
  // Heading clockwise from North in degrees. Null = no orientation sensor;
  // we render a static dot without the directional cone.
  heading: number | null;
};

// "You are here" indicator: blue dot, white ring, optional directional
// cone that rotates with the device's compass heading.
export default function UserMarker({ lat, lng, heading }: Props) {
  return (
    <OverlayView
      position={{ lat, lng }}
      mapPaneName={OverlayView.OVERLAY_LAYER}
    >
      <div
        style={{
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 36,
            height: 36,
          }}
        >
          {/* Soft accuracy halo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background: "rgba(37, 99, 235, 0.18)",
            }}
          />
          {/* Directional cone rotates with the device heading */}
          {heading !== null ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `rotate(${heading}deg)`,
                transformOrigin: "50% 50%",
                transition: "transform 80ms linear",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                style={{ display: "block" }}
              >
                <defs>
                  <linearGradient id="user-cone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M18 4 L26 18 L18 14 L10 18 Z"
                  fill="url(#user-cone)"
                />
              </svg>
            </div>
          ) : null}
          {/* Center dot */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 14,
              height: 14,
              borderRadius: "9999px",
              background: "#2563EB",
              border: "2px solid #FFFFFF",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.35)",
            }}
          />
        </div>
      </div>
    </OverlayView>
  );
}
