"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";
import { useAuth } from "../_lib/auth";

const statusText: Record<string, string> = {
  PENDING: "待处理",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  WITHDRAWN: "已撤回"
};

type ReceivedClaim = {
  id: string;
  itemId: string;
  itemTitle: string;
  itemCode: string;
  claimantName: string;
  claimantContact: string;
  verificationInfo: string;
  status: string;
  createdAt: string;
};

type ClaimsResponse = {
  success: boolean;
  data: ReceivedClaim[];
};

export default function ManageClaimsPage() {
  const { user, loading } = useAuth();
  const [claims, setClaims] = useState<ReceivedClaim[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetchJson<ClaimsResponse>(`${API_BASE}/api/my/received-claims`, { cache: "no-store" })
      .then((res) => {
        setClaims(res.data);
        setError("");
      })
      .catch(() => setError("加载失败，请稍后重试"));
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(id);
    try {
      await fetchJson(`${API_BASE}/api/claims/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      setClaims((prev) => prev.map((claim) => (claim.id === id ? { ...claim, status } : claim)));
    } catch {
      setError("操作失败，请稍后重试");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div>正在加载用户信息...</div>;
  }

  if (!user) {
    return (
      <div className="panel form-grid">
        <div className="notice">管理认领申请需要先登录。</div>
        <a className="button" href="/login">
          去登录
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">发布者管理</div>
      <div style={{ color: "var(--muted)", marginBottom: 12 }}>这里展示别人对你发布物品的认领申请。</div>
      {error ? <div className="notice" style={{ marginBottom: 12 }}>{error}</div> : null}
      {claims.length === 0 ? <div>暂无认领申请</div> : null}
      {claims.map((claim) => (
        <div key={claim.id} className="panel" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>{claim.itemTitle}</div>
          <div style={{ color: "var(--muted)", marginTop: 4 }}>编号：{claim.itemCode}</div>
          <div style={{ marginTop: 8 }}>申请人：{claim.claimantName}</div>
          <div>联系方式：{claim.claimantContact}</div>
          <div>验证信息：{claim.verificationInfo}</div>
          <div style={{ marginTop: 6, color: "var(--muted)" }}>状态：{statusText[claim.status] ?? claim.status}</div>
          <div style={{ color: "var(--muted)" }}>时间：{new Date(claim.createdAt).toLocaleString()}</div>
          {claim.status === "PENDING" ? (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button
                className="button secondary"
                onClick={() => updateStatus(claim.id, "APPROVED")}
                disabled={busyId === claim.id}
              >
                通过
              </button>
              <button
                className="button secondary"
                onClick={() => updateStatus(claim.id, "REJECTED")}
                disabled={busyId === claim.id}
              >
                拒绝
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
