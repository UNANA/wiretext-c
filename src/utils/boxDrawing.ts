import type { Grid, BoxStyle, CanvasObject, ComponentType, GridSize, LabelAlign, LabelVerticalAlign } from '../types';
import { computeLabelPlacement } from './labelLayout';

const DEFAULT_LAYER_ID = 'layer-1';
const DEFAULT_LAYER_NAME = 'Layer 1';

// Unicode Box Drawing Characters - exact wire format
export const i = {
  single: {
    topLeft: "┌", topRight: "┐",
    bottomLeft: "└", bottomRight: "┘",
    horizontal: "─", vertical: "│",
    teeRight: "├", teeLeft: "┤"
  },
  double: {
    topLeft: "╔", topRight: "╗",
    bottomLeft: "╚", bottomRight: "╝",
    horizontal: "═", vertical: "║",
    teeRight: "╠", teeLeft: "╣"
  },
  rounded: {
    topLeft: "╭", topRight: "╮",
    bottomLeft: "╰", bottomRight: "╯",
    horizontal: "─", vertical: "│",
    teeRight: "├", teeLeft: "┤"
  },
  heavy: {
    topLeft: "┏", topRight: "┓",
    bottomLeft: "┗", bottomRight: "┛",
    horizontal: "━", vertical: "┃",
    teeRight: "┣", teeLeft: "┫"
  }
};

// Arrow characters
export const a = {
  horizontal: "─",
  vertical: "│",
  diagonalDown: "╲",
  diagonalUp: "╱"
};

// Direction arrows
export const s = {
  right: "→",
  left: "←",
  up: "↑",
  down: "↓",
  upRight: "↗",
  downRight: "↘",
  downLeft: "↙",
  upLeft: "↖"
};

function getHeadChar(style: CanvasObject['connectorFromHead'], dCol: number, dRow: number): string {
  if (style === 'dot') return '●';
  if (style === 'arrow') {
    if (dCol > 0) return s.right;
    if (dCol < 0) return s.left;
    if (dRow > 0) return s.down;
    if (dRow < 0) return s.up;
    return '•';
  }
  if (dCol !== 0) return a.horizontal;
  if (dRow !== 0) return a.vertical;
  return '•';
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Set character at position (c function) - only sets if space or target is space
export function setChar(grid: Grid, col: number, row: number, char: string): void {
  if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
    if (char !== ' ' || grid[row][col] === ' ') {
      grid[row][col] = char;
    }
  }
}

// Draw character (d function) - always sets
export function drawChar(grid: Grid, col: number, row: number, char: string): void {
  if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
    grid[row][col] = char;
  }
}

// Fill rectangle (u function)
export function fillRect(grid: Grid, col: number, row: number, width: number, height: number): void {
  for (let r = row + 1; r < row + height - 1 && r < grid.length; r++) {
    for (let c = col + 1; c < col + width - 1 && c < grid[0].length; c++) {
      drawChar(grid, c, r, ' ');
    }
  }
}

// Draw text (h function)
export function drawText(grid: Grid, col: number, row: number, text: string): void {
  if (!text) return;
  for (let i = 0; i < text.length && col + i < grid[0].length; i++) {
    if (row >= 0 && row < grid.length) {
      setChar(grid, col + i, row, text[i]);
    }
  }
}

// Draw horizontal line (m function)
export function drawHLine(grid: Grid, col: number, row: number, width: number): void {
  for (let c = col; c < col + width && c < grid[0].length; c++) {
    if (row >= 0 && row < grid.length) {
      setChar(grid, c, row, a.horizontal);
    }
  }
}

// Draw box border (x function)
export function drawBoxBorder(grid: Grid, col: number, row: number, width: number, height: number, style: BoxStyle): void {
  const chars = i[style];
  if (!chars || width < 2 || height < 2) return;

  // Corners
  setChar(grid, col, row, chars.topLeft);
  setChar(grid, col + width - 1, row, chars.topRight);
  setChar(grid, col, row + height - 1, chars.bottomLeft);
  setChar(grid, col + width - 1, row + height - 1, chars.bottomRight);

  // Top and bottom edges
  for (let c = 1; c < width - 1; c++) {
    setChar(grid, col + c, row, chars.horizontal);
    setChar(grid, col + c, row + height - 1, chars.horizontal);
  }

  // Left and right edges
  for (let r = 1; r < height - 1; r++) {
    setChar(grid, col, row + r, chars.vertical);
    setChar(grid, col + width - 1, row + r, chars.vertical);
  }
}

// Place centered text (p function)
export function placeCenteredText(grid: Grid, col: number, row: number, width: number, height: number, text: string): void {
  if (!text) return;
  const centerRow = row + Math.floor(height / 2);
  const maxLen = width - 4;
  const displayText = text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
  const startCol = col + Math.floor((width - displayText.length) / 2);
  drawText(grid, startCol, centerRow, displayText);
}

// Place a label inside a box/button with configurable alignment. Defaults
// (center/middle) reproduce placeCenteredText, so unset labelPosition keeps
// the legacy appearance. Positioning logic lives in the pure
// computeLabelPlacement so it can be unit-tested.
export function placeLabel(
  grid: Grid,
  col: number,
  row: number,
  width: number,
  height: number,
  text: string,
  align: LabelAlign = 'center',
  verticalAlign: LabelVerticalAlign = 'middle',
): void {
  if (!text) return;
  const placement = computeLabelPlacement(col, row, width, height, text, align, verticalAlign);
  drawText(grid, placement.col, placement.row, placement.text);
}

// Get diagonal direction (b function)
export function getDiagonalDirection(dx: number, dy: number): string {
  return (dx > 0 && dy > 0) || (dx < 0 && dy < 0) ? a.diagonalDown : a.diagonalUp;
}

