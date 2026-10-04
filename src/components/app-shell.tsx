import Link from "next/link";

import { navigation } from "@/lib/navigation";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <strong>Wholesale OS</strong>
          <span>Varachha Textile Market</span>
        </div>
        <nav className="nav-list" aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              <span>{item.label}</span>
              <span>{item.badge}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
