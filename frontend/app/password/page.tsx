"use client";

import { useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";
import { useAuth } from "../_lib/auth";

export default function PasswordPage() {
  const { user, loading } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    setMessage("");
    if (!oldPassword || !newPassword || !newPassword2) {
      setMessage("请完整填写");
      return;
    }
    if (newPassword !== newPassword2) {
      setMessage("两次新密码不一致");
      return;
    }
    try {
      await fetchJson(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      setMessage("修改成功");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(message) as { error?: string };
        setMessage(parsed.error ?? "修改失败");
      } catch {
        setMessage("修改失败");
      }
    }
  };

  if (loading) return <div>正在加载...</div>;
  if (!user) {
    return (
      <div className="center-page">
        <div className="panel form-grid" style={{ maxWidth: 520, width: "100%" }}>
          <div className="notice">修改密码需要先登录。</div>
          <a className="button" href="/login">
            去登录
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="center-page">
      <div className="panel form-grid" style={{ maxWidth: 520, width: "100%" }}>
        <h2>修改密码</h2>
        <input
          className="input"
          type="text"
          placeholder="旧密码"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="新密码"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="再次输入新密码"
          value={newPassword2}
          onChange={(e) => setNewPassword2(e.target.value)}
        />
        {message ? <div className="notice">{message}</div> : null}
        <button className="button" onClick={submit}>
          确认修改
        </button>
      </div>
    </div>
  );
}
