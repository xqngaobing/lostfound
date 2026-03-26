"use client";

import { useState } from "react";
import { API_BASE, fetchJson } from "../_lib/api";
import { useAuth } from "../_lib/auth";

const categories = ["证件类", "电子产品", "钱包/包", "钥匙", "衣物", "文具", "水杯", "现金", "其他"];

export default function PublishPage() {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user, loading } = useAuth();
  const [form, setForm] = useState({
    title: "",
    category: "衣物",
    description: "",
    foundDate: defaultDate,
    foundTime: defaultTime,
    locationText: ""
  });
  const [result, setResult] = useState<{ id: string; code: string } | null>(null);
  const [error, setError] = useState("");

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, 5);
    const body = new FormData();
    selected.forEach((file) => body.append("images", file));
    setUploading(true);
    setError("");
    try {
      const res = await fetchJson<{ success: boolean; data: string[] }>(`${API_BASE}/api/uploads`, {
        method: "POST",
        body
      });
      setImages(res.data);
      setStep(2);
    } catch {
      setError("上传失败，请检查图片格式或大小");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (images.length === 0) {
      setError("请先上传图片");
      return;
    }
    if (!form.title || !form.description || !form.foundDate || !form.locationText) {
      setError("请完整填写所有必填项");
      return;
    }
    setError("");
    const timeValue = form.foundTime ? form.foundTime : "12:00";
    const payload = {
      ...form,
      images,
      foundAt: new Date(`${form.foundDate}T${timeValue}:00`).toISOString()
    };
    try {
      const res = await fetchJson<{ success: boolean; data: { id: string; code: string } }>(
        `${API_BASE}/api/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      setResult(res.data);
      setStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      try {
        const parsed = JSON.parse(message) as { error?: string };
        setError(parsed.error ?? "提交失败，请稍后重试");
      } catch {
        setError("提交失败，请稍后重试");
      }
    }
  };

  return (
    <div>
      <div className="section-title">发布失物招领</div>
      {loading ? <div>正在加载用户信息...</div> : null}
      {!loading && !user ? (
        <div className="panel form-grid">
          <div className="notice">发布信息需要先登录。</div>
          <a className="button" href="/login">
            去登录
          </a>
        </div>
      ) : null}
      {!loading && user ? (
      <div className="stepper">
        <div className={`step ${step === 1 ? "active" : ""}`}>1 上传图片</div>
        <div className={`step ${step === 2 ? "active" : ""}`}>2 填写信息</div>
        <div className={`step ${step === 3 ? "active" : ""}`}>3 发布成功</div>
      </div>
      ) : null}

      {!loading && user && step === 1 && (
        <div className="panel form-grid">
          <div>支持 JPG / PNG / WEBP，最多 5 张。图片过大将自动压缩处理。</div>
          <input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e.target.files)} />
          {uploading ? <div>正在上传...</div> : null}
          {error ? <div className="notice">{error}</div> : null}
          {images.length > 0 ? (
            <div style={{ display: "flex", gap: 8 }}>
              {images.map((img) => (
                <img key={img} src={img} alt="预览" style={{ width: 90, height: 70, objectFit: "cover" }} />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {!loading && user && step === 2 && (
        <div className="panel form-grid">
          <input
            className="input"
            placeholder="物品名称（必填）"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            className="input"
            rows={4}
            placeholder="详细描述（描述颜色、品牌、特征）"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          <div className="form-grid form-grid-two">
            <input
              className="input"
              type="date"
              value={form.foundDate}
              onChange={(e) => setForm({ ...form, foundDate: e.target.value })}
              required
            />
            <input
              className="input"
              type="time"
              value={form.foundTime}
              onChange={(e) => setForm({ ...form, foundTime: e.target.value })}
            />
          </div>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            时间可留空，默认按 12:00 提交。
          </div>
          <input
            className="input"
            placeholder="发现地点（必填）"
            value={form.locationText}
            onChange={(e) => setForm({ ...form, locationText: e.target.value })}
            required
          />
          <input className="input" value={`发布手机号：${user.phone}`} disabled />
          {error ? <div className="notice">{error}</div> : null}
          <button className="button" onClick={submit}>
            确认发布
          </button>
        </div>
      )}

      {!loading && user && step === 3 && result && (
        <div className="panel form-grid">
          <div className="section-title">发布成功</div>
          <div className="notice">
            请保存你的物品编号，用于后续查询和管理。
          </div>
          <div>
            物品编号：<strong>{result.code}</strong>
          </div>
          <a className="button" href={`/items/${result.code}`}>
            查看发布信息
          </a>
        </div>
      )}
    </div>
  );
}