// Get line points (f function) - Bresenham line algorithm
export function* getLinePoints(x0: number, y0: number, x1: number, y1: number): Generator<{ col: number, row: number }> {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    yield { col: x0, row: y0 };
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

// Checkbox/Radio helper (g function) - centered vertically
export function drawCheckboxRadio(grid: Grid, col: number, row: number, width: number, height: number, symbol: string, label: string): void {
  const centerRow = row + Math.floor(height / 2);
  const padding = 2;
  const fullText = symbol + ' ' + label;

  // Truncate if too long
  const maxLen = width - padding * 2;
  const displayText = fullText.length > maxLen ? fullText.slice(0, maxLen - 1) + '…' : fullText;

  drawText(grid, col + padding, centerRow, displayText);
}

// Modal/Card helper (w function)
export function drawModalCard(grid: Grid, col: number, row: number, width: number, height: number, label: string, hasClose: boolean, style: BoxStyle): void {
  if (height < 5) return;
  drawBoxBorder(grid, col, row, width, height, style);

  // Title
  drawText(grid, col + 2, row + 1, label);

  // Horizontal line below title
  drawHLine(grid, col + 1, row + 2, width - 2);

  // Tee connections for the line
  const chars = i[style];
  drawChar(grid, col, row + 2, chars.teeRight);
  drawChar(grid, col + width - 1, row + 2, chars.teeLeft);

  // Close button
  if (hasClose) {
    drawChar(grid, col + width - 3, row + 1, '×');
  }
}

// Table helper
export function drawTable(grid: Grid, col: number, row: number, width: number, height: number, columns: string[]): void {
  if (height < 5) return;
  const innerWidth = width - 2;
  const colWidth = Math.floor(innerWidth / columns.length);

  // Horizontal line for header separator
  drawHLine(grid, col + 1, row + 2, innerWidth);

  // Draw columns
  for (let c = 0; c < columns.length; c++) {
    // Column header
    drawText(grid, col + 1 + c * colWidth + 1, row + 1, columns[c].slice(0, colWidth - 2));

    // Vertical separator (except for first column)
    if (c > 0) {
      const lineCol = col + c * colWidth;
      for (let r = 1; r < height - 1; r++) {
        drawChar(grid, lineCol, row + r, '│');
      }
      // Tee connections
      drawChar(grid, lineCol, row, '┬');
      drawChar(grid, lineCol, row + 2, '┼');
      drawChar(grid, lineCol, row + height - 1, '┴');
    }
  }
}

// Browser helper
export function drawBrowser(grid: Grid, col: number, row: number, width: number, height: number, label: string, style: BoxStyle): void {
  if (height < 5) return;
  const chars = i[style];

  // Address bar line
  drawHLine(grid, col + 1, row + 2, width - 2);

  // Tee connections
  drawChar(grid, col, row + 2, chars.teeRight);
  drawChar(grid, col + width - 1, row + 2, chars.teeLeft);

  // Navigation buttons
  drawText(grid, col + 2, row + 1, '◄ ► ⟳');

  // URL
  const url = label || 'https://';
  const urlStart = col + 10;
  const urlEnd = col + width - 2;
  if (urlEnd > urlStart) {
    drawText(grid, urlStart, row + 1, url.slice(0, urlEnd - urlStart));
  }
}

// Progress helper
export function drawProgress(grid: Grid, col: number, row: number, width: number, height: number, progress: number = 40): void {
  const progressRow = row + Math.floor(height / 2);
  const innerWidth = width - 4;
  const filled = Math.round(Math.max(0, Math.min(100, progress)) / 100 * innerWidth);

  let bar = '';
  for (let i = 0; i < innerWidth; i++) {
    bar += i < filled ? '▓' : '░';
  }
  drawText(grid, col + 2, progressRow, bar);
}

// Textarea helper
export function drawTextarea(grid: Grid, col: number, row: number, width: number, height: number, label: string): void {
  const midRow = row + 1;
  drawText(grid, col + 2, midRow, label || 'Text...');
  // Draw lines to indicate multi-line
  for (let r = midRow + 1; r < row + height - 1 && r < row + height - 1; r++) {
    const lineWidth = Math.min(width - 4, 12);
    let line = '';
    for (let c = 0; c < lineWidth; c++) line += '·';
    drawText(grid, col + 2, r, line);
  }
}

// Slider helper
export function drawSlider(grid: Grid, col: number, row: number, width: number, height: number, value: number = 40): void {
  const midRow = row + Math.floor(height / 2);
  const trackWidth = width - 4;
  const thumbPos = Math.round(Math.max(0, Math.min(100, value)) / 100 * (trackWidth - 1));

  for (let c = 0; c < trackWidth; c++) {
    if (c === thumbPos) {
      drawText(grid, col + 2 + c, midRow, '●');
    } else {
      drawText(grid, col + 2 + c, midRow, '─');
    }
  }
}

// Toggle helper
export function drawToggle(grid: Grid, col: number, row: number, _width: number, height: number, toggled: boolean = false): void {
  const midRow = row + Math.floor(height / 2);
  if (toggled) {
    drawText(grid, col + 2, midRow, '( ●)');
  } else {
    drawText(grid, col + 2, midRow, '(● )');
  }
}

// Accordion helper
export function drawAccordion(grid: Grid, col: number, row: number, width: number, height: number, items: string[], style: BoxStyle): void {
  const chars = i[style];
  let currentRow = row;
  for (let idx = 0; idx < items.length && currentRow < row + height - 1; idx++) {
    // Draw separator line
    if (idx > 0 && currentRow < row + height) {
      for (let c = 1; c < width - 1; c++) {
        setChar(grid, col + c, currentRow, chars.horizontal);
      }
      setChar(grid, col, currentRow, chars.teeRight);
      setChar(grid, col + width - 1, currentRow, chars.teeLeft);
      currentRow++;
    }
    // Draw item
    if (currentRow < row + height - 1) {
      const arrow = idx === 0 ? '▾' : '▸';
      const text = `${arrow} ${items[idx]}`;
      const maxLen = width - 4;
      drawText(grid, col + 2, currentRow, text.slice(0, maxLen));
      currentRow++;
      // If first item (expanded), show content placeholder
      if (idx === 0 && currentRow < row + height - 1) {
        drawText(grid, col + 4, currentRow, 'Content...');
        currentRow++;
      }
    }
  }
}

// Sidebar helper
export function drawSidebar(grid: Grid, col: number, row: number, width: number, height: number, items: string[], style: BoxStyle): void {
  const chars = i[style];
  // Draw hamburger menu icon
  drawText(grid, col + 2, row + 1, '≡ Menu');
  // Separator
  for (let c = 1; c < width - 1; c++) {
    setChar(grid, col + c, row + 2, chars.horizontal);
  }
  setChar(grid, col, row + 2, chars.teeRight);
  setChar(grid, col + width - 1, row + 2, chars.teeLeft);
  // Menu items
  for (let idx = 0; idx < items.length && row + 3 + idx < row + height - 1; idx++) {
    const text = `› ${items[idx]}`;
    drawText(grid, col + 2, row + 3 + idx, text.slice(0, width - 4));
  }
}

// Avatar helper
export function drawAvatar(grid: Grid, col: number, row: number, width: number, height: number, label: string): void {
  const midRow = row + Math.floor(height / 2);
  const midCol = col + Math.floor(width / 2);
  drawText(grid, midCol - 1, midRow, '◉');
  // If there's enough space and a label, show initials below
  if (label && height > 2) {
    const initials = label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    drawText(grid, midCol - Math.floor(initials.length / 2), midRow + 1, initials);
  }
}

// Badge helper
export function drawBadge(grid: Grid, col: number, row: number, width: number, height: number, text: string): void {
  placeCenteredText(grid, col, row, width, height, text || '1');
}

// Breadcrumb helper
export function drawBreadcrumb(grid: Grid, col: number, row: number, width: number, height: number, items: string[]): void {
  const midRow = row + Math.floor(height / 2);
  const text = items.join(' › ');
  const maxLen = width - 4;
  drawText(grid, col + 2, midRow, text.slice(0, maxLen));
}

// Dropdown helper
export function drawDropdown(grid: Grid, col: number, row: number, width: number, height: number, items: string[], style: BoxStyle): void {
  const chars = i[style];
  // Header row with arrow
  const midRow = row + Math.floor(1);
  drawText(grid, col + 2, midRow, (items[0] || 'Option') + '  ▾');
  // Separator
  if (height > 3) {
    for (let c = 1; c < width - 1; c++) {
      setChar(grid, col + c, row + 2, chars.horizontal);
    }
    setChar(grid, col, row + 2, chars.teeRight);
    setChar(grid, col + width - 1, row + 2, chars.teeLeft);
    // Items
    for (let idx = 1; idx < items.length && row + 2 + idx < row + height - 1; idx++) {
      drawText(grid, col + 2, row + 2 + idx, items[idx].slice(0, width - 4));
    }
  }
}

// Search helper
export function drawSearch(grid: Grid, col: number, row: number, _width: number, height: number, label: string): void {
  const midRow = row + Math.floor(height / 2);
  drawText(grid, col + 2, midRow, '⌕ ' + (label || 'Search...'));
}

// Stepper helper
export function drawStepper(grid: Grid, col: number, row: number, width: number, height: number, value: number): void {
  const midRow = row + Math.floor(height / 2);
  const valStr = String(value);
  const innerWidth = width - 4;
  // [-] value [+]
  const text = `[-] ${valStr} [+]`;
  const padded = text.length < innerWidth ? text + ' '.repeat(innerWidth - text.length) : text.slice(0, innerWidth);
  drawText(grid, col + 2, midRow, padded);
}

// Calendar helper
export function drawCalendar(grid: Grid, col: number, row: number, width: number, height: number, style: BoxStyle): void {
  const chars = i[style];
  // Month header
  drawText(grid, col + 2, row + 1, '◄  Month 2026  ►');
  // Separator
  if (height > 4) {
    for (let c = 1; c < width - 1; c++) {
      setChar(grid, col + c, row + 2, chars.horizontal);
    }
    setChar(grid, col, row + 2, chars.teeRight);
    setChar(grid, col + width - 1, row + 2, chars.teeLeft);
    // Day headers
    drawText(grid, col + 1, row + 3, 'Su Mo Tu We Th Fr Sa');
    // Day numbers
    const days = [
      ' 1  2  3  4  5  6  7',
      ' 8  9 10 11 12 13 14',
      '15 16 17 18 19 20 21',
      '22 23 24 25 26 27 28',
    ];
    for (let d = 0; d < days.length && row + 4 + d < row + height - 1; d++) {
      drawText(grid, col + 1, row + 4 + d, days[d].slice(0, width - 2));
    }
  }
}

// List helper
export function drawList(grid: Grid, col: number, row: number, width: number, height: number, items: string[], ordered: boolean): void {
  for (let idx = 0; idx < items.length && row + 1 + idx < row + height - 1; idx++) {
    const bullet = ordered ? `${idx + 1}.` : '•';
    const text = `${bullet} ${items[idx]}`;
    drawText(grid, col + 2, row + 1 + idx, text.slice(0, width - 4));
  }
}

// Divider helper
export function drawDivider(grid: Grid, col: number, row: number, width: number): void {
  for (let c = 0; c < width; c++) {
    setChar(grid, col + c, row, '─');
  }
}

// Tooltip helper
export function drawTooltip(grid: Grid, col: number, row: number, width: number, height: number, text: string): void {
  // Draw tooltip pointer at bottom center
  const midCol = col + Math.floor(width / 2);
  placeCenteredText(grid, col, row, width, height, text || 'Tooltip');
  if (height > 1) {
    setChar(grid, midCol, row + height - 1, '▽');
  }
}

// Tag helper
export function drawTag(grid: Grid, col: number, row: number, width: number, height: number, text: string): void {
  const tagRow = row + Math.floor(height / 2);
  const label = `\u3014${text || 'Tag'}\u3015`;
  const startCol = col + Math.floor((width - label.length) / 2);
  drawText(grid, Math.max(col, startCol), tagRow, label.slice(0, width));
}

// Spinner helper
export function drawSpinner(grid: Grid, col: number, row: number, width: number, height: number): void {
  placeCenteredText(grid, col, row, width, height, '🔄');
}

// Pagination helper
export function drawPagination(grid: Grid, col: number, row: number, width: number, height: number, currentPage: number, totalPages: number): void {
  const midRow = row + Math.floor(height / 2);
  // Build: ‹ 1 2 [3] 4 5 ›
  let pages = '‹ ';
  for (let p = 1; p <= Math.min(totalPages, 7); p++) {
    if (p === currentPage) {
      pages += `[${p}] `;
    } else {
      pages += `${p} `;
    }
  }
  if (totalPages > 7) pages += '... ';
  pages += '›';
  drawText(grid, col + 2, midRow, pages.slice(0, width - 4));
}

// Main render function (v function)
export function renderObjectsToGrid(objects: CanvasObject[], gridSize: GridSize): Grid {
  // Create empty grid
  const grid: Grid = [];
  for (let row = 0; row < gridSize.rows; row++) {
    grid.push(Array(gridSize.cols).fill(' '));
  }

  // Sort by zIndex and render
  const sortedObjects = [...objects].sort(compareObjectsByStackOrder);

  for (const obj of sortedObjects) {
    const { col, row } = obj.position;

    switch (obj.type) {
      case 'box': {
        if (obj.fill !== 'transparent') fillRect(grid, col, row, obj.width, obj.height);
        drawBoxBorder(grid, col, row, obj.width, obj.height, obj.borderStyle || 'single');
        if (obj.label) placeLabel(grid, col, row, obj.width, obj.height, obj.label, obj.labelAlign, obj.labelVerticalAlign);
        break;
      }

      case 'text': {
        const lines = (obj.content || '').split('\n');
        for (let i = 0; i < lines.length; i++) {
          for (let j = 0; j < lines[i].length; j++) {
            setChar(grid, obj.position.col + j, obj.position.row + i, lines[i][j]);
          }
        }
        break;
      }

      case 'line': {
        // Calculate end position from rotation if specified, otherwise use endPosition
        let endCol: number, endRow: number;
        if (obj.rotation !== undefined) {
          const length = getLineLength(obj);
          const rad = (obj.rotation * Math.PI) / 180;
          endCol = col + Math.round(Math.cos(rad) * length);
          endRow = row + Math.round(Math.sin(rad) * length);
        } else if (obj.endPosition) {
          endCol = obj.endPosition.col;
          endRow = obj.endPosition.row;
        } else {
          break;
        }

        if (obj.isConnector && obj.connectorPath && obj.connectorPath.length >= 2) {
          for (let i = 0; i < obj.connectorPath.length - 1; i++) {
            const from = obj.connectorPath[i];
            const to = obj.connectorPath[i + 1];
            if (from.row === to.row) {
              const start = Math.min(from.col, to.col);
              const end = Math.max(from.col, to.col);
              for (let c = start; c <= end; c++) {
                setChar(grid, c, from.row, a.horizontal);
              }
            } else if (from.col === to.col) {
              const start = Math.min(from.row, to.row);
              const end = Math.max(from.row, to.row);
              for (let r = start; r <= end; r++) {
                setChar(grid, from.col, r, a.vertical);
              }
            }
          }

          for (let i = 1; i < obj.connectorPath.length - 1; i++) {
            const prev = obj.connectorPath[i - 1];
            const curr = obj.connectorPath[i];
            const next = obj.connectorPath[i + 1];
            const fromLeft = prev.col < curr.col;
            const fromRight = prev.col > curr.col;
            const fromUp = prev.row < curr.row;
            const fromDown = prev.row > curr.row;
            const toLeft = next.col < curr.col;
            const toRight = next.col > curr.col;
            const toUp = next.row < curr.row;
            const toDown = next.row > curr.row;

            let corner = '┼';
            if ((fromLeft && toDown) || (toLeft && fromDown)) corner = '┐';
            else if ((fromLeft && toUp) || (toLeft && fromUp)) corner = '┘';
            else if ((fromRight && toDown) || (toRight && fromDown)) corner = '┌';
            else if ((fromRight && toUp) || (toRight && fromUp)) corner = '└';
            setChar(grid, curr.col, curr.row, corner);
          }

          const fromHead = obj.connectorFromHead ?? 'line';
          const toHead = obj.connectorToHead ?? 'line';
          const start = obj.connectorPath[0];
          const next = obj.connectorPath[1];
          const prev = obj.connectorPath[obj.connectorPath.length - 2];
          const end = obj.connectorPath[obj.connectorPath.length - 1];
          setChar(grid, start.col, start.row, getHeadChar(fromHead, next.col - start.col, next.row - start.row));
          setChar(grid, end.col, end.row, getHeadChar(toHead, end.col - prev.col, end.row - prev.row));
        } else if (row === endRow) {
          // Horizontal line
          const start = Math.min(col, endCol);
          const end = Math.max(col, endCol);
          for (let c = start; c <= end; c++) {
            setChar(grid, c, row, a.horizontal);
          }
        } else if (col === endCol) {
          // Vertical line
          const start = Math.min(row, endRow);
          const end = Math.max(row, endRow);
          for (let r = start; r <= end; r++) {
            setChar(grid, col, r, a.vertical);
          }
        } else {
          // Diagonal/angled line - Bresenham algorithm handles any angle
          const dir = getDiagonalDirection(endCol - col, endRow - row);
          for (const point of getLinePoints(col, row, endCol, endRow)) {
            setChar(grid, point.col, point.row, dir);
          }
        }
        break;
      }

      case 'arrow': {
        // Calculate end position from rotation if specified, otherwise use endPosition
        let endCol: number, endRow: number;
        if (obj.rotation !== undefined) {
          const length = getLineLength(obj);
          const rad = (obj.rotation * Math.PI) / 180;
          endCol = col + Math.round(Math.cos(rad) * length);
          endRow = row + Math.round(Math.sin(rad) * length);
        } else if (obj.endPosition) {
          endCol = obj.endPosition.col;
          endRow = obj.endPosition.row;
        } else {
          break;
        }

        const dx = endCol - col;
        const dy = endRow - row;

        if (row === endRow) {
          // Horizontal arrow
          const start = Math.min(col, endCol);
          const end = Math.max(col, endCol);
          for (let c = start; c <= end; c++) {
            setChar(grid, c, row, a.horizontal);
          }
          setChar(grid, endCol, endRow, dx > 0 ? s.right : s.left);
        } else if (col === endCol) {
          // Vertical arrow
          const start = Math.min(row, endRow);
          const end = Math.max(row, endRow);
          for (let r = start; r <= end; r++) {
            setChar(grid, col, r, a.vertical);
          }
          setChar(grid, endCol, endRow, dy > 0 ? s.down : s.up);
        } else {
          // Diagonal/angled arrow - Bresenham algorithm handles any angle
          const dir = getDiagonalDirection(dx, dy);
          for (const point of getLinePoints(col, row, endCol, endRow)) {
            setChar(grid, point.col, point.row, dir);
          }

          // Arrow head based on direction
          let arrowHead: string;
          if (dy === 0) arrowHead = dx > 0 ? s.right : s.left;
          else if (dx === 0) arrowHead = dy > 0 ? s.down : s.up;
          else if (dx > 0 && dy < 0) arrowHead = s.upRight;
          else if (dx > 0 && dy > 0) arrowHead = s.downRight;
          else if (dx < 0 && dy > 0) arrowHead = s.downLeft;
          else arrowHead = s.upLeft;
          setChar(grid, endCol, endRow, arrowHead);
        }
        break;
      }

      case 'component': {
        const compCol = col;
        const compRow = row;

        if (obj.fill !== 'transparent') fillRect(grid, compCol, compRow, obj.width, obj.height);
        drawBoxBorder(grid, compCol, compRow, obj.width, obj.height, obj.borderStyle || 'single');

        switch (obj.componentType) {
          case 'button':
            placeLabel(grid, compCol, compRow, obj.width, obj.height, obj.label || 'Button', obj.labelAlign, obj.labelVerticalAlign);
            break;

          case 'input': {
            const midRow = compRow + Math.floor(obj.height / 2);
            drawText(grid, compCol + 2, midRow, obj.label || 'Input');
            break;
          }

          case 'select': {
            const midRow = compRow + Math.floor(obj.height / 2);
            drawText(grid, compCol + 2, midRow, obj.label || 'Select');
            drawChar(grid, compCol + obj.width - 3, midRow, '▾');
            break;
          }

          case 'checkbox':
            drawCheckboxRadio(grid, compCol, compRow, obj.width, obj.height, obj.checked !== false ? '[✓]' : '[ ]', obj.label || 'Checkbox');
            break;

          case 'radio':
            drawCheckboxRadio(grid, compCol, compRow, obj.width, obj.height, obj.checked !== false ? '(●)' : '(○)', obj.label || 'Radio');
            break;

          case 'table':
            drawTable(grid, compCol, compRow, obj.width, obj.height, obj.columns || ['Col A', 'Col B']);
            break;

          case 'modal':
            drawModalCard(grid, compCol, compRow, obj.width, obj.height, obj.label || 'Modal', true, obj.borderStyle || 'single');
            break;

          case 'browser':
            drawBrowser(grid, compCol, compRow, obj.width, obj.height, obj.label || 'https://', obj.borderStyle || 'single');
            break;

          case 'card':
            drawModalCard(grid, compCol, compRow, obj.width, obj.height, obj.label || 'Card', false, 'rounded');
            break;

          case 'navbar': {
            const midRow = compRow + Math.floor(obj.height / 2);
            drawText(grid, compCol + 2, midRow, '≡');
            const navItems = obj.navItems || ['Home', 'About', 'Contact'];
            drawText(grid, compCol + 5, midRow, navItems.join('  '));
            break;
          }

          case 'tabs': {
            const midRow = compRow + Math.floor(obj.height / 2);
            const tabs = obj.tabs || ['Tab 1', 'Tab 2', 'Tab 3'];
            drawText(grid, compCol + 2, midRow, tabs.join(' │ '));
            break;
          }

          case 'progress':
            drawProgress(grid, compCol, compRow, obj.width, obj.height, obj.progress);
            break;

          case 'textarea':
            drawTextarea(grid, compCol, compRow, obj.width, obj.height, obj.label || 'Text...');
            break;

          case 'slider':
            drawSlider(grid, compCol, compRow, obj.width, obj.height, obj.sliderValue);
            break;

          case 'toggle':
            drawToggle(grid, compCol, compRow, obj.width, obj.height, obj.toggled);
            break;

          case 'accordion':
            drawAccordion(grid, compCol, compRow, obj.width, obj.height, obj.accordionItems || ['Section 1', 'Section 2', 'Section 3'], obj.borderStyle || 'single');
            break;

          case 'sidebar':
            drawSidebar(grid, compCol, compRow, obj.width, obj.height, obj.sidebarItems || ['Home', 'Profile', 'Settings'], obj.borderStyle || 'single');
            break;

          case 'avatar':
            drawAvatar(grid, compCol, compRow, obj.width, obj.height, obj.label || '');
            break;

          case 'badge':
            drawBadge(grid, compCol, compRow, obj.width, obj.height, obj.badgeText || '1');
            break;

          case 'breadcrumb':
            drawBreadcrumb(grid, compCol, compRow, obj.width, obj.height, obj.breadcrumbItems || ['Home', 'Page', 'Sub']);
            break;

          case 'dropdown':
            drawDropdown(grid, compCol, compRow, obj.width, obj.height, obj.dropdownItems || ['Option 1', 'Option 2', 'Option 3'], obj.borderStyle || 'single');
            break;

          case 'search':
            drawSearch(grid, compCol, compRow, obj.width, obj.height, obj.label || 'Search...');
            break;

          case 'stepper':
            drawStepper(grid, compCol, compRow, obj.width, obj.height, obj.stepperValue ?? 0);
            break;

          case 'calendar':
            drawCalendar(grid, compCol, compRow, obj.width, obj.height, obj.borderStyle || 'single');
            break;

          case 'list':
            drawList(grid, compCol, compRow, obj.width, obj.height, obj.listItems || ['Item 1', 'Item 2', 'Item 3'], obj.listOrdered ?? false);
            break;

          case 'divider':
            drawDivider(grid, compCol, compRow, obj.width);
            break;

          case 'tooltip':
            drawTooltip(grid, compCol, compRow, obj.width, obj.height, obj.tooltipText || 'Tooltip');
            break;

          case 'tag':
            drawTag(grid, compCol, compRow, obj.width, obj.height, obj.tagText || 'Tag');
            break;

          case 'spinner':
            drawSpinner(grid, compCol, compRow, obj.width, obj.height);
            break;

          case 'pagination':
            drawPagination(grid, compCol, compRow, obj.width, obj.height, obj.currentPage ?? 1, obj.totalPages ?? 5);
            break;
        }
        break;
      }

      case 'pencil': {
        for (const point of obj.points || []) {
          drawChar(grid, point.col, point.row, '█');
        }
        break;
      }
    }
  }

  return grid;
}

// Get line/arrow length (for rotation and end position calculation)
export function getLineLength(obj: CanvasObject): number {
  if (obj.type !== 'line' && obj.type !== 'arrow') return 0;
  if (obj.endPosition) {
    const dx = obj.endPosition.col - obj.position.col;
    const dy = obj.endPosition.row - obj.position.row;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }
  return Math.max(obj.width, obj.height, 1);
}

// Get bounding box (r function)
export function getBoundingBox(obj: CanvasObject): { col: number; row: number; width: number; height: number } {
  switch (obj.type) {
    case 'box':
    case 'component':
      return { col: obj.position.col, row: obj.position.row, width: obj.width, height: obj.height };

    case 'text': {
      const lines = (obj.content || '').split('\n');
      return {
        col: obj.position.col,
        row: obj.position.row,
        width: Math.max(...lines.map(l => l.length), 1),
        height: lines.length || 1
      };
    }

    case 'line':
    case 'arrow': {
      // Calculate end position from rotation if specified, otherwise use endPosition
      let endCol: number, endRow: number;
      if (obj.rotation !== undefined) {
        const length = getLineLength(obj);
        const rad = (obj.rotation * Math.PI) / 180;
        endCol = obj.position.col + Math.round(Math.cos(rad) * length);
        endRow = obj.position.row + Math.round(Math.sin(rad) * length);
      } else if (obj.endPosition) {
        endCol = obj.endPosition.col;
        endRow = obj.endPosition.row;
      } else {
        return { col: obj.position.col, row: obj.position.row, width: 1, height: 1 };
      }

      if (obj.isConnector && obj.connectorPath && obj.connectorPath.length > 0) {
        let minCol = Number.POSITIVE_INFINITY;
        let minRow = Number.POSITIVE_INFINITY;
        let maxCol = Number.NEGATIVE_INFINITY;
        let maxRow = Number.NEGATIVE_INFINITY;
        for (const point of obj.connectorPath) {
          minCol = Math.min(minCol, point.col);
          minRow = Math.min(minRow, point.row);
          maxCol = Math.max(maxCol, point.col);
          maxRow = Math.max(maxRow, point.row);
        }
        return {
          col: minCol,
          row: minRow,
          width: maxCol - minCol + 1,
          height: maxRow - minRow + 1,
        };
      }
      const startCol = Math.min(obj.position.col, endCol);
      const startRow = Math.min(obj.position.row, endRow);
      return {
        col: startCol,
        row: startRow,
        width: Math.max(obj.position.col, endCol) - startCol + 1,
        height: Math.max(obj.position.row, endRow) - startRow + 1
      };
    }

    case 'pencil': {
      const points = obj.points || [];
      if (points.length === 0) {
        return { col: obj.position.col, row: obj.position.row, width: 1, height: 1 };
      }
      let minCol = Number.POSITIVE_INFINITY;
      let minRow = Number.POSITIVE_INFINITY;
      let maxCol = Number.NEGATIVE_INFINITY;
      let maxRow = Number.NEGATIVE_INFINITY;
      for (const point of points) {
        minCol = Math.min(minCol, point.col);
        minRow = Math.min(minRow, point.row);
        maxCol = Math.max(maxCol, point.col);
        maxRow = Math.max(maxRow, point.row);
      }
      return {
        col: minCol,
        row: minRow,
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1,
      };
    }

    default:
      return { col: 0, row: 0, width: 0, height: 0 };
  }
}

// Create default object
export function createDefaultObject(
  type: 'box' | 'text' | 'line' | 'arrow' | 'component',
  col: number,
  row: number,
  options: { componentType?: ComponentType; zIndex?: number; content?: string } = {}
): CanvasObject {
  const id = generateId();
  const zIndex = options.zIndex || 0;

  const base: CanvasObject = {
    id,
    type,
    position: { col, row },
    width: 10,
    height: 6,
    zIndex,
    layerId: DEFAULT_LAYER_ID,
    layerName: DEFAULT_LAYER_NAME,
    layerOrder: 0,
    borderStyle: 'single',
    fill: 'solid'
  };

  switch (type) {
    case 'box':
      return { ...base, width: 10, height: 6, label: '' };

    case 'text': {
      const content = options.content ?? base.content ?? '';
      const lines = content.split('\n');
      return {
        ...base,
        type: 'text',
        width: Math.max(...lines.map(l => l.length), 1),
        height: lines.length || 1,
        content
      };
    }

    case 'line':
      return {
        ...base,
        type: 'line',
        width: 10,
        height: 1,
        endPosition: { col: col + 9, row }
      };

    case 'arrow':
      return {
        ...base,
        type: 'arrow',
        width: 10,
        height: 1,
        endPosition: { col: col + 9, row }
      };

    case 'component': {
      const componentType = options.componentType || 'button';
      const defs: Record<ComponentType, Partial<CanvasObject>> = {
        button: { width: 12, height: 3, label: 'Button' },
        input: { width: 20, height: 3, label: 'Input' },
        select: { width: 20, height: 3, label: 'Select' },
        checkbox: { width: 20, height: 3, label: 'Checkbox', checked: true },
        radio: { width: 20, height: 3, label: 'Radio', checked: true },
        table: { width: 24, height: 8, columns: ['Col A', 'Col B'] },
        modal: { width: 30, height: 15, label: 'Modal' },
        browser: { width: 40, height: 20, label: 'https://' },
        card: { width: 20, height: 10, label: 'Card' },
        navbar: { width: 40, height: 3, navItems: ['Home', 'About', 'Contact'] },
        tabs: { width: 30, height: 3, tabs: ['Tab 1', 'Tab 2', 'Tab 3'] },
        progress: { width: 20, height: 3, progress: 40 },
        textarea: { width: 20, height: 6, label: 'Text...' },
        slider: { width: 20, height: 3, sliderValue: 40 },
        toggle: { width: 12, height: 3, toggled: false },
        accordion: { width: 30, height: 10, accordionItems: ['Section 1', 'Section 2', 'Section 3'] },
        sidebar: { width: 20, height: 20, sidebarItems: ['Home', 'Profile', 'Settings'] },
        avatar: { width: 6, height: 3, label: '' },
        badge: { width: 8, height: 3, badgeText: '1' },
        breadcrumb: { width: 30, height: 3, breadcrumbItems: ['Home', 'Page', 'Sub'] },
        dropdown: { width: 20, height: 8, dropdownItems: ['Option 1', 'Option 2', 'Option 3'] },
        search: { width: 24, height: 3, label: 'Search...' },
        stepper: { width: 14, height: 3, stepperValue: 0 },
        calendar: { width: 22, height: 10 },
        list: { width: 20, height: 8, listItems: ['Item 1', 'Item 2', 'Item 3'], listOrdered: false },
        divider: { width: 30, height: 1 },
        tooltip: { width: 16, height: 3, tooltipText: 'Tooltip' },
        tag: { width: 10, height: 3, tagText: 'Tag' },
        spinner: { width: 8, height: 3 },
        pagination: { width: 24, height: 3, currentPage: 1, totalPages: 5 },
      };
      return { ...base, type: 'component', componentType, ...defs[componentType] };
    }
  }
}

// Check if point is on line (using Bresenham)
function isPointOnLine(startCol: number, startRow: number, endCol: number, endRow: number, col: number, row: number): boolean {
  for (const point of getLinePoints(startCol, startRow, endCol, endRow)) {
    if (point.col === col && point.row === row) return true;
  }
  return false;
}

function isPointOnConnectorPath(path: { col: number; row: number }[], col: number, row: number): boolean {
  if (path.length < 2) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (isPointOnLine(path[i].col, path[i].row, path[i + 1].col, path[i + 1].row, col, row)) {
      return true;
    }
  }
  return false;
}

