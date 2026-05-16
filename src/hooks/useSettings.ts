import { useState, useCallback, useEffect } from 'react';
import type { ComponentType } from '../types';
import { COMPONENT_DEFS } from '../types';

const STORAGE_KEY = 'wiretext-settings';

type ComponentVisibility = Record<ComponentType, boolean>;
type Theme = 'dark' | 'light';

interface Settings {
    visibleComponents: ComponentVisibility;
    sidebarCollapsed: boolean;
    theme: Theme;
    smartGuidesEnabled: boolean;
    zoomMode: 'scroll' | 'zoom';
}

const DEFAULT_VISIBLE: Set<ComponentType> = new Set([
    'button', 'input', 'select', 'checkbox', 'radio',
    'table', 'modal', 'browser', 'card',
    'navbar', 'tabs', 'progress',
]);

function getDefaultVisibility(): ComponentVisibility {
    const visibility = {} as ComponentVisibility;
    for (const def of COMPONENT_DEFS) {
        visibility[def.type as ComponentType] = DEFAULT_VISIBLE.has(def.type as ComponentType);
    }
    return visibility;
}

function getAllVisible(): ComponentVisibility {
    const visibility = {} as ComponentVisibility;
    for (const def of COMPONENT_DEFS) {
        visibility[def.type as ComponentType] = true;
    }
    return visibility;
}


function getDefaultSettings(): Settings {
    return {
        visibleComponents: getDefaultVisibility(),
        sidebarCollapsed: false,
        theme: 'dark',
        smartGuidesEnabled: true,
        zoomMode: 'scroll',
    };
}

function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<Settings>;
            const defaults = getDefaultSettings();
            return {
                visibleComponents: {
                    ...defaults.visibleComponents,
                    ...(parsed.visibleComponents || {}),
                },
                sidebarCollapsed: parsed.sidebarCollapsed ?? false,
                theme: parsed.theme === 'light' ? 'light' : 'dark',
                smartGuidesEnabled: parsed.smartGuidesEnabled ?? true,
                zoomMode: parsed.zoomMode === 'zoom' ? 'zoom' : 'scroll',
            };
        }
    } catch {
        // Ignore parse errors
    }
    return getDefaultSettings();
}

function saveSettings(settings: Settings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Ignore storage errors
    }
}

export function useSettings() {
    const [settings, setSettings] = useState<Settings>(loadSettings);

    useEffect(() => {
        saveSettings(settings);
    }, [settings]);

    const toggleComponent = useCallback((type: ComponentType) => {
        setSettings((prev) => ({
            ...prev,
            visibleComponents: {
                ...prev.visibleComponents,
                [type]: !prev.visibleComponents[type],
            },
        }));
    }, []);

    const showAll = useCallback(() => {
        setSettings((prev) => ({
            ...prev,
            visibleComponents: getAllVisible(),
        }));
    }, []);

    const hideAll = useCallback(() => {
        setSettings((prev) => {
            const hidden = {} as ComponentVisibility;
            for (const def of COMPONENT_DEFS) {
                hidden[def.type as ComponentType] = false;
            }
            return { ...prev, visibleComponents: hidden };
        });
    }, []);

    const resetDefaults = useCallback(() => {
        setSettings(getDefaultSettings());
    }, []);

    const toggleSidebar = useCallback(() => {
        setSettings((prev) => ({
            ...prev,
            sidebarCollapsed: !prev.sidebarCollapsed,
        }));
    }, []);

    const setTheme = useCallback((theme: Theme) => {
        setSettings((prev) => ({
            ...prev,
            theme,
        }));
    }, []);

    const setSmartGuidesEnabled = useCallback((enabled: boolean) => {
        setSettings((prev) => ({
            ...prev,
            smartGuidesEnabled: enabled,
        }));
    }, []);

    const setZoomMode = useCallback((zoomMode: 'scroll' | 'zoom') => {
        setSettings((prev) => ({
            ...prev,
            zoomMode,
        }));
    }, []);

    return {
        visibleComponents: settings.visibleComponents,
        sidebarCollapsed: settings.sidebarCollapsed,
        theme: settings.theme,
        smartGuidesEnabled: settings.smartGuidesEnabled,
        zoomMode: settings.zoomMode,
        toggleComponent,
        showAll,
        hideAll,
        resetDefaults,
        toggleSidebar,
        setTheme,
        setSmartGuidesEnabled,
        setZoomMode,
    };
}
