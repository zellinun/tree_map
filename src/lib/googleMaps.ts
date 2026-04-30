// Shared Google Maps loader options. useJsApiLoader is idempotent only when
// every call site passes the *same* config — most importantly, the same
// libraries array reference. Defining it once here keeps MapView and
// AddressSearch in sync without each importing the other.

import type { Libraries } from "@react-google-maps/api";

export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
