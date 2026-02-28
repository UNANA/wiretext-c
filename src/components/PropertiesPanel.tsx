import React from 'react';
import type { Tool, Position, BoxStyle, CanvasObject, ConnectorHeadStyle } from '../types';

interface PropertiesPanelProps {
  tool: Tool;
  cursor: Position;
  selectedObjects: CanvasObject[];
  objectsCount: number;
  onUpdateObject?: (id: string, updates: Partial<CanvasObject>) => void;
}

const STYLE_OPTIONS: { value: BoxStyle; label: string; preview: string }[] = [
  { value: 'single', label: 'Single', preview: '┌─┐' },
  { value: 'double', label: 'Double', preview: '╔═╗' },
  { value: 'rounded', label: 'Rounded', preview: '╭─╮' },
  { value: 'heavy', label: 'Heavy', preview: '┏━┓' },
];

const FILL_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'transparent', label: 'Clear' },
] as const;

const CONNECTOR_HEAD_OPTIONS: { value: ConnectorHeadStyle; label: string }[] = [
  { value: 'arrow', label: 'Arrow' },
  { value: 'line', label: 'Line' },
  { value: 'dot', label: 'Dot' },
];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  tool,
  cursor,
  selectedObjects,
  objectsCount,
  onUpdateObject,
}) => {
  const toolLabels: Record<Tool, string> = {
    select: 'Select',
    box: 'Box',
    text: 'Text',
    line: 'Line',
    arrow: 'Arrow',
    connector: 'Connector',
  };

  return (
    <div className="flex h-full flex-col bg-surface p-3 overflow-y-auto select-none">
      <h3 className="text-2xs text-text-dim uppercase tracking-wider mb-3">Properties</h3>

      <div className="space-y-3 text-xs">
        <div className="flex justify-between">
          <span className="text-text-dim">Tool</span>
          <span className="text-text">{toolLabels[tool]}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-dim">Cursor</span>
          <span className="text-text font-mono">{cursor.col},{cursor.row}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-dim">Objects</span>
          <span className="text-text font-mono">{objectsCount}</span>
        </div>

        {selectedObjects.length === 1 && onUpdateObject && (
          <>
            <div className="h-px bg-border my-2" />
            <SingleObjectProperties
              obj={selectedObjects[0]}
              onUpdateObject={onUpdateObject}
            />
          </>
        )}

        {selectedObjects.length > 1 && (
          <>
            <div className="h-px bg-border my-2" />
            <div className="text-2xs text-text-dim uppercase tracking-wider mb-2">
              {selectedObjects.length} objects selected
            </div>
          </>
        )}

      </div>
    </div>
  );
};

interface SingleObjectPropertiesProps {
  obj: CanvasObject;
  onUpdateObject: (id: string, updates: Partial<CanvasObject>) => void;
}