// Hit test - precise detection for different object types (checks topmost by z-index first)
export function hitTest(objects: CanvasObject[], col: number, row: number): CanvasObject | null {
  const sorted = [...objects].sort((a, b) => compareObjectsByStackOrder(b, a)); // topmost first
  for (const obj of sorted) {

    // Box/Component: Hit within bounding box
    if (obj.type === 'box' || obj.type === 'component') {
      const bbox = getBoundingBox(obj);
      if (col >= bbox.col && col < bbox.col + bbox.width &&
        row >= bbox.row && row < bbox.row + bbox.height) {
        return obj;
      }
    }

    // Text: Hit only on non-space characters (or anywhere in bounding box if empty)
    else if (obj.type === 'text') {
      const content = obj.content || '';
      // If empty, allow hit anywhere in the 1x1 bounding box
      if (content === '') {
        if (col === obj.position.col && row === obj.position.row) {
          return obj;
        }
      } else {
        const lines = content.split('\n');
        const relRow = row - obj.position.row;
        const relCol = col - obj.position.col;
        if (relRow >= 0 && relRow < lines.length) {
          const line = lines[relRow];
          if (relCol >= 0 && relCol < line.length && line[relCol] !== ' ') {
            return obj;
          }
        }
      }
    }

    // Line/Arrow: Hit on the line itself
    else if (obj.type === 'line' || obj.type === 'arrow') {
      // Calculate end position
      let endCol: number, endRow: number;
      if (obj.rotation !== undefined) {
        const length = getLineLength(obj);
        const rad = (obj.rotation * Math.PI) / 180;
        endCol = obj.position.col + Math.round(Math.cos(rad) * length);
        endRow = obj.position.row + Math.round(Math.sin(rad) * length);
      } else if (obj.endPosition) {
        endCol = obj.endPosition.col;
        endRow = obj.endPosition.row;
      } else {
        continue;
      }

      if (obj.isConnector && obj.connectorPath && obj.connectorPath.length >= 2) {
        if (isPointOnConnectorPath(obj.connectorPath, col, row)) {
          return obj;
        }
      } else if (isPointOnLine(obj.position.col, obj.position.row, endCol, endRow, col, row)) {
        return obj;
      }
    }

    else if (obj.type === 'pencil') {
      const points = obj.points || [];
      for (const point of points) {
        if (point.col === col && point.row === row) return obj;
      }
    }
  }
  return null;
}

