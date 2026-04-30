// Get a precise location by *watching* GeolocationPosition until accuracy
// settles, instead of trusting the first `getCurrentPosition` callback.
//
// Why: on iOS Safari, `getCurrentPosition` with `enableHighAccuracy: true`
// often returns a cached, cellular-triangulated fix first (200-1000 m off
// — "the middle of a street the user isn't on"), then the GPS lock
// converges over the next 5-15 seconds. By watching, we ignore the coarse
// readings and resolve once accuracy is good enough — or after a timeout,
// returning whatever was the best fix seen.

export type PreciseLocateOptions = {
  // Resolve as soon as a reading at or below this accuracy (meters) arrives.
  targetAccuracy?: number;
  // Hard upper bound (ms). After this, resolve with best-so-far if we have
  // one; otherwise reject.
  maxWait?: number;
  // Called for every reading the watcher produces; useful for surfacing
  // "still searching, current ±X m" UI.
  onUpdate?: (pos: GeolocationPosition) => void;
};

export function preciseLocate(
  opts: PreciseLocateOptions = {}
): Promise<GeolocationPosition> {
  const { targetAccuracy = 20, maxWait = 12_000, onUpdate } = opts;

  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }

    let best: GeolocationPosition | null = null;
    let settled = false;

    const finishWith = (
      result:
        | { ok: true; pos: GeolocationPosition }
        | { ok: false; err: Error }
    ) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (result.ok) resolve(result.pos);
      else reject(result.err);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onUpdate?.(pos);
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
        }
        if (pos.coords.accuracy <= targetAccuracy) {
          finishWith({ ok: true, pos });
        }
      },
      (err) => {
        // If we already have a usable best-so-far, prefer that over rejecting.
        if (best) {
          finishWith({ ok: true, pos: best });
        } else {
          finishWith({ ok: false, err: new Error(err.message) });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0, // refuse cached fixes — the whole point of this helper
        timeout: maxWait,
      }
    );

    const timer = setTimeout(() => {
      if (best) {
        finishWith({ ok: true, pos: best });
      } else {
        finishWith({
          ok: false,
          err: new Error(
            "Could not get a precise location in time. Step outside, then try again."
          ),
        });
      }
    }, maxWait);
  });
}
