export type LabelAlign = 'left' | 'center' | 'right';
export type LabelVerticalAlign = 'top' | 'middle' | 'bottom';

export interface LabelPlacement {
  col: number;
  row: number;
  text: string;
}

// Horizontal padding (in cells) reserved on each side when a label is not
// centered. Matches the historical `width - 4` budget of centered labels.
const PADDING = 2;

// Compute where a label should be drawn inside a box/component, given its
// horizontal and vertical alignment. Defaults (center/middle) reproduce the
// legacy centered placement so objects without an explicit labelPosition keep
// their previous appearance.
//
// Pure function: no grid mutation, fully unit-testable.
export function computeLabelPlacement(
  col: number,
  row: number,
  width: number,
  height: number,
  text: string,
  align: LabelAlign = 'center',
  verticalAlign: LabelVerticalAlign = 'middle',
): LabelPlacement {
  const maxLen = Math.max(0, width - PADDING * 2);
  const displayText = text.length > maxLen ? text.slice(0, Math.max(0, maxLen - 1)) + '…' : text;

  let startCol: number;
  switch (align) {
    case 'left':
      startCol = col + PADDING;
      break;
    case 'right':
      startCol = col + width - PADDING - displayText.length;
      break;
    case 'center':
    default:
      startCol = col + Math.floor((width - displayText.length) / 2);
      break;
  }

  let startRow: number;
  switch (verticalAlign) {
    case 'top':
      startRow = row + 1;
      break;
    case 'bottom':
      startRow = row + height - 2;
      break;
    case 'middle':
    default:
      startRow = row + Math.floor(height / 2);
      break;
  }

  return { col: startCol, row: startRow, text: displayText };
}