export function compareObjectsByStackOrder(a: CanvasObject, b: CanvasObject): number {
  const layerOrderDiff = (a.layerOrder ?? 0) - (b.layerOrder ?? 0);
  if (layerOrderDiff !== 0) return layerOrderDiff;
  return a.zIndex - b.zIndex;
}

// Get resize handle
export function getResizeHandle(obj: CanvasObject, col: number, row: number): string | null {
  // Text objects don't have resize handles
  if (obj.type === 'text' || obj.type === 'pencil') return null;

  // Line/Arrow: only start and end points are resize handles - check them first
  // so we get correct handle when corners overlap (e.g. horizontal/vertical lines)
  if (obj.type === 'line' || obj.type === 'arrow') {
    let endCol: number, endRow: number;
    if (obj.rotation !== undefined) {
      const length = getLineLength(obj);
      const rad = (obj.rotation * Math.PI) / 180;
      endCol = obj.position.col + Math.round(Math.cos(rad) * length);
      endRow = obj.position.row + Math.round(Math.sin(rad) * length);
    } else if (obj.endPosition) {
      endCol = obj.endPosition.col;
      endRow = obj.endPosition.row;
    } else {
      return null;
    }
    const startCol = obj.position.col;
    const startRow = obj.position.row;
    // Prefer start/end handles - check proximity to actual line endpoints
    if (Math.abs(col - startCol) <= 1 && Math.abs(row - startRow) <= 1) {
      return 'nw'; // Start point - use nw as handle (we map it in resize logic)
    }
    if (Math.abs(col - endCol) <= 1 && Math.abs(row - endRow) <= 1) {
      return 'se'; // End point
    }
    // Fallback to bbox corners for edge cases
  }

  const bbox = getBoundingBox(obj);
  const handles = [
    { name: 'nw', col: bbox.col, row: bbox.row },
    { name: 'n', col: bbox.col + Math.floor(bbox.width / 2), row: bbox.row },
    { name: 'ne', col: bbox.col + bbox.width - 1, row: bbox.row },
    { name: 'e', col: bbox.col + bbox.width - 1, row: bbox.row + Math.floor(bbox.height / 2) },
    { name: 'se', col: bbox.col + bbox.width - 1, row: bbox.row + bbox.height - 1 },
    { name: 's', col: bbox.col + Math.floor(bbox.width / 2), row: bbox.row + bbox.height - 1 },
    { name: 'sw', col: bbox.col, row: bbox.row + bbox.height - 1 },
    { name: 'w', col: bbox.col, row: bbox.row + Math.floor(bbox.height / 2) },
  ];

  for (const handle of handles) {
    if (Math.abs(col - handle.col) <= 1 && Math.abs(row - handle.row) <= 1) {
      return handle.name;
    }
  }
  return null;
}

