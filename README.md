# Wiretext

Wiretext is a Unicode-first wireframing canvas for building UI mockups and diagrams with box-drawing characters.
Design visually, then export clean text for docs, markdown, issues, and PRs.

**Current release: v1.0.4**

## v1.0.4

- **Pan tool (`H`)**: Dedicated pan mode to drag the viewport without editing objects; works alongside Select (`V`).
- **Multi-select group resize**: When several boxes or components are selected, shared edges, corners, and a center handle let you resize the group proportionally instead of one object at a time.
- **Context menus**: Right-click the canvas or a selection for paste, select all, copy/cut, layer ordering, grouping, and related actions.
- **Keyboard refinements**: Arrow keys nudge the selection; `P` toggles the left sidebar (tools and components). Open **About** from the toolbar for the full shortcut list.
- **Mobile and narrow screens**: On small viewports or touch-primary devices, Wiretext shows a clear desktop-only message instead of a broken layout.
- **Status bar**: Quick link to the project on GitHub plus cursor, active tool, zoom, and selection summary.

Fixes and polish in this cycle include clearer layer/inspector labeling for connectors vs. plain lines and smoother canvas/view behavior during resize and interaction.

## Core features

- **Drawing tools**: Select, Pan, Box, Text, Line, Arrow, Connector, Pencil, Eraser
- **Drawer-style ideation**: Sketch with Pencil and clean up with Eraser
- **30+ UI components**: input, layout, and display building blocks
- **Layer-aware editing**: create layers from selection, move items between layers, reorder layers, group/ungroup
- **Alignment**: smart guides and snapping while moving and resizing (toggle in Settings)
- **Power editing**: marquee select, resize handles, multi-selection group resize, undo/redo, copy/cut/paste, duplicate
- **Connectors**: object anchors and routed connector paths
- **Export formats**: plain text, Markdown, HTML, and GitHub-ready collapsible snippets
- **Share links**: compressed URL payloads via `lz-string`
- **Persistent preferences**: theme, sidebar state, component visibility, smart guides

## Tech stack

- `React 19` + `TypeScript`
- `Vite 7`
- `Tailwind CSS`
- `lz-string`
- `Tauri 2`

## Getting started

### Prerequisites

- Node.js 18+
- npm (or your preferred package manager)

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Run as a desktop app

```bash
npm run tauri:dev
```

### Build

```bash
npm run build
```

### Build desktop installers

```bash
npm run tauri:build
```

Windows bundles are generated under `src-tauri/target/release/bundle/`.

### Preview build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` | Select tool |
| `H` | Pan tool |
| `B` | Box tool |
| `T` | Text tool |
| `L` | Line tool |
| `A` | Arrow tool |
| `C` | Connector tool |
| `N` | Pencil tool |
| `E` | Eraser tool |
| `P` | Toggle left sidebar |
| `↑` `↓` `←` `→` | Nudge selection |
| `Delete` / `Backspace` | Delete selection |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy |
| `Ctrl/Cmd + X` | Cut |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + D` | Duplicate |
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + G` | Group selection / ungroup (when applicable) |
| `Ctrl/Cmd + Shift + G` | Ungroup to default layer |
| `]` | Bring selection forward |
| `[` | Send selection backward |
| `Cmd + ]` | Bring selection to front |
| `Cmd + [` | Send selection to back |
| `Escape` | Return to Select tool |

Export, Share, Clear, and Settings are available from the top-right action buttons on the canvas.

## Project structure

```txt
src/
├── components/   # Canvas, toolbar, panels, modals
├── hooks/        # useCanvas, useSettings, useKeyboard, useShareUrl, useIsMobile
├── types/        # Tool/object/component definitions
├── utils/        # Unicode rendering and canvas math
├── App.tsx
└── main.tsx
```

## License

MIT - see [LICENSE](LICENSE).
