const OUT_POS = "data-dragged-out-position";
const OUT_CONTAINER = "data-dragged-out-container";
const INDEX = "data-index";
const DRAGGED = "dragged";
// const GRID_X = "data-grid-x";
// const GRID_Y = "data-grid-y";

export const DFLEX_ATTRIBUTES = Object.freeze({
  DRAGGED,
  // GRID_X,
  // GRID_Y,
  INDEX,
  OUT_POS,
  OUT_CONTAINER,
});

export type AllowedAttributes = keyof typeof DFLEX_ATTRIBUTES;
