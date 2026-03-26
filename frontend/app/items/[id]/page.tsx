"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchJson, normalizeImageUrl } from "../../_lib/api";
import type { ItemDetail as ItemDetailType } from "../../_lib/types";
import { useAuth } from "../../_lib/auth";

type ClaimForm = {
  claimantName: string;
  claimantContact: string;
  verificationInfo: string;
};

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<ItemDetailType | null>(null);
  const [active, setActive] = useState(0);
  const [claim, setClaim] = useState<ClaimForm>({ claimantName: "", claimantContact: "", verificationInfo: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [showClaim, setShowClaim] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    fetchJson<{ success: boolean; data: ItemDetailType }>(`${API_BASE}/api/items/${params.id}`, { cache: "no-store" })
      .then((data) => setItem(data.data))
      .catch(() => setItem(null));
  }, [params.id]);

  useEffect(() => {
    if (user?.phone) {
      setClaim((prev) => ({ ...prev, claimantContact: user.phone }));
    }
  }, [user]);

  const submitClaim = async () => {
    if (!user) {
      setMessage("请先登录后再提交认领申请");
      return;
    }
    if (!claim.claimantName || !claim.claimantContact || !claim.verificationInfo) {
      setMessage("请填写姓名、联系方式与验证信息");
      return;
    }
    setSubmitting(true);
    try {
      await fetchJson(`${API_BASE}/api/items/${params.id}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimantName: claim.claimantName,
          claimantContact: claim.claimantContact,
          verificationInfo: claim.verificationInfo
        })
      });
      setMessage("认领申请已提交，发布者会尽快联系你。");
      setClaim({ claimantName: "", claimantContact: user?.phone ?? "", verificationInfo: "" });
      setShowClaim(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(message) as { error?: string };
        setMessage(parsed.error ?? "提交失败，请稍后重试");
      } catch {
        setMessage("提交失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) {
    return <div>未找到物品信息</div>;
  }

  return (
    <div>
      <div className="detail-grid">
        <div className="panel">
          <div className="carousel">
            <img src={normalizeImageUrl(item.images[active])} alt={item.title} />
            <div className="carousel-controls">
              <button className="button secondary" onClick={() => setActive(Math.max(active - 1, 0))}>
                上一张
              </button>
              <button
                className="button secondary"
                onClick={() => setActive(Math.min(active + 1, item.images.length - 1))}
              >
                下一张
              </button>
            </div>
          </div>
          <div className="thumbs">
            {item.images.map((img, idx) => (
              <img
                key={img}
                src={normalizeImageUrl(img)}
                alt={`${item.title}-${idx}`}
                className="thumb"
                onClick={() => setActive(idx)}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>{item.title}</h2>
          <div className="badge">
            {item.status === "OPEN"
              ? "招领中"
              : item.status === "CLAIMING"
              ? "认领中"
              : item.status === "CLAIMED"
              ? "已认领"
              : "已下架"}
          </div>
          <div className="meta">
            <div>物品编号：{item.code}</div>
            <div>类别：{item.category}</div>
            <div>发现时间：{new Date(item.foundAt).toLocaleString()}</div>
            <div>发现地点：{item.locationText}</div>
            <div>发布时间：{new Date(item.createdAt).toLocaleString()}</div>
            <div>浏览次数：{item.viewCount}</div>
          </div>
          <p style={{ marginTop: 12, lineHeight: 1.6 }}>{item.description}</p>

          <div style={{ marginTop: 16 }}>
            <button
              className="button"
              onClick={() => setShowClaim(true)}
              disabled={item.status === "CLAIMED" || item.status === "REMOVED"}
            >
              这是我的东西
            </button>
            {item.status === "CLAIMING" ? (
              <div style={{ marginTop: 8 }}>该物品已有认领申请处理中，仍可提交申请。</div>
            ) : item.status === "CLAIMED" || item.status === "REMOVED" ? (
              <div style={{ marginTop: 8 }}>该物品已完成认领或下架</div>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              className="button ghost"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setShareMessage("已复制链接，可转发给老师或家长。");
                });
              }}
            >
              复制分享链接
            </button>
            {shareMessage ? <div style={{ marginTop: 8, color: "var(--muted)" }}>{shareMessage}</div> : null}
          </div>
        </div>
      </div>

      {showClaim ? (
        <div className="modal-mask" onClick={() => setShowClaim(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>认领申请</h3>
            {!loading && !user ? (
              <div className="notice">
                认领申请需要先登录。<a href="/login">点此登录</a>
              </div>
            ) : null}
            <div className="form-grid">
              <input
                className="input"
                placeholder="姓名（必填）"
                value={claim.claimantName}
                onChange={(e) => setClaim({ ...claim, claimantName: e.target.value })}
              />
              <input
                className="input"
                placeholder="手机号（必填）"
                value={claim.claimantContact}
                onChange={(e) => setClaim({ ...claim, claimantContact: e.target.value })}
              />
              <textarea
                className="input"
                rows={4}
                placeholder="验证信息：请描述一个只有失主知道的细节"
                value={claim.verificationInfo}
                onChange={(e) => setClaim({ ...claim, verificationInfo: e.target.value })}
              />
              {message ? <div className="notice">{message}</div> : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="button ghost" onClick={() => setShowClaim(false)}>
                  取消
                </button>
                <button className="button" onClick={submitClaim} disabled={submitting}>
                  提交申请
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="section-title">举报</div>
      <ReportSection itemCode={item.code} user={user} />
    </div>
  );
}

function ReportSection({ itemCode, user }: { itemCode: string; user: { id: string } | null }) {
  const [type, setType] = useState("FAKE");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!user) {
      setMessage("请先登录后再提交举报");
      return;
    }
    await fetchJson(`${API_BASE}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemCode, type, note: note || undefined })
    });
    setMessage("举报已提交，感谢你帮助维护平台。"
    );
    setNote("");
  };

  return (
    <div className="panel form-grid report-panel">
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="FAKE">虚假信息</option>
        <option value="INAPPROPRIATE">不当内容</option>
        <option value="AD">广告垃圾</option>
        <option value="OTHER">其他</option>
      </select>
      <textarea
        className="input"
        rows={3}
        placeholder="补充说明（选填）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="button ghost" onClick={submit}>
        提交举报
      </button>
      {message ? <div className="notice">{message}</div> : null}
    </div>
  );
}
