/**
 * Cliente HTTP leve baseado no `fetch` nativo do Node.js 22.
 *
 * Substitui pacotes externos como `axios` (reduzindo a superfície de
 * ataque de supply-chain no npm) enquanto preserva o formato `{ data, status }`
 * e o erro enriquecido `error.response.data`.
 */

export interface HttpOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
}

/**
 * Monta a URL completa anexando query parameters (se informados).
 */
export function montarUrlComParams(
  baseUrl: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params || Object.keys(params).length === 0) return baseUrl;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      search.append(k, String(v));
    }
  }
  const qs = search.toString();
  if (!qs) return baseUrl;
  return baseUrl.includes("?") ? `${baseUrl}&${qs}` : `${baseUrl}?${qs}`;
}

async function executarRequisicao<T = any>(
  method: "GET" | "POST",
  url: string,
  options: HttpOptions = {}
): Promise<HttpResponse<T>> {
  const fullUrl = montarUrlComParams(url, options.params);
  const timeoutMs = options.timeout ?? 15000;

  const response = await fetch(fullUrl, {
    method,
    headers: options.headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // mantém como texto puro caso não seja JSON
  }

  if (!response.ok) {
    const err: any = new Error(
      `HTTP ${response.status} (${response.statusText}): ${
        typeof data === "object" ? JSON.stringify(data) : text
      }`
    );
    err.response = { status: response.status, data };
    throw err;
  }

  return { data, status: response.status };
}

export function httpGet<T = any>(
  url: string,
  options?: HttpOptions
): Promise<HttpResponse<T>> {
  return executarRequisicao<T>("GET", url, options);
}

export function httpPost<T = any>(
  url: string,
  options?: HttpOptions
): Promise<HttpResponse<T>> {
  return executarRequisicao<T>("POST", url, options);
}
