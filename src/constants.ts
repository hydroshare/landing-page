export const APP_NAME = import.meta.env.VITE_APP_NAME || "";
export const APP_URL = import.meta.env.VITE_APP_URL || "";
export const LOGIN_URL = import.meta.env.VITE_APP_LOGIN_URL || "";
export const CLIENT_ID = import.meta.env.VITE_APP_CLIENT_ID || "";
export const COMPANION_URL = import.meta.env.VITE_APP_COMPANION_URL || "http://localhost/companion";
export const GOOGLE_PICKER_CLIENT_ID = import.meta.env.VITE_APP_GOOGLE_PICKER_CLIENT_ID || "737951655407-p3d2b2bl2ln90g5plfj09e98bprk42da.apps.googleusercontent.com";
export const GOOGLE_PICKER_API_KEY = import.meta.env.VITE_APP_GOOGLE_PICKER_API_KEY || "AIzaSyDEavRDQj6aB38b7RVL5qX1tEJPDuKH4Rc";
export const GOOGLE_PICKER_APP_ID = import.meta.env.VITE_APP_GOOGLE_PICKER_APP_ID || "737951655407";
export const SUPPORT_EMAIL = import.meta.env.VITE_APP_SUPPORT_EMAIL || "";
export const DEFAULT_TOAST_DURATION = 3500;

export const sameRouteNavigationErrorHandler = (e) => {
  // Ignore the vuex err regarding  navigating to the page they are already on.
  if (
    e.name !== "NavigationDuplicated" &&
    !e.message.includes("Avoided redundant navigation to current location")
  ) {
    // But print any other errors to the console
    console.error(e);
  }
};

export const MAX_YEAR = new Date().getFullYear();
export const MIN_YEAR = 1900;
export const API_BASE = import.meta.env.VITE_APP_API_URL || "";
export const ENDPOINTS: { [key: string]: string } = {
  // submit: `${API_BASE}/catalog/dataset`,
  // register: `${API_BASE}/catalog/repository/hydroshare`,
  // refresh: `${API_BASE}/catalog/repository/hydroshare`,
  // deleteSubmission: `${API_BASE}/catalog/dataset`,
  // submissions: `${API_BASE}/catalog/submission`,
  // dataset: `${API_BASE}/catalog/dataset`,
  // schemaUrl: `${API_BASE}/schemas/schema.json`,
  // uiSchemaUrl: `${API_BASE}/schemas/ui-schema.json`,
  // schemaDefaultsUrl: `${API_BASE}/schemas/schema-defaults.json`,
  // api: `${API_BASE}`,
  // logout: `${API_BASE}/logout`,
};
export const INITIAL_RANGE: [number, number] = [MIN_YEAR, MAX_YEAR];

export const contentTypeLogos: { [key: string]: string } = {
  CompositeResource: new URL("/img/composite48x48.png", import.meta.url).href,
  CollectionResource: new URL("/img/collection48x48.png", import.meta.url).href,
  GeographicRasterAggregation: new URL(
    "/img/geographicraster48x48.png",
    import.meta.url,
  ).href,
  TimeSeriesAggregation: new URL("/img/timeseries48x48.png", import.meta.url)
    .href,
  GeographicFeatureAggregation: new URL(
    "/img/geographicfeature48x48.png",
    import.meta.url,
  ).href,
  MultidimensionalAggregation: new URL(
    "/img/multidimensional48x48.png",
    import.meta.url,
  ).href,
};

export const sharingStatusIcons: { [key: string]: string } = {
  PUBLIC: new URL("/img/public.png", import.meta.url).href,
  PRIVATE: new URL("/img/private.png", import.meta.url).href,
  DISCOVERABLE: new URL("/img/discoverable.png", import.meta.url).href,
  PUBLISHED: new URL("/img/published.png", import.meta.url).href,
  SPATIAL: new URL("/img/Globe-Green.png", import.meta.url).href,
};

export const contentTypeLabels: { [key: string]: string } = {
  CompositeResource: "Composite Resource",
  CollectionResource: "Collection",
  TimeSeriesAggregation: "Time Series",
  "CSV Data": "CSV Data",
  Document: "Document",
  "File Set": "File Set",
  "Generic Data": "Generic Data",
  GeographicFeatureAggregation: "Geographic Feature (ESRI Shapefiles)",
  GeographicRasterAggregation: "Geographic Raster",
  MultidimensionalAggregation: "Multidimensional (NetCDF)",
  Image: "Image",
};