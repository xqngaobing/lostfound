"use client";

import { useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";
import { useAuth } from "../_lib/auth";

export default function AuthBar() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <div className="auth-bar">加载中...</div>;
  }

  if (!user) {
    return (
      <div className="auth-bar">
        <a href="/login">登录</a>
        <a href="/register">注册</a>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <span>你好，{user.username}</span>
      <a href="/password">修改密码</a>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetchJson(`${API_BASE}/api/auth/logout`, { method: "POST" });
          localStorage.removeItem("lf_user");
          window.location.href = "/";
        }}
      >
        退出
      </button>
    </div>
  );
}
