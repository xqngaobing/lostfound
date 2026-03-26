"use client";

import { useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      const res = await fetchJson<{ success: boolean; data: { id: string; username: string; phone: string } }>(
        `${API_BASE}/api/auth/login`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password })
        }
      );
      localStorage.setItem("lf_user", JSON.stringify(res.data));
      window.location.href = "/";
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(message) as { error?: string };
        setError(parsed.error ?? "登录失败");
      } catch {
        setError("登录失败");
      }
    }
  };

  return (
    <div className="center-page">
      <div className="panel form-grid" style={{ maxWidth: 480, width: "100%" }}>
        <h2>用户登录</h2>
        <input
          className="input"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <div className="notice">{error}</div> : null}
        <button className="button" onClick={submit}>
          登录
        </button>
        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          忘记密码请联系开发人员 高彬 17346680278
        </div>
      </div>
    </div>
  );
}
