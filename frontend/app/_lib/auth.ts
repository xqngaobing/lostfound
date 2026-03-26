"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchJson } from "./api";

export type UserInfo = { id: string; username: string; phone: string };

export const useAuth = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("lf_user");
    if (cached) {
      try {
        setUser(JSON.parse(cached) as UserInfo);
      } catch {
        localStorage.removeItem("lf_user");
      }
    }
    fetchJson<{ success: boolean; data: UserInfo }>(`${API_BASE}/api/auth/me`, { cache: "no-store" })
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("lf_user", JSON.stringify(res.data));
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem("lf_user");
        setLoading(false);
      });
  }, []);

  return { user, loading };
};