const SingleObjectProperties: React.FC<SingleObjectPropertiesProps> = ({
  obj,
  onUpdateObject,
}) => {
  // Real-time updates - no local state needed, update parent directly

  const canHaveBorder = obj.type === 'box' || obj.type === 'component';
  const canHaveFill = obj.type === 'box' || obj.type === 'component';
  const canHaveLabel = obj.type === 'box' || obj.type === 'component';
  const isText = obj.type === 'text';
  const isLine = obj.type === 'line';
  const isArrow = obj.type === 'arrow';
  const isConnector = isLine && obj.isConnector;
  const canRotate = (isLine && !obj.isConnector) || isArrow;
  const isCheckbox = obj.componentType === 'checkbox';
  const isRadio = obj.componentType === 'radio';
  const isProgress = obj.componentType === 'progress';
  const isTable = obj.componentType === 'table';
  const isNavbar = obj.componentType === 'navbar';
  const isTabs = obj.componentType === 'tabs';
  const isSlider = obj.componentType === 'slider';
  const isToggle = obj.componentType === 'toggle';
  const isAccordion = obj.componentType === 'accordion';
  const isSidebar = obj.componentType === 'sidebar';
  const isBadge = obj.componentType === 'badge';
  const isBreadcrumb = obj.componentType === 'breadcrumb';
  const isDropdown = obj.componentType === 'dropdown';
  const isStepper = obj.componentType === 'stepper';
  const isList = obj.componentType === 'list';
  const isTooltip = obj.componentType === 'tooltip';
  const isTag = obj.componentType === 'tag';
  const isPagination = obj.componentType === 'pagination';

  return (
    <div className="space-y-4">
      <div className="text-2xs text-text-dim uppercase tracking-wider mb-2">Selected Object</div>

      {/* Type */}
      <div className="flex justify-between items-center">
        <span className="text-text-dim">Type</span>
        <span className="text-text capitalize">
          {obj.componentType || obj.type}
        </span>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-2xs text-text-dim mb-1">Column</label>
          <input
            type="number"
            value={obj.position.col}
            disabled={isConnector}
            onChange={(e) => onUpdateObject(obj.id, {
              position: { ...obj.position, col: parseInt(e.target.value) || 0 }
            })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:select-none"
          />
        </div>
        <div>
          <label className="block text-2xs text-text-dim mb-1">Row</label>
          <input
            type="number"
            value={obj.position.row}
            disabled={isConnector}
            onChange={(e) => onUpdateObject(obj.id, {
              position: { ...obj.position, row: parseInt(e.target.value) || 0 }
            })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:select-none"
          />
        </div>
      </div>

      {/* Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-2xs text-text-dim mb-1">Width</label>
          <input
            type="number"
            min={isText ? 1 : 3}
            value={obj.width}
            disabled={isConnector}
            onChange={(e) => onUpdateObject(obj.id, { width: Math.max(isText ? 1 : 3, parseInt(e.target.value) || (isText ? 1 : 3)) })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:select-none"
          />
        </div>
        <div>
          <label className="block text-2xs text-text-dim mb-1">Height</label>
          <input
            type="number"
            min={isText ? 1 : 3}
            value={obj.height}
            disabled={isConnector}
            onChange={(e) => onUpdateObject(obj.id, { height: Math.max(isText ? 1 : 3, parseInt(e.target.value) || (isText ? 1 : 3)) })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:select-none"
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-text-dim">Layer</span>
        <span className="text-text">{obj.layerName || 'Layer 1'}</span>
      </div>

      {/* Rotation - for lines/arrows (full 360° + continuous rotation) */}
      {canRotate && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Rotation (degrees)</label>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={0}
              max={720}
              value={Math.min(720, Math.max(0, obj.rotation ?? 0))}
              onChange={(e) => onUpdateObject(obj.id, { rotation: parseInt(e.target.value) || 0 })}
              className="flex-1 accent-accent"
            />
            <input
              type="number"
              min={0}
              max={720}
              value={obj.rotation ?? 0}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) onUpdateObject(obj.id, { rotation: Math.min(720, Math.max(0, v)) });
              }}
              className="w-14 bg-bg border border-border rounded px-2 py-1 text-xs text-text text-right focus:border-accent outline-none"
            />
            <span className="text-xs text-text-dim">°</span>
          </div>
        </div>
      )}

      {/* Connector heads */}
      {isConnector && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-2xs text-text-dim mb-1">From head</label>
            <select
              value={obj.connectorFromHead ?? 'line'}
              onChange={(e) => onUpdateObject(obj.id, { connectorFromHead: e.target.value as ConnectorHeadStyle })}
              className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
            >
              {CONNECTOR_HEAD_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-2xs text-text-dim mb-1">To head</label>
            <select
              value={obj.connectorToHead ?? 'line'}
              onChange={(e) => onUpdateObject(obj.id, { connectorToHead: e.target.value as ConnectorHeadStyle })}
              className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
            >
              {CONNECTOR_HEAD_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Border Style */}
      {canHaveBorder && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Border Style</label>
          <div className="flex gap-1">
            {STYLE_OPTIONS.map(style => (
              <button
                key={style.value}
                onClick={() => onUpdateObject(obj.id, { borderStyle: style.value })}
                className={`flex-1 py-1 px-2 rounded text-xs font-mono transition-colors ${obj.borderStyle === style.value
                  ? 'bg-accent text-bg'
                  : 'bg-surface-hover text-text-dim hover:text-text'
                  }`}
                title={style.label}
              >
                {style.preview}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill */}
      {canHaveFill && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Fill</label>
          <div className="flex gap-1">
            {FILL_OPTIONS.map(fill => (
              <button
                key={fill.value}
                onClick={() => onUpdateObject(obj.id, { fill: fill.value })}
                className={`flex-1 py-1 px-2 rounded text-xs transition-colors ${(obj.fill || 'solid') === fill.value
                  ? 'bg-accent text-bg'
                  : 'bg-surface-hover text-text-dim hover:text-text'
                  }`}
              >
                {fill.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Label */}
      {canHaveLabel && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Label</label>
          <input
            type="text"
            value={obj.label || ''}
            onChange={(e) => onUpdateObject(obj.id, { label: e.target.value || undefined })}
            placeholder="Enter label..."
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
      )}

      {/* Text Content */}
      {isText && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Content</label>
          <textarea
            value={obj.content || ''}
            onChange={(e) => onUpdateObject(obj.id, { content: e.target.value })}
            rows={3}
            placeholder="Enter text..."
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none resize-none"
          />
        </div>
      )}

      {/* Checkbox State */}
      {isCheckbox && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">State</label>
          <button
            onClick={() => onUpdateObject(obj.id, { checked: !obj.checked })}
            className={`w-full py-1 px-2 rounded text-xs transition-colors ${obj.checked
              ? 'bg-accent text-bg'
              : 'bg-surface-hover text-text-dim hover:text-text'
              }`}
          >
            {obj.checked ? '☑ Checked' : '☐ Unchecked'}
          </button>
        </div>
      )}

      {/* Radio State */}
      {isRadio && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">State</label>
          <button
            onClick={() => onUpdateObject(obj.id, { checked: !obj.checked })}
            className={`w-full py-1 px-2 rounded text-xs transition-colors ${obj.checked
              ? 'bg-accent text-bg'
              : 'bg-surface-hover text-text-dim hover:text-text'
              }`}
          >
            {obj.checked ? '◉ Selected' : '○ Unselected'}
          </button>
        </div>
      )}

      {/* Progress */}
      {isProgress && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Progress ({obj.progress || 40}%)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={obj.progress || 40}
            onChange={(e) => onUpdateObject(obj.id, { progress: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>
      )}

      {/* Table Columns */}
      {isTable && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Columns</label>
          <div className="space-y-1">
            {(obj.columns || ['Col A', 'Col B']).map((col, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={col}
                  onChange={(e) => {
                    const newCols = [...(obj.columns || ['Col A', 'Col B'])];
                    newCols[idx] = e.target.value;
                    onUpdateObject(obj.id, { columns: newCols });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.columns || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newCols = [...(obj.columns || [])];
                      newCols.splice(idx, 1);
                      onUpdateObject(obj.id, { columns: newCols });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newCols = [...(obj.columns || [])];
                newCols.push(`Col ${String.fromCharCode(65 + newCols.length)}`);
                onUpdateObject(obj.id, { columns: newCols });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Column
            </button>
          </div>
        </div>
      )}

      {/* Navbar Items */}
      {isNavbar && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Nav Items</label>
          <div className="space-y-1">
            {(obj.navItems || ['Home', 'About', 'Contact']).map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(obj.navItems || [])];
                    newItems[idx] = e.target.value;
                    onUpdateObject(obj.id, { navItems: newItems });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.navItems || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = [...(obj.navItems || [])];
                      newItems.splice(idx, 1);
                      onUpdateObject(obj.id, { navItems: newItems });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(obj.navItems || [])];
                newItems.push(`Item ${newItems.length + 1}`);
                onUpdateObject(obj.id, { navItems: newItems });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Item
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isTabs && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Tabs</label>
          <div className="space-y-1">
            {(obj.tabs || ['Tab 1', 'Tab 2', 'Tab 3']).map((tab, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={tab}
                  onChange={(e) => {
                    const newTabs = [...(obj.tabs || [])];
                    newTabs[idx] = e.target.value;
                    onUpdateObject(obj.id, { tabs: newTabs });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.tabs || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newTabs = [...(obj.tabs || [])];
                      newTabs.splice(idx, 1);
                      onUpdateObject(obj.id, { tabs: newTabs });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newTabs = [...(obj.tabs || [])];
                newTabs.push(`Tab ${newTabs.length + 1}`);
                onUpdateObject(obj.id, { tabs: newTabs });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Tab
            </button>
          </div>
        </div>
      )}

      {/* Slider */}
      {isSlider && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Value ({obj.sliderValue || 40}%)</label>
          <input
            type="range"
            min={0}
            max={100}
            value={obj.sliderValue || 40}
            onChange={(e) => onUpdateObject(obj.id, { sliderValue: parseInt(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>
      )}

      {/* Toggle */}
      {isToggle && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">State</label>
          <button
            onClick={() => onUpdateObject(obj.id, { toggled: !obj.toggled })}
            className={`w-full py-1 px-2 rounded text-xs transition-colors ${obj.toggled
              ? 'bg-accent text-bg'
              : 'bg-surface-hover text-text-dim hover:text-text'
              }`}
          >
            {obj.toggled ? '● On' : '○ Off'}
          </button>
        </div>
      )}

      {/* Accordion Items */}
      {isAccordion && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Sections</label>
          <div className="space-y-1">
            {(obj.accordionItems || ['Section 1', 'Section 2', 'Section 3']).map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(obj.accordionItems || [])];
                    newItems[idx] = e.target.value;
                    onUpdateObject(obj.id, { accordionItems: newItems });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.accordionItems || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = [...(obj.accordionItems || [])];
                      newItems.splice(idx, 1);
                      onUpdateObject(obj.id, { accordionItems: newItems });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(obj.accordionItems || [])];
                newItems.push(`Section ${newItems.length + 1}`);
                onUpdateObject(obj.id, { accordionItems: newItems });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Section
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Items */}
      {isSidebar && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Menu Items</label>
          <div className="space-y-1">
            {(obj.sidebarItems || ['Home', 'Profile', 'Settings']).map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(obj.sidebarItems || [])];
                    newItems[idx] = e.target.value;
                    onUpdateObject(obj.id, { sidebarItems: newItems });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.sidebarItems || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = [...(obj.sidebarItems || [])];
                      newItems.splice(idx, 1);
                      onUpdateObject(obj.id, { sidebarItems: newItems });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(obj.sidebarItems || [])];
                newItems.push(`Item ${newItems.length + 1}`);
                onUpdateObject(obj.id, { sidebarItems: newItems });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Item
            </button>
          </div>
        </div>
      )}

      {/* Badge Text */}
      {isBadge && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Badge Text</label>
          <input
            type="text"
            value={obj.badgeText || '1'}
            onChange={(e) => onUpdateObject(obj.id, { badgeText: e.target.value })}
            placeholder="99+"
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
      )}

      {/* Breadcrumb Items */}
      {isBreadcrumb && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Breadcrumb</label>
          <div className="space-y-1">
            {(obj.breadcrumbItems || ['Home', 'Page', 'Sub']).map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(obj.breadcrumbItems || [])];
                    newItems[idx] = e.target.value;
                    onUpdateObject(obj.id, { breadcrumbItems: newItems });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.breadcrumbItems || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = [...(obj.breadcrumbItems || [])];
                      newItems.splice(idx, 1);
                      onUpdateObject(obj.id, { breadcrumbItems: newItems });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(obj.breadcrumbItems || [])];
                newItems.push(`Page ${newItems.length + 1}`);
                onUpdateObject(obj.id, { breadcrumbItems: newItems });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Item
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Items */}
      {isDropdown && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Options</label>
          <div className="space-y-1">
            {(obj.dropdownItems || ['Option 1', 'Option 2', 'Option 3']).map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(obj.dropdownItems || [])];
                    newItems[idx] = e.target.value;
                    onUpdateObject(obj.id, { dropdownItems: newItems });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.dropdownItems || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = [...(obj.dropdownItems || [])];
                      newItems.splice(idx, 1);
                      onUpdateObject(obj.id, { dropdownItems: newItems });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(obj.dropdownItems || [])];
                newItems.push(`Option ${newItems.length + 1}`);
                onUpdateObject(obj.id, { dropdownItems: newItems });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Option
            </button>
          </div>
        </div>
      )}

      {/* Stepper */}
      {isStepper && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Value ({obj.stepperValue ?? 0})</label>
          <input
            type="number"
            value={obj.stepperValue ?? 0}
            onChange={(e) => onUpdateObject(obj.id, { stepperValue: parseInt(e.target.value) || 0 })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
      )}

      {/* List Items */}
      {isList && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Items</label>
          <div className="mb-2">
            <button
              onClick={() => onUpdateObject(obj.id, { listOrdered: !obj.listOrdered })}
              className={`w-full py-1 px-2 rounded text-xs transition-colors ${obj.listOrdered
                ? 'bg-accent text-bg'
                : 'bg-surface-hover text-text-dim hover:text-text'
                }`}
            >
              {obj.listOrdered ? '1. Ordered' : '• Unordered'}
            </button>
          </div>
          <div className="space-y-1">
            {(obj.listItems || ['Item 1', 'Item 2', 'Item 3']).map((item, idx) => (
              <div key={idx} className="flex gap-1">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(obj.listItems || [])];
                    newItems[idx] = e.target.value;
                    onUpdateObject(obj.id, { listItems: newItems });
                  }}
                  className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
                />
                {(obj.listItems || []).length > 1 && (
                  <button
                    onClick={() => {
                      const newItems = [...(obj.listItems || [])];
                      newItems.splice(idx, 1);
                      onUpdateObject(obj.id, { listItems: newItems });
                    }}
                    className="px-2 text-text-dim hover:text-text"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(obj.listItems || [])];
                newItems.push(`Item ${newItems.length + 1}`);
                onUpdateObject(obj.id, { listItems: newItems });
              }}
              className="w-full py-1 px-2 rounded text-xs bg-surface-hover text-text-dim hover:text-text transition-colors"
            >
              + Add Item
            </button>
          </div>
        </div>
      )}

      {/* Tooltip Text */}
      {isTooltip && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Tooltip Text</label>
          <input
            type="text"
            value={obj.tooltipText || 'Tooltip'}
            onChange={(e) => onUpdateObject(obj.id, { tooltipText: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
      )}

      {/* Tag Text */}
      {isTag && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Tag Text</label>
          <input
            type="text"
            value={obj.tagText || 'Tag'}
            onChange={(e) => onUpdateObject(obj.id, { tagText: e.target.value })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
      )}

      {/* Pagination */}
      {isPagination && (
        <div>
          <label className="block text-2xs text-text-dim mb-1">Current Page ({obj.currentPage ?? 1})</label>
          <input
            type="range"
            min={1}
            max={obj.totalPages ?? 5}
            value={obj.currentPage ?? 1}
            onChange={(e) => onUpdateObject(obj.id, { currentPage: parseInt(e.target.value) })}
            className="w-full accent-accent mb-2"
          />
          <label className="block text-2xs text-text-dim mb-1">Total Pages</label>
          <input
            type="number"
            min={1}
            max={20}
            value={obj.totalPages ?? 5}
            onChange={(e) => onUpdateObject(obj.id, { totalPages: parseInt(e.target.value) || 5 })}
            className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
          />
        </div>
      )}

      {/* Annotation */}
      <div>
        <label className="block text-2xs text-text-dim mb-1">Annotation</label>
        <input
          type="text"
          value={obj.annotation || ''}
          onChange={(e) => onUpdateObject(obj.id, { annotation: e.target.value || undefined })}
          placeholder="Add note..."
          className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:border-accent outline-none"
        />
      </div>

      {/* ID (read-only) */}
      <div className="pt-2 border-t border-border">
        <span className="text-3xs text-text-dim">ID: {obj.id}</span>
      </div>
    </div>
  );
};

export default PropertiesPanel;
