"use client";

import { useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!username || !phone || !password || !password2) {
      setError("请完整填写所有必填项");
      return;
    }
    if (password !== password2) {
      setError("两次密码不一致");
      return;
    }
    try {
      const res = await fetchJson<{ success: boolean; data: { id: string; username: string; phone: string } }>(
        `${API_BASE}/api/auth/register`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, phone, password })
        }
      );
      localStorage.setItem("lf_user", JSON.stringify(res.data));
      window.location.href = "/";
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(message) as { error?: string };
        setError(parsed.error ?? "注册失败");
      } catch {
        setError("注册失败");
      }
    }
  };

  return (
    <div className="center-page">
      <div className="panel form-grid" style={{ maxWidth: 520, width: "100%" }}>
        <h2>用户注册</h2>
        <input
          className="input"
          placeholder="用户名（必填）"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="input"
          placeholder="手机号（必填）"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="密码（必填）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="再次输入密码（必填）"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />
        {error ? <div className="notice">{error}</div> : null}
        <button className="button" onClick={submit}>
          注册
        </button>
      </div>
    </div>
  );
}
