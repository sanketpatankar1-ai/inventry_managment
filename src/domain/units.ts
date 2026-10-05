import { Product } from './types';

export interface DisplayQuantity {
  boxes: number;
  strips: number;
  pieces: number;
}

/**
 * WHAT: Converts a total number of pieces into boxes, strips, and remaining pieces.
 * WHY: Users think in boxes and strips, but we store in pieces to avoid float math.
 * TIME COMPLEXITY: O(1) - simple arithmetic.
 */
export function piecesToDisplay(pieces: number, product: Product): DisplayQuantity {
  const boxes = Math.floor(pieces / product.piecesPerBox);
  const remainingAfterBoxes = pieces % product.piecesPerBox;
  
  const strips = Math.floor(remainingAfterBoxes / product.unitsPerStrip);
  const remainingPieces = remainingAfterBoxes % product.unitsPerStrip;

  return { boxes, strips, pieces: remainingPieces };
}

/**
 * WHAT: Formats a quantity as a human-readable string (e.g. "2 Boxes 3 Strips").
 * WHY: UI needs to show friendly text. Omits zero values for brevity.
 * TIME COMPLEXITY: O(1)
 */
export function formatQuantity(pieces: number, product: Product): string {
  if (pieces === 0) return '0 Pieces';
  
  const { boxes, strips, pieces: p } = piecesToDisplay(pieces, product);
  const parts = [];
  
  if (boxes > 0) parts.push(`${boxes} Box${boxes > 1 ? 'es' : ''}`);
  if (strips > 0) parts.push(`${strips} Strip${strips > 1 ? 's' : ''}`);
  if (p > 0) parts.push(`${p} Piece${p > 1 ? 's' : ''}`);
  
  return parts.join(' ');
}

/**
 * WHAT: Converts UI input of boxes, strips, and pieces back into a single total of pieces.
 * WHY: We need to store everything in the smallest unit (pieces).
 * TIME COMPLEXITY: O(1)
 */
export function displayToPieces(display: DisplayQuantity, product: Product): number {
  return (display.boxes * product.piecesPerBox) + (display.strips * product.unitsPerStrip) + display.pieces;
}
