'use client';

import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminSubSidebar from './AdminSubSidebar';
import AdminNotifier from './AdminNotifier';
import AdminTopBar from './AdminTopBar';
import SessionExpiryWarning from './SessionExpiryWarning';

export default function AdminShell({ children, role }: { children: React.ReactNode; role?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <style>{`
        .admin-shell {
          display: flex;
          min-height: 100vh;
          font-family: Inter, system-ui, sans-serif;
        }
        .admin-sidebar-wrapper {
          position: sticky;
          top: 0;
          height: 100vh;
          flex-shrink: 0;
          z-index: 50;
        }
        .admin-main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .admin-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 45;
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          cursor: pointer;
        }
        .admin-overlay.visible { display: block; }
        @media (max-width: 768px) {
          .admin-sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
          }
          .admin-sidebar-wrapper.open {
            transform: translateX(0);
            box-shadow: 4px 0 24px rgba(0,0,0,0.3);
          }
        }
      `}</style>

      <div className="admin-shell">
        {/* Mobile backdrop overlay */}
        <div
          className={`admin-overlay${sidebarOpen ? ' visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Primary sidebar */}
        <div className={`admin-sidebar-wrapper${sidebarOpen ? ' open' : ''}`}>
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Contextual sub-sidebar — renders itself only when current path has sub-items */}
        <AdminSubSidebar />

        <div className="admin-main-area">
          {/* Top bar universelle (desktop + mobile) */}
          <AdminTopBar onOpenSidebar={() => setSidebarOpen(true)} role={role} />

          {/* Page content */}
          <main style={{ flex: 1, background: '#f8fafc', overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </div>

      <AdminNotifier />
      <SessionExpiryWarning />
    </>
  );
}
