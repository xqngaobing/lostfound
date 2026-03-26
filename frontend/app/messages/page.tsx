"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";
import { useAuth } from "../_lib/auth";

const statusText: Record<string, string> = {
  PENDING: "已提交",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  WITHDRAWN: "已撤回"
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  meta?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationResponse = {
  success: boolean;
  data: {
    items: NotificationItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
};

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchJson<NotificationResponse>(`${API_BASE}/api/notifications`)
      .then((res) => {
        setItems(res.data.items);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "";
        setError(message || "消息加载失败");
      });
  }, [user]);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const markRead = async (id: string) => {
    setBusyId(id);
    try {
      await fetchJson(`${API_BASE}/api/notifications/${id}/read`, { method: "POST" });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    } catch {
      setError("标记已读失败，请稍后重试");
    } finally {
      setBusyId(null);
    }
  };

  const getItemLink = (meta?: Record<string, unknown> | null) => {
    const code = meta?.itemCode as string | undefined;
    return code ? `/items/${code}` : null;
  };

  if (loading) {
    return <div>正在加载用户信息...</div>;
  }

  if (!user) {
    return (
      <div className="panel form-grid">
        <div className="notice">查看信息中心需要先登录。</div>
        <a className="button" href="/login">
          去登录
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">信息中心</div>
      <div className="message-summary">
        未读消息：<strong>{unreadCount}</strong>
      </div>
      {error ? <div className="notice" style={{ marginTop: 12 }}>{error}</div> : null}
      {items.length === 0 ? <div style={{ marginTop: 12 }}>暂无消息</div> : null}
      <div className="message-list">
        {items.map((item) => {
          const link = getItemLink(item.meta);
          const metaStatus = item.meta?.status as string | undefined;
          return (
            <div key={item.id} className={`panel message-item ${item.readAt ? "read" : "unread"}`}>
              <div className="message-header">
                <div>
                  <div className="message-title">{item.title}</div>
                  <div className="message-time">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                {!item.readAt ? <span className="badge">未读</span> : null}
              </div>
              <div className="message-body">{item.body}</div>
              {metaStatus ? (
                <div className="message-meta">进度：{statusText[metaStatus] ?? metaStatus}</div>
              ) : null}
              {link ? (
                <a className="button ghost" href={link} style={{ marginTop: 10, width: "fit-content" }}>
                  查看物品
                </a>
              ) : null}
              {!item.readAt ? (
                <button
                  className="button secondary"
                  onClick={() => markRead(item.id)}
                  disabled={busyId === item.id}
                  style={{ marginTop: 10 }}
                >
                  标记为已读
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
