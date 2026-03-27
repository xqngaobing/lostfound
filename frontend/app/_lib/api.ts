const envBase = process.env.NEXT_PUBLIC_API_URL;
export const API_BASE =
  envBase ??
  (typeof window !== "undefined"
    ? `https://${window.location.hostname}`
    : "http://localhost:4000");

export const normalizeImageUrl = (url: string): string => {
  if (typeof window === "undefined") return url;
  const host = window.location.hostname;
  if (url.includes("localhost:4000")) {
    return url.replace(/https?:\/\/[^/]*localhost:4000/, `https://${host}`);
  }
  if (url.includes(host) && url.includes(":4000")) {
    return url.replace(/:4000/, "");
  }
  return url;
};

export const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, { credentials: "include", ...init });
  if (!res.ok) {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        throw new Error(parsed.error ?? text);
      } catch {
        throw new Error(text);
      }
    }
    throw new Error("请求失败");
  }
  return res.json() as Promise<T>;
};
