// Общие помощники сценарных проверок.
// Проверки гоняются против запущенного локально приложения (npm start) на копии
// прод-базы с тестовыми аккаунтами *@test.local — см. scripts/scenarios/README.md.

export const BASE = process.env.BASE_URL || "http://localhost:3000";
export const PASSWORD = process.env.TEST_PASSWORD || "test12345";

/** HTTP-клиент со своей банкой cookie: один клиент — один пользователь */
function createClient() {
  const jar = new Map();
  const store = (res) => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
    }
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  const client = {
    async req(path, opts = {}) {
      const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { ...(opts.headers || {}), cookie: cookie() },
        redirect: "manual",
      });
      store(res);
      return res;
    },
    async json(path, opts = {}) {
      const res = await client.req(path, opts);
      let body = null;
      try {
        body = await res.json();
      } catch {
        /* не JSON */
      }
      return { status: res.status, body };
    },
    async send(method, path, data) {
      return client.json(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
      });
    },
    async page(path) {
      const res = await client.req(path);
      return { status: res.status, location: res.headers.get("location"), html: await res.text() };
    },
    _store: store,
    _cookie: cookie,
  };
  return client;
}

/**
 * HTML без <script>: Next кладёт пропсы клиентских компонентов в скрипты страницы,
 * поэтому текст в сыром HTML есть, даже если на экране его нет. Проверки того, что
 * видит человек, ищут только в разметке.
 */
export function visibleHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function anon() {
  return createClient();
}

export async function login(email, password = PASSWORD) {
  const client = createClient();
  const csrf = await client.json("/api/auth/csrf");
  await client.req("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: csrf.body.csrfToken, email, password }),
  });
  const session = await client.json("/api/auth/session");
  if (session.body?.user?.email !== email) {
    throw new Error(`Не удалось войти как ${email} — приложение запущено, аккаунт есть?`);
  }
  client.user = session.body.user;
  return client;
}

/** Счётчик проверок: печатает каждую и выставляет код выхода */
export function suite(title) {
  let passed = 0;
  const failed = [];
  console.log(`\n=== ${title}`);
  return {
    check(name, ok, detail = "") {
      if (ok) {
        passed++;
        console.log(`  ✓ ${name}`);
      } else {
        failed.push(name);
        console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
      }
    },
    section(name) {
      console.log(`\n  — ${name}`);
    },
    done() {
      console.log(`\n${title}: ${passed} из ${passed + failed.length} прошли`);
      if (failed.length) {
        console.log("Упали:");
        for (const f of failed) console.log(`  - ${f}`);
        process.exitCode = 1;
      }
      return { passed, failed: failed.length };
    },
  };
}
