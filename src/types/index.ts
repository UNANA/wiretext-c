export type BoxStyle = 'single' | 'double' | 'rounded' | 'heavy';

export type Tool =
  | 'select'
  | 'box'
  | 'text'
  | 'line'
  | 'arrow';

export type ComponentType =
  | 'button'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'table'
  | 'modal'
  | 'browser'
  | 'card'
  | 'navbar'
  | 'tabs'
  | 'progress'
  | 'textarea'
  | 'slider'
  | 'toggle'
  | 'accordion'
  | 'sidebar'
  | 'avatar'
  | 'badge'
  | 'breadcrumb'
  | 'dropdown'
  | 'search'
  | 'stepper'
  | 'calendar'
  | 'list'
  | 'divider'
  | 'tooltip'
  | 'tag'
  | 'spinner'
  | 'pagination';

export type ObjectType =
  | 'box'
  | 'text'
  | 'line'
  | 'arrow'
  | 'component';

export interface Position {
  col: number;
  row: number;
}

export interface CanvasObject {
  id: string;
  type: ObjectType;
  position: Position;
  width: number;
  height: number;
  zIndex: number;

  // For box/component
  borderStyle?: BoxStyle;
  fill?: 'solid' | 'transparent';
  label?: string;

  // For text
  content?: string;

  // For line/arrow
  endPosition?: Position;
  rotation?: number; // Rotation in degrees (0-360) for lines/arrows

  // For component
  componentType?: ComponentType;
  checked?: boolean;
  progress?: number;
  columns?: string[];
  navItems?: string[];
  tabs?: string[];
  sliderValue?: number;
  toggled?: boolean;
  accordionItems?: string[];
  sidebarItems?: string[];
  breadcrumbItems?: string[];
  badgeText?: string;
  dropdownItems?: string[];
  stepperValue?: number;
  listItems?: string[];
  listOrdered?: boolean;
  tooltipText?: string;
  tagText?: string;
  currentPage?: number;
  totalPages?: number;

  // For annotation
  annotation?: string;
}

export interface GridSize {
  cols: number;
  rows: number;
}

export type Grid = string[][];

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (event: KeyboardEvent) => void;
}

export type DragState =
  | { type: 'none' }
  | { type: 'drawing'; startCol: number; startRow: number; tool: Tool }
  | { type: 'moving'; objectId: string; offsetCol: number; offsetRow: number }
  | { type: 'resizing'; objectId: string; handle: ResizeHandle };

export type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w' | 'e'
  | 'sw' | 's' | 'se';

export const COMPONENT_DEFS = [
  { type: 'button', name: 'Button', preview: '[ OK ]', category: 'input', defaultWidth: 12, defaultHeight: 3 },
  { type: 'input', name: 'Input', preview: '[____]', category: 'input', defaultWidth: 20, defaultHeight: 3 },
  { type: 'select', name: 'Select', preview: '[▾  ]', category: 'input', defaultWidth: 20, defaultHeight: 3 },
  { type: 'checkbox', name: 'Checkbox', preview: '[✓] ', category: 'input', defaultWidth: 20, defaultHeight: 3 },
  { type: 'radio', name: 'Radio', preview: '(●) ', category: 'input', defaultWidth: 20, defaultHeight: 3 },
  { type: 'table', name: 'Table', preview: '┌─┬─┐', category: 'layout', defaultWidth: 24, defaultHeight: 8 },
  { type: 'modal', name: 'Modal', preview: '[×] ', category: 'layout', defaultWidth: 30, defaultHeight: 15 },
  { type: 'browser', name: 'Browser', preview: '◄►⟳ ', category: 'layout', defaultWidth: 40, defaultHeight: 20 },
  { type: 'card', name: 'Card', preview: '┌───┐', category: 'layout', defaultWidth: 20, defaultHeight: 10 },
  { type: 'navbar', name: 'Navbar', preview: '≡ ── ', category: 'display', defaultWidth: 40, defaultHeight: 3 },
  { type: 'tabs', name: 'Tabs', preview: '┌┐┌┐ ', category: 'display', defaultWidth: 30, defaultHeight: 3 },
  { type: 'progress', name: 'Progress', preview: '▓░░░ ', category: 'display', defaultWidth: 20, defaultHeight: 3 },
  { type: 'textarea', name: 'Textarea', preview: '[≡≡≡]', category: 'input', defaultWidth: 20, defaultHeight: 6 },
  { type: 'slider', name: 'Slider', preview: '─●───', category: 'input', defaultWidth: 20, defaultHeight: 3 },
  { type: 'toggle', name: 'Toggle', preview: '[●○ ]', category: 'input', defaultWidth: 12, defaultHeight: 3 },
  { type: 'accordion', name: 'Accordion', preview: '▸ ── ', category: 'layout', defaultWidth: 30, defaultHeight: 10 },
  { type: 'sidebar', name: 'Sidebar', preview: '│ ≡ │', category: 'layout', defaultWidth: 20, defaultHeight: 20 },
  { type: 'avatar', name: 'Avatar', preview: ' (◉) ', category: 'display', defaultWidth: 6, defaultHeight: 3 },
  { type: 'badge', name: 'Badge', preview: '[99+]', category: 'display', defaultWidth: 8, defaultHeight: 3 },
  { type: 'breadcrumb', name: 'Breadcrumb', preview: '▸ / ▸', category: 'display', defaultWidth: 30, defaultHeight: 3 },
  { type: 'dropdown', name: 'Dropdown', preview: '▾ ──', category: 'input', defaultWidth: 20, defaultHeight: 8 },
  { type: 'search', name: 'Search', preview: '🔍___', category: 'input', defaultWidth: 24, defaultHeight: 3 },
  { type: 'stepper', name: 'Stepper', preview: '[-1+]', category: 'input', defaultWidth: 14, defaultHeight: 3 },
  { type: 'calendar', name: 'Calendar', preview: '📅───', category: 'layout', defaultWidth: 22, defaultHeight: 10 },
  { type: 'list', name: 'List', preview: '• ── ', category: 'layout', defaultWidth: 20, defaultHeight: 8 },
  { type: 'divider', name: 'Divider', preview: '─────', category: 'display', defaultWidth: 30, defaultHeight: 1 },
  { type: 'tooltip', name: 'Tooltip', preview: '◁tip▷', category: 'display', defaultWidth: 16, defaultHeight: 3 },
  { type: 'tag', name: 'Tag', preview: '〖tag〗', category: 'display', defaultWidth: 10, defaultHeight: 3 },
  { type: 'spinner', name: 'Spinner', preview: '🔄', category: 'display', defaultWidth: 8, defaultHeight: 3 },
  { type: 'pagination', name: 'Pagination', preview: '‹1 2›', category: 'display', defaultWidth: 24, defaultHeight: 3 },
] as const;
