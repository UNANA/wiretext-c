# Wiretext — Unicode Wireframe Design Tool

A spatial design tool where everything renders as Unicode box-drawing characters. Create wireframes, diagrams, and mockups entirely in text. Share as plain text, Markdown, or HTML.

## Features

- **Draw tools** — Box, text, line, arrow, and select
- **30+ pre-built components** — Buttons, inputs, tables, modals, cards, navbars, tabs, progress bars, dropdowns, calendars, and more
- **Full canvas** — Zoom, pan, grid snapping, marquee selection, resize handles
- **Edit operations** — Undo/redo, copy/paste/duplicate, delete
- **Export** — Plain text, Markdown, HTML, or GitHub-ready code blocks
- **Share** — Compressed URL links (LZ-string) to share designs

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 7**
- **Tailwind CSS**
- **lz-string** — URL compression for sharing

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or bun

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select tool |
| `B` | Box tool |
| `T` | Text tool |
| `L` | Line tool |
| `A` | Arrow tool |
| `P` | Toggle sidebar |
| `Delete` / `Backspace` | Delete selection |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + D` | Duplicate |
| `Escape` | Cancel / Select tool |

## Project Structure

```
src/
├── components/     # Toolbar, Canvas, PropertiesPanel, StatusBar, etc.
├── hooks/          # useCanvas, useKeyboard, useSettings, useShareUrl
├── utils/          # boxDrawing — Unicode rendering logic
├── types/          # TypeScript types and component definitions
├── App.tsx
└── main.tsx
```

## License

MIT — see [LICENSE](LICENSE).
