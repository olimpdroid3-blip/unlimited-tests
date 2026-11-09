import { timingSafeEqual } from "node:crypto";
const utf8 = new TextEncoder();
export const MACHINE = /^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){3}$/;
export const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const base64url = (bytes) => Buffer.from(bytes).toString("base64url");
export function decode(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]+$/.test(s)) throw Error("base64url");
  const b = Buffer.from(s, "base64url");
  if (base64url(b) !== s) throw Error("base64url");
  return b;
}
export const randomSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const sha256 = async (value) =>
  base64url(
    await crypto.subtle.digest("SHA-256", typeof value === "string" ? utf8.encode(value) : value),
  );
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function licensePayload(machine, name, expires) {
  if (
    !MACHINE.test(machine) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 80 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expires) ||
    new Date(expires + "T00:00:00Z").toISOString().slice(0, 10) !== expires
  )
    throw Error("license");
  return JSON.stringify({ v: 1, m: machine, n: name, e: expires });
}
export async function signLicense(pkcs8, machine, name, expires) {
  const key = await crypto.subtle.importKey("pkcs8", decode(pkcs8), "Ed25519", false, ["sign"]);
  const bytes = utf8.encode(licensePayload(machine, name, expires));
  return base64url(bytes) + "." + base64url(await crypto.subtle.sign("Ed25519", key, bytes));
}
export const expiry = (now = Date.now()) => new Date(now + 7 * 86400000).toISOString().slice(0, 10);
export function versionCompare(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw Error("version");
  const x = a.split(".").map(BigInt),
    y = b.split(".").map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  return 0;
}
export function exactStrings(value, keys) {
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.keys(value).length !== keys.length ||
    keys.some((k) => typeof value[k] !== "string")
  )
    throw Error("fields");
  return value;
}
export function manifestPath(manifest, origin = "https://unlimited-tests.lovable.app") {
  const url = new URL(manifest.url, origin);
  if (
    url.origin !== origin ||
    url.protocol !== "https:" ||
    url.search ||
    url.hash ||
    !/^\/downloads\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.exe$/.test(url.pathname)
  )
    throw Error("manifest URL");
  return url.pathname;
}
export function parseManifest(bytes, origin = "https://unlimited-tests.lovable.app") {
  const m = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    !m ||
    Array.isArray(m) ||
    typeof m !== "object" ||
    !["string", "number"].includes(typeof m.version) ||
    !String(m.version).trim() ||
    String(m.version).length > 80 ||
    typeof m.url !== "string" ||
    typeof m.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(m.sha256) ||
    typeof m.signature !== "string"
  )
    throw Error("manifest");
  manifestPath(m, origin);
  return m;
}
export function parseTables(bytes) {
  const t = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    !t ||
    Array.isArray(t) ||
    typeof t !== "object" ||
    !Number.isInteger(t.version) ||
    !t.dist ||
    Array.isArray(t.dist) ||
    typeof t.dist !== "object" ||
    typeof t.signature !== "string"
  )
    throw Error("tables");
  return { version: String(t.version) };
}
