"use client";

import { useEffect, useState } from "react";
import { API_BASE, fetchJson, normalizeImageUrl } from "./_lib/api";
import type { ItemCard } from "./_lib/types";

const categories = ["全部", "证件类", "电子产品", "钱包/包", "钥匙", "衣物", "文具", "水杯", "现金", "其他"];
const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "OPEN", label: "招领中" },
  { value: "CLAIMING", label: "认领中" },
  { value: "CLAIMED", label: "已认领" },
  { value: "REMOVED", label: "已下架" }
];

export default function HomePage() {
  const [items, setItems] = useState<ItemCard[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("全部");
  const [status, setStatus] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (pageIndex: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(pageIndex));
    params.set("pageSize", "12");
    params.set("sort", sort);
    if (q.trim()) params.set("q", q.trim());
    if (category !== "全部") params.set("category", category);
    if (status !== "all") params.set("status", status);
    if (timeRange !== "all") params.set("timeRange", timeRange);
    const data = await fetchJson<{ success: boolean; data: { items: ItemCard[]; pagination: { totalPages: number } } }>(
      `${API_BASE}/api/items?${params.toString()}`,
      { cache: "no-store" }
    );
    setItems(data.data.items);
    setTotalPages(data.data.pagination.totalPages || 1);
    setLoading(false);
  };

  useEffect(() => {
    load(page).catch(() => setLoading(false));
  }, [page, sort]);

  return (
    <div>
      <section className="hero">
        <div className="hero-card">
          <div className="hero-title">校园失物信息一站通达</div>
          <div className="hero-sub">
            在这里发布你捡到的物品，或快速找到遗失的物品。所有信息公开透明，
            让失物更快回到失主身边。
          </div>
          <div className="hero-highlight">
            提醒：发布信息需填写真实手机号，仅用于失主认领沟通，不会公开展示。
          </div>
        </div>
        <div className="hero-card">
          <div className="section-title">快速搜索</div>
          <div className="filters">
            <input
              className="input"
              placeholder="输入物品名称、地点或描述关键词"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="all">全部时间</option>
              <option value="week">最近一周</option>
              <option value="month">最近一月</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="latest">最新发布</option>
              <option value="views">最多浏览</option>
            </select>
            <button
              className="button"
              onClick={() => {
                setPage(1);
                load(1).catch(() => setLoading(false));
              }}
            >
              开始搜索
            </button>
          </div>
        </div>
      </section>

      <div className="section-title">当前招领信息</div>
      {loading ? <div>正在加载...</div> : null}
      <div className="grid">
        {items.map((item) => (
          <a key={item.id} href={`/items/${item.code}`} className="card">
            <img src={normalizeImageUrl(item.images[0])} alt={item.title} />
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

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          上一页
        </button>
        <div style={{ alignSelf: "center" }}>
          第 {page} / {totalPages} 页
        </div>
        <button className="button secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          下一页
        </button>
      </div>
    </div>
  );
}
