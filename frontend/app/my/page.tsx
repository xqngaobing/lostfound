"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchJson, normalizeImageUrl } from "../_lib/api";
import { useAuth } from "../_lib/auth";

export default function MyPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<
    Array<{ id: string; code: string; title: string; status: string; locationText: string; createdAt: string; images: string[] }>
  >([]);
  const [claims, setClaims] = useState<Array<{ id: string; itemTitle: string; itemCode?: string | null; status: string; createdAt: string }>>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchJson<{
        success: boolean;
        data: Array<{ id: string; code: string; title: string; status: string; locationText: string; createdAt: string; images: string[] }>;
      }>(
        `${API_BASE}/api/my/items`,
        { cache: "no-store" }
      ),
      fetchJson<{ success: boolean; data: Array<{ id: string; itemTitle: string; itemCode?: string | null; status: string; createdAt: string }> }>(
        `${API_BASE}/api/my/claims`,
        { cache: "no-store" }
      )
    ])
      .then(([itemsRes, claimsRes]) => {
        setItems(itemsRes.data);
        setClaims(claimsRes.data);
      })
      .catch(() => setError("加载失败，请稍后重试"));
  }, [user]);

  const withdrawClaim = async (id: string) => {
    setBusyId(id);
    try {
      await fetchJson(`${API_BASE}/api/claims/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "WITHDRAWN" })
      });
      setClaims((prev) => prev.map((claim) => (claim.id === id ? { ...claim, status: "WITHDRAWN" } : claim)));
    } catch {
      setError("撤回失败，请稍后重试");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="section-title">我的发布</div>
      {loading ? <div>正在加载...</div> : null}
      {!loading && !user ? (
        <div className="panel form-grid">
          <div className="notice">查看我的发布需要先登录。</div>
          <a className="button" href="/login">
            去登录
          </a>
        </div>
      ) : null}
      {error ? <div className="notice">{error}</div> : null}

      {!loading && user ? (
        <div style={{ marginTop: 16 }}>
          <div className="section-title">我发布的物品</div>
          {items.length === 0 ? <div>暂无发布记录</div> : null}
          <div className="grid">
            {items.map((item) => (
              <a key={item.id} href={`/items/${item.code}`} className="card">
                <img src={normalizeImageUrl(item.images?.[0] ?? "") || "/placeholder.svg"} alt={item.title} />
                <div className="card-body">
                  <span className="badge">
                    {item.status === "OPEN"
                      ? "招领中"
                      : item.status === "CLAIMING"
                      ? "认领中"
                      : item.status === "CLAIMED"
                      ? "已认领"
                      : "已下架"}
                  </span>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>编号：{item.code}</div>
                  <div style={{ color: "var(--muted)" }}>{item.locationText}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="section-title">我的认领记录</div>
          {claims.length === 0 ? <div>暂无认领记录</div> : null}
          {claims.map((claim) => (
            <div key={claim.id} className="panel" style={{ marginTop: 12 }}>
              <div>物品：{claim.itemTitle}</div>
              <div>编号：{claim.itemCode ?? "-"}</div>
              <div>状态：{claim.status}</div>
              <div>时间：{new Date(claim.createdAt).toLocaleString()}</div>
              {claim.status === "PENDING" ? (
                <button
                  className="button secondary"
                  style={{ marginTop: 10 }}
                  onClick={() => withdrawClaim(claim.id)}
                  disabled={busyId === claim.id}
                >
                  撤回申请
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
