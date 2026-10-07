type ResponseTuple = [status: number, headers: Record<string, string>, body: string];
type Responder = (request: FakeRequest) => void;
type ResponseHandler = string | ResponseTuple | Responder;
type Route = { method?: string; url?: string | RegExp; handler: ResponseTuple | Responder };
type RespondArgs = [ResponseHandler] | [string | RegExp, ResponseHandler] | [string, string | RegExp, ResponseHandler];

const toTuple = (body: string | ResponseTuple): ResponseTuple => (Array.isArray(body) ? body : [200, {}, body]);

class FakeRequest {
  url: string;
  method: string;
  requestBody: string | null;
  requestHeaders: Record<string, string>;
  credentials: RequestCredentials | undefined;
  aborted = false;
  settled = false;
  resolve!: (response: Response) => void;
  reject!: (reason: unknown) => void;

  constructor(url: string, init: RequestInit = {}) {
    this.url = url;
    this.method = init.method ?? "GET";
    this.requestBody = (init.body as string | undefined) ?? null;
    this.requestHeaders = { ...(init.headers as Record<string, string>) };
    this.credentials = init.credentials;
  }

  respond(status: number, headers: Record<string, string>, body: string) {
    if (this.settled) return;
    this.settled = true;
    this.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      headers: new Headers(headers),
      text: () => Promise.resolve(body),
    } as Response);
  }

  error() {
    if (this.settled) return;
    this.settled = true;
    this.reject(new TypeError("Failed to fetch"));
  }
}

/**
 * Подменяет `fetch`. Повторяет API `fakeServer` из nise:
 * запросы копятся в очереди, пока тест не вызовет `respond`.
 */
class FakeServer {
  requests: FakeRequest[] = [];
  queue: FakeRequest[] = [];
  routes: Route[] = [];
  defaultResponse: ResponseTuple = [404, {}, ""];
  originalFetch = globalThis.fetch;

  constructor() {
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new FakeRequest(String(input), init);
      this.requests.push(request);
      this.queue.push(request);

      return new Promise<Response>((resolve, reject) => {
        request.resolve = resolve;
        request.reject = reject;

        const signal = init?.signal;
        const abort = () => {
          request.aborted = true;
          request.settled = true;
          reject(signal!.reason);
        };
        if (signal?.aborted) {
          abort();
        } else {
          signal?.addEventListener("abort", abort);
        }
      });
    };
  }

  get lastRequest() {
    return this.requests.at(-1);
  }

  respondWith(...args: RespondArgs) {
    const handler = args.at(-1) as ResponseHandler;
    if (args.length === 1 && typeof handler !== "function") {
      this.defaultResponse = toTuple(handler);
      return;
    }
    const url = args.length > 1 ? (args.at(-2) as string | RegExp) : undefined;
    const method = args.length > 2 ? (args[0] as string) : undefined;
    this.routes.push({ method, url, handler: typeof handler === "function" ? handler : toTuple(handler) });
  }

  respond(...args: RespondArgs | []) {
    if (args.length > 0) {
      this.respondWith(...(args as RespondArgs));
    }
    for (const request of this.queue.splice(0)) {
      if (request.aborted) continue;
      const route = this.routes.findLast(
        ({ method, url }) =>
          (!method || method.toLowerCase() === request.method.toLowerCase()) &&
          (!url || (typeof url === "string" ? url === request.url : url.test(request.url))),
      );
      const handler = route ? route.handler : this.defaultResponse;
      if (typeof handler === "function") {
        handler(request);
      } else {
        request.respond(...handler);
      }
    }
  }

  restore() {
    globalThis.fetch = this.originalFetch;
  }
}

const helpers = {
  isHidden(el: HTMLElement) {
    return el.offsetParent === null;
  },
  createServer() {
    return new FakeServer();
  },
  keydown(el: HTMLElement, key: string) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  keyup(el: HTMLElement, key: string) {
    const event = new KeyboardEvent("keyup", {
      key,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  click(el: HTMLElement) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  responseFor(suggestions: any) {
    return [
      200,
      { "Content-type": "application/json" },
      JSON.stringify({
        suggestions,
      }),
    ];
  },
  hitEnter(el: HTMLElement) {
    helpers.keydown(el, "Enter");
  },
  fireBlur(el: HTMLElement) {
    const event = new FocusEvent("blur", {
      bubbles: false,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  appendUnrestrictedValue(suggestion: any) {
    return { ...suggestion, unrestricted_value: suggestion.value };
  },
  wrapFormattedValue(value: any, status: any) {
    return `<span class="suggestions-value"${status ? ` data-suggestion-status="${status}"` : ""}>${value}</span>`;
  },
  returnStatus(server: any, status: any) {
    const urlPattern = String.raw`\/status\/(\w)`;

    server.respond("GET", new RegExp(urlPattern), JSON.stringify(status));
  },
  returnGoodStatus(server: any) {
    helpers.returnStatus(server, { search: true, enrich: true });
  },
  returnPoorStatus(server: any) {
    helpers.returnStatus(server, { search: true, enrich: false });
  },
};

export default helpers;
