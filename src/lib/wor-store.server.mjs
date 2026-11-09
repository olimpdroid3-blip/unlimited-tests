export function createWorStore() {
  async function request(path, init = {}) {
    const url = process.env.GVG_SUPABASE_URL,
      key = process.env.GVG_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw Error("WOR_CONFIG");
    let r;
    try {
      r = await fetch(url.replace(/\/$/, "") + path, {
        ...init,
        redirect: "manual",
        headers: { apikey: key, Authorization: "Bearer " + key, ...init.headers },
        signal: init.signal ?? AbortSignal.timeout(15000),
      });
    } catch (error) {
      // Map common transport failures to fixed codes; never expose a URL,
      // credentials, response body or raw exception text.
      const message = String(error?.message ?? "");
      const cause =
        message.includes("Invalid URL") || message.includes("parse URL")
          ? "URL"
          : message.includes("signal") || message.includes("AbortSignal")
            ? "SIGNAL"
            : message.includes("Illegal invocation")
              ? "INVOCATION"
              : error?.name === "TimeoutError"
                ? "TIMEOUT"
                : "FETCH";
      throw Error("WOR_TRANSPORT_" + cause);
    }
    if (!r.ok) throw Error("WOR_STORAGE_" + r.status);
    return r;
  }
  const rpc = async (name, args = {}) =>
    (
      await request("/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      })
    ).json();
  async function read() {
    let rows;
    try {
      rows = await (await request("/rest/v1/wor_state?id=eq.true&select=revision,data")).json();
    } catch (error) {
      if (String(error?.message ?? "").startsWith("WOR_")) throw error;
      throw Error("WOR_RESPONSE_JSON");
    }
    if (rows.length !== 1) throw Error("WOR_STATE");
    return rows[0];
  }
  async function transaction(fn) {
    for (let i = 0; i < 12; i++) {
      const { revision, data } = await read();
      data.requests = data.requests.filter((x) => x.expires > Date.now() - 86400000);
      data.sessions = data.sessions.filter((x) => x.expires > Date.now());
      const result = await fn(data);
      if (await rpc("wor_cas", { expected: revision, replacement: data })) return result;
    }
    throw Error("WOR_CONFLICT");
  }
  return {
    read,
    transaction,
    rpc,
    async rateWindow(key) {
      const rows = await (
        await request("/rest/v1/wor_rate?key=eq." + encodeURIComponent(key) + "&select=window_end")
      ).json();
      return rows[0]?.window_end;
    },
    get: (object) => request("/storage/v1/object/authenticated/wor-private/" + object),
    put: (object, body, type = "application/octet-stream") =>
      request("/storage/v1/object/wor-private/" + object, {
        method: "POST",
        headers: { "Content-Type": type, "x-upsert": "false" },
        body,
        duplex: "half",
        signal: AbortSignal.timeout(120000),
      }),
    remove: (objects) =>
      request("/storage/v1/object/wor-private", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: objects }),
      }),
    async snapshot() {
      await rpc("wor_snapshot");
    },
  };
}
