import React from 'react';
import type { ComponentType } from '../types';
import { COMPONENT_DEFS } from '../types';

interface SettingsModalProps {
    visibleComponents: Record<ComponentType, boolean>;
    theme: 'dark' | 'light';
    onToggleComponent: (type: ComponentType) => void;
    onThemeChange: (theme: 'dark' | 'light') => void;
    onShowAll: () => void;
    onHideAll: () => void;
    onResetDefaults: () => void;
    onClose: () => void;
}

const CATEGORIES = [
    { key: 'input', label: 'Input Components' },
    { key: 'layout', label: 'Layout Components' },
    { key: 'display', label: 'Display Components' },
] as const;

const SettingsModal: React.FC<SettingsModalProps> = ({
    visibleComponents,
    theme,
    onToggleComponent,
    onThemeChange,
    onShowAll,
    onHideAll,
    onResetDefaults,
    onClose,
}) => {
    const visibleCount = Object.values(visibleComponents).filter(Boolean).length;
    const totalCount = COMPONENT_DEFS.length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    <div>
                        <h2 className="text-sm font-semibold text-text">Settings</h2>
                        <p className="text-2xs text-text-dim mt-0.5">
                            {visibleCount}/{totalCount} components visible
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-dim hover:text-text text-lg leading-none px-1"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="text-2xs text-text-dim uppercase tracking-wider mb-3">
                        Appearance
                    </div>
                    <div className="mb-5 rounded border border-border bg-bg p-1">
                        <div className="grid grid-cols-2 gap-1">
                            <button
                                onClick={() => onThemeChange('dark')}
                                className={`rounded px-2.5 py-2 text-xs transition-colors ${theme === 'dark'
                                    ? 'bg-accent text-bg'
                                    : 'bg-transparent text-text-dim hover:bg-surface-hover hover:text-text'
                                    }`}
                            >
                                Dark
                            </button>
                            <button
                                onClick={() => onThemeChange('light')}
                                className={`rounded px-2.5 py-2 text-xs transition-colors ${theme === 'light'
                                    ? 'bg-accent text-bg'
                                    : 'bg-transparent text-text-dim hover:bg-surface-hover hover:text-text'
                                    }`}
                            >
                                Light
                            </button>
                        </div>
                    </div>

                    <div className="text-2xs text-text-dim uppercase tracking-wider mb-3">
                        Component Visibility
                    </div>

                    {CATEGORIES.map((category) => {
                        const components = COMPONENT_DEFS.filter(
                            (c) => c.category === category.key
                        );
                        return (
                            <div key={category.key} className="mb-4">
                                <div className="text-xs text-text font-medium mb-2">
                                    {category.label}
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    {components.map((comp) => {
                                        const isVisible =
                                            visibleComponents[comp.type as ComponentType];
                                        return (
                                            <button
                                                key={comp.type}
                                                onClick={() =>
                                                    onToggleComponent(comp.type as ComponentType)
                                                }
                                                className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors ${isVisible
                                                        ? 'bg-accent/15 text-text border border-accent/30'
                                                        : 'bg-bg text-text-dim border border-border hover:border-border'
                                                    }`}
                                            >
                                                <span
                                                    className={`w-4 h-4 rounded border flex items-center justify-center text-2xs transition-colors ${isVisible
                                                            ? 'bg-accent border-accent text-bg'
                                                            : 'border-border bg-bg'
                                                        }`}
                                                >
                                                    {isVisible ? '✓' : ''}
                                                </span>
                                                <span className="font-mono text-2xs w-8 shrink-0 opacity-60">
                                                    {comp.preview}
                                                </span>
                                                <span className="flex-1 truncate">{comp.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                    <div className="flex gap-2">
                        <button
                            onClick={onShowAll}
                            className="rounded border border-border bg-bg px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
                        >
                            Show All
                        </button>
                        <button
                            onClick={onHideAll}
                            className="rounded border border-border bg-bg px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
                        >
                            Hide All
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onResetDefaults}
                            className="rounded border border-border bg-bg px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
                        >
                            Reset
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded border border-accent bg-accent px-3 py-1.5 text-bg text-xs transition-colors hover:opacity-90"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
