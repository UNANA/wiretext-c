# Repository Guidelines

## Project Structure & Module Organization

Wiretext is a React 19 + TypeScript Vite app with a Tauri 2 desktop shell. Frontend source lives in `src/`: `components/` contains canvas UI, panels, modals, toolbar, and status bar; `hooks/` contains stateful behavior such as canvas, keyboard, settings, mobile detection, and share URLs; `types/` holds shared TypeScript types; `utils/` contains rendering and canvas helpers. Static web assets and fonts are in `public/`. Tauri configuration, Rust entry points, capabilities, icons, and desktop build output live in `src-tauri/`. Do not edit generated outputs in `dist/`, `node_modules/`, or `src-tauri/target/`.

## Build, Test, and Development Commands

- `npm install`: install JavaScript dependencies.
- `npm run dev`: start the Vite dev server at `http://localhost:5173`.
- `npm run build`: create the production web build in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint.
- `npm run tauri:dev`: run the app through the Tauri desktop shell.
- `npm run tauri:build`: build desktop installers under `src-tauri/target/release/bundle/`.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and hooks. Match the existing style: semicolons, single quotes, two-space indentation, PascalCase component files such as `PropertiesPanel.tsx`, and camelCase hooks/utilities such as `useCanvas.ts` and `boxDrawing.ts`. Keep shared types in `src/types/index.ts` unless a feature-specific type is more local. Prefer small, focused components and hooks over adding more logic to `App.tsx`.

## Testing Guidelines

There is currently no test runner or test directory configured. Before submitting changes, run `npm run build` and `npm run lint`. For UI changes, manually verify the Vite app and, when relevant, `npm run tauri:dev`. If adding tests, use colocated names like `ComponentName.test.tsx` or `hookName.test.ts` and add the matching npm script.

## Commit & Pull Request Guidelines

Recent history uses concise conventional commits, for example `feat(tauri): ...`, `feat: ...`, and `fix(PropertiesPanel/LayersPanel): ...`. Follow that pattern with a clear scope when useful. Pull requests should include a short description, linked issue when applicable, verification commands run, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Check for existing generated or build artifacts before editing, and avoid touching unrelated files. Keep changes scoped to the requested behavior and preserve user work in a dirty tree.
