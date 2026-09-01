import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NotificationProvider } from '@/context/NotificationContext';
import { ThemeProvider } from '@/context/ThemeContext';

export const AppLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pesage_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('pesage_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <ThemeProvider>
      <NotificationProvider>
        <div className="h-screen w-screen bg-app-bg text-app-text flex overflow-hidden font-sans transition-colors duration-200">
          {/* Mobile Backdrop Overlay */}
          {mobileSidebarOpen && (
            <div
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-xs lg:hidden"
            />
          )}

          {/* Fixed Independent Sidebar */}
          <Sidebar
            isOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />

          {/* Main ERP Shell Viewport Area */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            {/* Fixed Independent Topbar */}
            <TopBar
              onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebarCollapse={toggleSidebarCollapse}
            />

            {/* Main Business Scrollable Viewport (Single Vertical Scroll Container) */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-app-bg space-y-6">
              <Outlet />
            </main>
          </div>
        </div>
      </NotificationProvider>
    </ThemeProvider>
  );
};
