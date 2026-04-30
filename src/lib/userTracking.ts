// Continuous user tracking: position from watchPosition + heading from
// DeviceOrientation. Two callable lifecycles — start and stop — so the caller
// can control when to start watching (e.g., on first Locate Me tap so the
// iOS permission prompt happens during a user gesture).

export type UserPosition = {
  lat: number;
  lng: number;
  accuracy: number;
};

export function watchUserPosition(
  onUpdate: (p: UserPosition) => void,
  onError?: (err: GeolocationPositionError) => void
): () => void {
  if (!("geolocation" in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => onError?.(err),
    {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 30_000,
    }
  );
  return () => navigator.geolocation.clearWatch(id);
}

// iOS Safari requires DeviceOrientationEvent.requestPermission() to be
// invoked from a user gesture. Other browsers don't need it. Returns true
// if the listener can be attached.
export async function requestOrientationPermission(): Promise<boolean> {
  const DOE = (window as unknown as {
    DeviceOrientationEvent?: {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
  }).DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    try {
      const result = await DOE.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

// Heading in degrees (0 = North, 90 = East). Null when the device can't
// tell us, e.g., a desktop without orientation sensors.
export function watchHeading(
  onUpdate: (heading: number | null) => void
): () => void {
  let lastEmit = 0;
  const handler = (e: DeviceOrientationEvent) => {
    // Throttle to ~10 Hz; the sensor fires much faster than the map needs.
    const now = performance.now();
    if (now - lastEmit < 100) return;
    lastEmit = now;

    const ev = e as DeviceOrientationEvent & {
      webkitCompassHeading?: number;
      absolute?: boolean;
    };

    let heading: number | null = null;

    if (typeof ev.webkitCompassHeading === "number") {
      // iOS: 0 = North, increases clockwise. Already in our convention.
      heading = ev.webkitCompassHeading;
    } else if (ev.absolute && typeof ev.alpha === "number") {
      // Android (deviceorientationabsolute): alpha is 0 when facing North,
      // increases counter-clockwise. Convert to clockwise-from-North.
      heading = (360 - ev.alpha) % 360;
    } else if (typeof ev.alpha === "number") {
      // Best-effort fallback.
      heading = (360 - ev.alpha) % 360;
    }

    onUpdate(heading);
  };

  // Prefer the absolute event when the device supports it.
  window.addEventListener(
    "deviceorientationabsolute",
    handler as EventListener,
    { passive: true } as AddEventListenerOptions
  );
  window.addEventListener("deviceorientation", handler, {
    passive: true,
  } as AddEventListenerOptions);

  return () => {
    window.removeEventListener(
      "deviceorientationabsolute",
      handler as EventListener
    );
    window.removeEventListener("deviceorientation", handler);
  };
}
