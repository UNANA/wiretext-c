# Wiretext

Wiretext is a Unicode-first wireframing canvas for building UI mockups and diagrams using box-drawing characters.  
Design in a visual editor, then export clean text output for docs, markdown, issues, and PRs.

## What's New

- **Smart Alignment Guides + snapping** while moving and resizing objects
- **Toggle for Smart Guides** in Settings
- **Layer grouping workflow** (`Group/Ungroup`) with better ordering controls
- **Connector tool improvements** with object anchors and routed connector paths

## Core Features

- **Drawing tools**: Select, Box, Text, Line, Arrow, Connector
- **30+ UI components**: inputs, layout blocks, display widgets, and navigation patterns
- **Layer-aware editing**: create layers from selection, move items between layers, reorder layers
- **Power editing**: marquee selection, resize handles, undo/redo, copy/cut/paste, duplicate
- **Viewport controls**: zoom and pan with a fixed canvas grid
- **Export formats**: plain text, Markdown, HTML, and GitHub-ready collapsible snippets
- **Share links**: compressed URL payloads via `lz-string`
- **Persistent preferences**: theme, sidebar state, visible component palette, smart guides toggle

## Tech Stack

- `React 19` + `TypeScript`
- `Vite 7`
- `Tailwind CSS`
- `lz-string`

## Getting Started

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

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `V` | Select tool |
| `B` | Box tool |
| `T` | Text tool |
| `L` | Line tool |
| `A` | Arrow tool |
| `C` | Connector tool |
| `P` | Toggle toolbar collapse |
| `Delete` / `Backspace` | Delete selection |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy |
| `Ctrl/Cmd + X` | Cut |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + D` | Duplicate |
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + G` | Group selection |
| `Ctrl/Cmd + Shift + G` | Ungroup to default layer |
| `]` | Bring selection forward |
| `[` | Send selection backward |
| `Cmd + ]` | Bring selection to front |
| `Cmd + [` | Send selection to back |
| `Escape` | Return to Select tool |

## Project Structure

```txt
src/
├── components/   # Canvas, toolbar, panels, modals
├── hooks/        # useCanvas, useSettings, useKeyboard, useShareUrl
├── types/        # Object, tool, and component type definitions
├── utils/        # Unicode rendering and canvas math
├── App.tsx
└── main.tsx
```

## License

MIT - see [LICENSE](LICENSE).
