"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";

type AdminItem = {
  id: string;
  code?: string | null;
  title: string;
  status: string;
  createdAt: string;
  publisherContact: string;
};

type AdminClaim = {
  id: string;
  itemId: string;
  itemTitle: string;
  claimantName?: string | null;
  claimantContact: string;
  verificationInfo: string;
  status: string;
  createdAt: string;
};

type AdminReport = {
  id: string;
  type: string;
  note?: string | null;
  createdAt: string;
  item: { id: string; title: string; status: string };
};

type AdminUser = {
  id: string;
  username: string;
  phone: string;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  OPEN: "招领中",
  CLAIMING: "认领中",
  CLAIMED: "已认领",
  REMOVED: "已下架"
};

const statusClass: Record<string, string> = {
  OPEN: "status-open",
  CLAIMING: "status-claiming",
  CLAIMED: "status-claimed",
  REMOVED: "status-removed"
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "claims" | "users" | "reports">("items");
  const [itemStatusFilter, setItemStatusFilter] = useState("all");
  const [userQuery, setUserQuery] = useState("");
  const [newUser, setNewUser] = useState({ username: "", phone: "", password: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({ username: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  const load = async () => {
    try {
      localStorage.setItem("admin_token", token);
      const [itemsRes, claimsRes, reportsRes, usersRes] = await Promise.all([
        fetchJson<{ success: boolean; data: AdminItem[] }>(`${API_BASE}/api/admin/items`, {
          headers: { "x-admin-token": token }
        }),
        fetchJson<{ success: boolean; data: AdminClaim[] }>(`${API_BASE}/api/admin/claims`, {
          headers: { "x-admin-token": token }
        }),
        fetchJson<{ success: boolean; data: AdminReport[] }>(`${API_BASE}/api/admin/reports`, {
          headers: { "x-admin-token": token }
        }),
        fetchJson<{ success: boolean; data: AdminUser[] }>(`${API_BASE}/api/admin/users`, {
          headers: { "x-admin-token": token }
        })
      ]);
      setItems(itemsRes.data);
      setClaims(claimsRes.data);
      setReports(reportsRes.data);
      setUsers(usersRes.data);
      setError("");
      setAuthorized(true);
      setSelectedItemIds([]);
    } catch {
      setError("管理员口令不正确或接口不可用");
      setAuthorized(false);
    }
  };

  const searchUsers = async () => {
    const params = new URLSearchParams();
    if (userQuery.trim()) params.set("q", userQuery.trim());
    const res = await fetchJson<{ success: boolean; data: AdminUser[] }>(
      `${API_BASE}/api/admin/users?${params.toString()}`,
      { headers: { "x-admin-token": token } }
    );
    setUsers(res.data);
  };

  const createUser = async () => {
    await fetchJson(`${API_BASE}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify(newUser)
    });
    setNewUser({ username: "", phone: "", password: "" });
    await searchUsers();
  };

  const saveUser = async (id: string) => {
    await fetchJson(`${API_BASE}/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify(editingData)
    });
    setEditingId(null);
    setEditingData({ username: "", phone: "", password: "" });
    await searchUsers();
  };

  const deleteUser = async (id: string) => {
    await fetchJson(`${API_BASE}/api/admin/users/${id}`, {
      method: "DELETE",
      headers: { "x-admin-token": token }
    });
    await searchUsers();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetchJson(`${API_BASE}/api/admin/items/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ status })
    });
    await load();
  };

  const isDeletable = (status: string) => status === "CLAIMED" || status === "REMOVED";

  const toggleSelect = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const deletableIds = items
      .filter((item) => isDeletable(item.status))
      .filter((item) => itemStatusFilter === "all" || item.status === itemStatusFilter)
      .map((item) => item.id);
    setSelectedItemIds((prev) => (prev.length === deletableIds.length ? [] : deletableIds));
  };

  const batchDelete = async () => {
    if (selectedItemIds.length === 0) return;
    if (!confirm(`确认删除选中的 ${selectedItemIds.length} 个物品吗？此操作不可恢复。`)) return;
    await fetchJson(`${API_BASE}/api/admin/items/batch-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ ids: selectedItemIds })
    });
    await load();
  };

  const updateClaimStatus = async (id: string, status: string) => {
    await fetchJson(`${API_BASE}/api/admin/claims/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ status })
    });
    await load();
  };

  return (
    <div>
      {!authorized ? (
        <div className="center-page admin-login-wrap">
          <div className="panel form-grid admin-login" style={{ maxWidth: 240, width: "100%" }}>
            <input
              className="input"
              placeholder="输入管理员访问口令"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button className="button" onClick={load}>
              进入后台
            </button>
            {error ? <div className="notice">{error}</div> : null}
          </div>
        </div>
      ) : null}

      {authorized ? (
        <div className="panel admin-inner" style={{ marginTop: 20 }}>
          <div className="admin-tabs">
            <button className={`tab ${activeTab === "items" ? "active" : ""}`} onClick={() => setActiveTab("items")}>
              物品列表
            </button>
            <button className={`tab ${activeTab === "claims" ? "active" : ""}`} onClick={() => setActiveTab("claims")}>
              认领申请
            </button>
            <button className={`tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
              用户管理
            </button>
            <button className={`tab ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
              举报记录
            </button>
          </div>

          {activeTab === "items" ? (
            <div className="panel" style={{ marginTop: 20 }}>
              <div className="section-title">物品列表</div>
              {items.length === 0 ? <div>暂无物品</div> : null}
              <div className="status-filter">
                <button
                  className={`tab ${itemStatusFilter === "all" ? "active" : ""}`}
                  onClick={() => setItemStatusFilter("all")}
                >
                  全部
                </button>
                <button
                  className={`tab ${itemStatusFilter === "OPEN" ? "active" : ""}`}
                  onClick={() => setItemStatusFilter("OPEN")}
                >
                  招领中
                </button>
                <button
                  className={`tab ${itemStatusFilter === "CLAIMING" ? "active" : ""}`}
                  onClick={() => setItemStatusFilter("CLAIMING")}
                >
                  认领中
                </button>
                <button
                  className={`tab ${itemStatusFilter === "CLAIMED" ? "active" : ""}`}
                  onClick={() => setItemStatusFilter("CLAIMED")}
                >
                  已认领
                </button>
                <button
                  className={`tab ${itemStatusFilter === "REMOVED" ? "active" : ""}`}
                  onClick={() => setItemStatusFilter("REMOVED")}
                >
                  已下架
                </button>
              </div>
              {items.length > 0 ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <button className="button secondary" onClick={toggleSelectAll}>
                    {selectedItemIds.length > 0 ? "清空选择" : "全选可删"}
                  </button>
                  <button className="button ghost" onClick={batchDelete} disabled={selectedItemIds.length === 0}>
                    批量删除
                  </button>
                  <div style={{ color: "var(--muted)" }}>
                    仅已认领 / 已下架可删除，已选 {selectedItemIds.length} 个
                  </div>
                </div>
              ) : null}
              <table className="table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>物品</th>
                    <th>编号</th>
                    <th>状态</th>
                    <th>发布联系</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((item) => itemStatusFilter === "all" || item.status === itemStatusFilter)
                    .map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.id)}
                          disabled={!isDeletable(item.status)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td>{item.title}</td>
                      <td>{item.code ?? "-"}</td>
                      <td>
                        <span className={`status-pill ${statusClass[item.status] ?? ""}`}>
                          {statusLabel[item.status] ?? item.status}
                        </span>
                      </td>
                      <td>{item.publisherContact}</td>
                      <td>
                        <button className="button secondary" onClick={() => updateStatus(item.id, "OPEN")}>
                          招领中
                        </button>
                        <button className="button secondary" onClick={() => updateStatus(item.id, "CLAIMING")}>
                          认领中
                        </button>
                        <button className="button secondary" onClick={() => updateStatus(item.id, "CLAIMED")}>
                          已认领
                        </button>
                        <button className="button secondary" onClick={() => updateStatus(item.id, "REMOVED")}>
                          下架
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "claims" ? (
            <div className="panel" style={{ marginTop: 20 }}>
              <div className="section-title">认领申请</div>
              {claims.length === 0 ? <div>暂无认领申请</div> : null}
              <table className="table">
                <thead>
                  <tr>
                    <th>物品</th>
                    <th>认领人</th>
                    <th>联系方式</th>
                    <th>验证信息</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id}>
                      <td>{claim.itemTitle}</td>
                      <td>{claim.claimantName || "未填"}</td>
                      <td>{claim.claimantContact}</td>
                      <td>{claim.verificationInfo}</td>
                      <td>{claim.status}</td>
                      <td>
                        <button
                          className="button secondary"
                          onClick={() => updateClaimStatus(claim.id, "APPROVED")}
                          disabled={claim.status !== "PENDING"}
                        >
                          通过
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => updateClaimStatus(claim.id, "REJECTED")}
                          disabled={claim.status !== "PENDING"}
                        >
                          拒绝
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "reports" ? (
            <div className="panel" style={{ marginTop: 20 }}>
              <div className="section-title">举报记录</div>
              {reports.length === 0 ? <div>暂无举报</div> : null}
              <table className="table">
                <thead>
                  <tr>
                    <th>物品</th>
                    <th>类型</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.item.title}</td>
                      <td>{report.type}</td>
                      <td>{report.note || "无"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "users" ? (
            <div className="panel" style={{ marginTop: 20 }}>
              <div className="section-title">用户管理</div>
              <div className="form-grid">
                <input
                  className="input"
                  placeholder="搜索用户名或手机号"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                <button className="button secondary" onClick={searchUsers}>
                  搜索
                </button>
              </div>

              <div className="section-title">添加用户</div>
              <div className="form-grid" style={{ maxWidth: 480 }}>
                <input
                  className="input"
                  placeholder="用户名"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="手机号"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="初始密码"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <button className="button" onClick={createUser}>
                  添加
                </button>
              </div>

              <div className="section-title">用户列表</div>
              {users.length === 0 ? <div>暂无用户</div> : null}
              <table className="table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>手机号</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        {editingId === user.id ? (
                          <input
                            className="input"
                            value={editingData.username}
                            onChange={(e) => setEditingData({ ...editingData, username: e.target.value })}
                          />
                        ) : (
                          user.username
                        )}
                      </td>
                      <td>
                        {editingId === user.id ? (
                          <input
                            className="input"
                            value={editingData.phone}
                            onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })}
                          />
                        ) : (
                          user.phone
                        )}
                      </td>
                      <td>{new Date(user.createdAt).toLocaleString()}</td>
                      <td>
                        {editingId === user.id ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              className="input"
                              placeholder="新密码（可选）"
                              type="password"
                              value={editingData.password}
                              onChange={(e) => setEditingData({ ...editingData, password: e.target.value })}
                              style={{ height: 40 }}
                            />
                            <button className="button secondary" onClick={() => saveUser(user.id)}>
                              保存
                            </button>
                            <button
                              className="button ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditingData({ username: "", phone: "", password: "" });
                              }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="button secondary"
                              onClick={() => {
                                setEditingId(user.id);
                                setEditingData({ username: user.username, phone: user.phone, password: "" });
                              }}
                            >
                              编辑
                            </button>
                            <button className="button ghost" onClick={() => deleteUser(user.id)}>
                              删除
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
