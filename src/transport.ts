import { mapStatusError } from "./errors.js";

export class Transport {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  private get authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.ok) return res.json() as Promise<T>;
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text(); }
    throw mapStatusError(res.status, body);
  }

  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url, { headers: this.authHeaders });
    return this.handleResponse<T>(res);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: { ...this.authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: this.authHeaders,
      body: form,
    });
    return this.handleResponse<T>(res);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "PATCH",
      headers: { ...this.authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "DELETE",
      headers: this.authHeaders,
    });
    return this.handleResponse<T>(res);
  }
}
