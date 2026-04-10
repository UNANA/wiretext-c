import React from 'react';
import type { Tool, ComponentType } from '../types';
import { COMPONENT_DEFS } from '../types';

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  pendingComponent: ComponentType | null;
  setPendingComponent: (type: ComponentType | null) => void;
  visibleComponents?: Record<ComponentType, boolean>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onShowAbout?: () => void;
}

const DRAW_TOOLS: { id: Tool; label: string; shortcut?: string; icon: string; bigIcon?: boolean }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: '↖', bigIcon: true },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: '✌︎', bigIcon: true },
  { id: 'box', label: 'Box', shortcut: 'B', icon: '┌─┐', bigIcon:false },
  { id: 'text', label: 'Text', shortcut: 'T', icon: 'Aa', bigIcon:false },
  { id: 'line', label: 'Line', shortcut: 'L', icon: '───', bigIcon:false },
  { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: '──▸', bigIcon:false },
  { id: 'connector', label: 'Connector', shortcut: 'C', icon: 'o─o', bigIcon:false },
  { id: 'pencil', label: 'Pencil', shortcut: 'N', icon: 'ᝰ', bigIcon:true },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: '⌫', bigIcon:true },
];

const CATEGORIES = ['input', 'layout', 'display'] as const;

const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  pendingComponent,
  setPendingComponent,
  visibleComponents,
  collapsed = false,
  onToggleCollapse,
  onShowAbout,
}) => {
  const isToolActive = (id: Tool) => tool === id;
  const isComponentActive = (type: ComponentType) => pendingComponent === type;

  const handleComponentClick = (type: ComponentType) => {
    if (pendingComponent === type) {
      setPendingComponent(null);
    } else {
      setPendingComponent(type);
    }
  };


  // Collapsed sidebar — icons only
  if (collapsed) {
    return (
      <div className="flex w-10 flex-col border-r border-border bg-surface select-none">
        {/* Expand button */}
        <div className="flex items-center justify-center border-b border-border py-2">
          <button
            className="text-text-dim text-xs hover:text-text transition-colors"
            onClick={onToggleCollapse}
            title="Expand sidebar"
          >
            ›
          </button>
        </div>

        {/* Tool icons */}
        <div className="flex-1 overflow-y-auto">
          {/* Select + Pan */}
          <div className="p-1 flex flex-col gap-0.5">
            {DRAW_TOOLS.slice(0, 2).map((t) => (
              <button
                key={t.id}
                className={`flex w-full items-center justify-center rounded p-1.5 text-xs transition-colors ${isToolActive(t.id) && !pendingComponent
                  ? 'bg-accent text-bg'
                  : 'text-text-dim hover:bg-surface-hover hover:text-text'
                  }`}
                onClick={() => { setTool(t.id); setPendingComponent(null); }}
                title={`${t.label} (${t.shortcut})`}
              >
                {t.bigIcon ? (
                  <span className="font-mono text-text text-base">{t.icon}</span>
                ) : (
                  <span className="font-mono text-2xs">{t.icon.slice(0, 2)}</span>
                )}
              </button>
            ))}
          </div>

          <div className="mx-1 h-px bg-border" />

          {/* Draw tools */}
          <div className="p-1 flex flex-col gap-0.5">
            {DRAW_TOOLS.slice(2).map((t) => (
              <button
                key={t.id}
                className={`flex items-center justify-center rounded p-1.5 text-xs transition-colors ${isToolActive(t.id) && !pendingComponent
                  ? 'bg-accent text-bg'
                  : 'text-text-dim hover:bg-surface-hover hover:text-text'
                  }`}
                onClick={() => { setTool(t.id); setPendingComponent(null); }}
                title={`${t.label} (${t.shortcut})`}
              >
                {t.bigIcon ? (
                  <span className="font-mono text-text text-base">{t.icon}</span>
                ) : (
                  <span className="font-mono text-2xs">{t.icon.slice(0, 2)}</span>
                )}
              </button>
            ))}
          </div>

          <div className="mx-1 h-px bg-border" />

          {/* Component icons */}
          {CATEGORIES.map((category) => {
            const components = COMPONENT_DEFS.filter((c) => {
              if (c.category !== category) return false;
              if (visibleComponents && !visibleComponents[c.type as ComponentType]) return false;
              return true;
            });
            if (components.length === 0) return null;
            return (
              <div key={category} className="p-1 flex flex-col gap-0.5">
                {components.map((comp) => (
                  <button
                    key={comp.type}
                    className={`flex items-center justify-center rounded p-1.5 text-xs transition-colors ${isComponentActive(comp.type as ComponentType)
                      ? 'bg-accent text-bg'
                      : 'text-text-dim hover:bg-surface-hover hover:text-text'
                      }`}
                    onClick={() => handleComponentClick(comp.type as ComponentType)}
                    title={comp.name}
                  >
                    <span className="font-mono text-2xs">{comp.preview.slice(0, 2)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full sidebar
  return (
    <div className="flex w-44 flex-col border-r border-border bg-surface select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onShowAbout}
          className="text-2xs text-text-dim uppercase tracking-wider transition-colors hover:text-text"
          title="About WireText and shortcuts"
        >
          WireText
        </button>
        <button
          className="text-text-dim text-xs hover:text-text transition-colors"
          onClick={onToggleCollapse}
          title="Collapse sidebar (P)"
        >
          ‹
        </button>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto">
        {/* Select + Pan */}
        <div className="p-2 flex flex-col gap-0.5">
          {DRAW_TOOLS.slice(0, 2).map((t) => (
            <button
              key={t.id}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${isToolActive(t.id) && !pendingComponent
                ? 'bg-accent text-bg'
                : 'text-text-dim hover:bg-surface-hover hover:text-text'
                }`}
              onClick={() => { setTool(t.id); setPendingComponent(null); }}
            >
              <span className="w-10 shrink-0 font-mono text-2xs">{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              {t.shortcut && (
                <span className="font-mono text-2xs opacity-40">{t.shortcut}</span>
              )}
            </button>
          ))}
        </div>

        <div className="mx-2 h-px bg-border" />

        {/* Draw Tools */}
        <div className="p-2">
          <div className="text-2xs text-text-dim uppercase tracking-wider mb-2">Draw</div>
          <div className="flex flex-col gap-0.5">
            {DRAW_TOOLS.slice(2).map((t) => (
              <button
                key={t.id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${isToolActive(t.id) && !pendingComponent
                  ? 'bg-accent text-bg'
                  : 'text-text-dim hover:bg-surface-hover hover:text-text'
                  }`}
                onClick={() => { setTool(t.id); setPendingComponent(null); }}
              >
                {t.bigIcon ? (
                  <span className="w-10 shrink-0 font-mono ml-1 text-base leading-none">{t.icon}</span>
                ) : (
                  <span className="w-10 shrink-0 font-mono text-2xs">{t.icon}</span>
                )}
                <span className="flex-1">{t.label}</span>
                {t.shortcut && (
                  <span className="font-mono text-2xs opacity-40">{t.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-2 h-px bg-border" />

        {/* Component Categories */}
        {CATEGORIES.map((category) => {
          const components = COMPONENT_DEFS.filter((c) => {
            if (c.category !== category) return false;
            if (visibleComponents && !visibleComponents[c.type as ComponentType]) return false;
            return true;
          });
          if (components.length === 0) return null;
          return (
            <div key={category} className="p-2">
              <div className="text-2xs text-text-dim uppercase tracking-wider mb-2">{category}</div>
              <div className="flex flex-col gap-0.5">
                {components.map((comp) => (
                  <button
                    key={comp.type}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${isComponentActive(comp.type as ComponentType)
                      ? 'bg-accent text-bg'
                      : 'text-text-dim hover:bg-surface-hover hover:text-text'
                      }`}
                    onClick={() => handleComponentClick(comp.type as ComponentType)}
                  >
                    <span className="w-10 shrink-0 font-mono text-2xs">{comp.preview}</span>
                    <span className="flex-1">{comp.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default Toolbar;
