'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ themeMode: 'light', toggleTheme: () => {} });

export function ThemeProvider({ children }) {
    const [themeMode, setThemeMode] = useState('light');

    useEffect(() => {
        const saved = localStorage.getItem('themeMode');
        const initial = saved === 'dark' || saved === 'light' ? saved : 'light';
        setThemeMode(initial);
        document.documentElement.dataset.theme = initial;
        document.documentElement.style.colorScheme = initial;

        const onStorage = (e) => {
            if (e.key === 'themeMode' && (e.newValue === 'dark' || e.newValue === 'light')) {
                setThemeMode(e.newValue);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = themeMode;
        document.documentElement.style.colorScheme = themeMode;
        localStorage.setItem('themeMode', themeMode);
    }, [themeMode]);

    const toggleTheme = () => setThemeMode(t => t === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ themeMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
