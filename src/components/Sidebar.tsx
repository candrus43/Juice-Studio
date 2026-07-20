import { useState, useEffect } from "react";
import { useRouter, useLocation } from "@tanstack/react-router";
import { navItems, type ModuleName } from "../data/mock";

// Grouped navigation sections
const navSections = [
  {
    label: "Create",
    items: ["beat-studio", "recording-studio", "songwriter", "music-creation"] as ModuleName[],
  },
  {
    label: "Refine",
    items: ["vocal-processing", "mixing-mastering", "arrangement"] as ModuleName[],
  },
  {
    label: "Finish",
    items: ["export-studio", "cover-art-studio", "video-studio"] as ModuleName[],
  },
  {
    label: "Manage",
    items: ["project-manager"] as ModuleName[],
  },
];

// Map module IDs back to navItems for quick lookup
const navItemMap = new Map(navItems.map((item) => [item.id, item]));

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const location = useLocation();

  // Determine active module from path
  const path = location.pathname;
  const activeId: ModuleName = path === "/" ? "dashboard" : (path.slice(1).replace(/\//g, "-") as ModuleName) || "dashboard";

  // Close mobile on navigate
  useEffect(() => { setMobileOpen(false); }, [path]);

  // Keyboard shortcut: Cmd+B to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const renderNavItem = (itemId: ModuleName, idx: number) => {
    const item = navItemMap.get(itemId);
    if (!item) return null;
    const isActive = activeId === item.id;

    return (
      <div
        key={item.id}
        className="nav-item-wrapper relative"
        style={{ animationDelay: `${idx * 30}ms` }}
      >
        <button
          onClick={() => router.navigate({ to: item.path })}
          className={`nav-item w-full text-left group ${isActive ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? item.label : undefined}
        >
          <svg
            className="w-5 h-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-[1.05]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={item.icon} />
          </svg>
          {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
          {isActive && (
            <span className={`${collapsed ? "absolute -right-1 top-1/2 -translate-y-1/2" : "ml-auto"} w-1.5 h-1.5 rounded-full bg-[var(--color-accent-light)] animate-glowPulse`} />
          )}
        </button>
        {/* Floating tooltip for collapsed mode */}
        {collapsed && (
          <div className="sidebar-tooltip">{item.label}</div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--color-glass-border)]">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        {!collapsed && (
          <span className="font-semibold text-base text-white tracking-tight whitespace-nowrap">Juice Studio</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* Dashboard item */}
        <div className="nav-item-wrapper relative" style={{ animationDelay: "0ms" }}>
          <button
            onClick={() => router.navigate({ to: "/" })}
            className={`nav-item w-full text-left group ${activeId === "dashboard" ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Dashboard" : undefined}
          >
            <svg
              className="w-5 h-5 flex-shrink-0 transition-transform duration-150 group-hover:scale-[1.05]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
            {!collapsed && <span className="whitespace-nowrap">Dashboard</span>}
            {activeId === "dashboard" && (
              <span className={`${collapsed ? "absolute -right-1 top-1/2 -translate-y-1/2" : "ml-auto"} w-1.5 h-1.5 rounded-full bg-[var(--color-accent-light)] animate-glowPulse`} />
            )}
          </button>
          {collapsed && <div className="sidebar-tooltip">Dashboard</div>}
        </div>

        {/* Grouped sections */}
        <div className="pt-2">
          {navSections.map((section) => (
            <div key={section.label} className="mb-1">
              {/* Section header */}
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-juice-300)]">
                  {section.label}
                </div>
              )}
              {section.items.map((itemId, idx) => renderNavItem(itemId, idx))}
            </div>
          ))}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[var(--color-glass-border)] p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full justify-center"
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (⌘B)`}
        >
          <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex glass-sidebar flex-col h-screen sticky top-0 transition-all duration-300 ease-out ${
          collapsed ? "w-[64px]" : "w-[220px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center glass-panel"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-[260px] z-50 glass-sidebar flex flex-col h-full shadow-2xl animate-[fadeSlideIn_0.2s_ease-out]">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