// Grid to string for export (y function)
export function gridToString(grid: Grid): string {
  return grid.map(row => {
    let end = row.length - 1;
    while (end >= 0 && row[end] === ' ') end--;
    return row.slice(0, end + 1).join('');
  }).join('\n');
}

// Parse string to grid
export function stringToGrid(text: string): Grid {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(line => line.length));
  return lines.map(line => {
    const chars = line.split('');
    while (chars.length < maxLength) chars.push(' ');
    return chars;
  });
}

// Calculate grid size (j function)
export function calculateGridSize(objects: CanvasObject[], currentSize: GridSize, padding: number = 20): GridSize {
  if (objects.length === 0) return currentSize;

  let maxCol = 0;
  let maxRow = 0;

  for (const obj of objects) {
    const bbox = getBoundingBox(obj);
    const right = bbox.col + bbox.width;
    const bottom = bbox.row + bbox.height;
    if (right > maxCol) maxCol = right;
    if (bottom > maxRow) maxRow = bottom;
  }

  return {
    cols: Math.min(Math.max(maxCol + padding, currentSize.cols), 2000),
    rows: Math.min(Math.max(maxRow + padding, currentSize.rows), 2000)
  };
}

// Check if object is resizable
export function isResizable(obj: CanvasObject): boolean {
  return obj.type === 'box' || obj.type === 'component' || obj.type === 'line' || obj.type === 'arrow';
}
