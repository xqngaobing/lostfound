const envBase = process.env.NEXT_PUBLIC_API_URL;
export const API_BASE =
  envBase ??
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:4000`
    : "http://localhost:4000");

export const normalizeImageUrl = (url: string): string => {
  if (typeof window === "undefined") return url;
  if (url.startsWith("http://localhost:4000")) {
    return url.replace("http://localhost:4000", `http://${window.location.hostname}:4000`);
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
