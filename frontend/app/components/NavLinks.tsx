"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { API_BASE, fetchJson } from "../_lib/api";
import { useAuth } from "../_lib/auth";

type UnreadResponse = {
  success: boolean;
  data: {
    items: Array<{ id: string }>;
    pagination: { total: number };
  };
};

export default function NavLinks() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const res = await fetchJson<UnreadResponse>(
          `${API_BASE}/api/notifications?unread=1&page=1&pageSize=1`,
          { cache: "no-store" }
        );
        if (!active) return;
        setUnread(res.data.pagination.total ?? 0);
      } catch {
        if (!active) return;
        setUnread(0);
      }
    };

    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  return (
    <nav className="nav-links">
      <a href="/" className={pathname === "/" ? "nav-active" : ""}>失物浏览</a>
      <a href="/publish" className={pathname === "/publish" ? "nav-active" : ""}>发布招领</a>
      <a href="/my" className={pathname === "/my" ? "nav-active" : ""}>我的发布</a>
      <a href="/manage" className={pathname === "/manage" ? "nav-active" : ""}>发布者管理</a>
      <a href="/messages" className={`nav-with-badge ${pathname === "/messages" ? "nav-active" : ""}`}>
        信息中心
        {unread > 0 ? <span className="nav-badge">{unread}</span> : null}
      </a>
      <a href="/guide" className={pathname === "/guide" ? "nav-active" : ""}>使用说明</a>
      <a href="/admin" className={pathname === "/admin" ? "nav-active" : ""}>管理后台</a>
    </nav>
  );
}
