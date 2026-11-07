export const MAX_BODY = 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v,max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const positive = v => Number.isSafeInteger(v) && v > 0;
export function validate(body, key) {
  if (!body || Array.isArray(body) || body.schema_version !== 1 ||
      !uuid.test(body.report_id ?? '') || !uuid.test(body.scouting_id ?? '') ||
      key !== body.report_id || !positive(body.scouting_revision) || !text(body.match_id,200) ||
      !Array.isArray(body.reports) || body.reports.length < 2 || body.reports.length > 48 || body.reports.length % 2) return false;
  const positions = new Set();
  for (let i=0;i<body.reports.length;i++) {
    const r = body.reports[i];
    if (!r || !/^[1-4]\.[1-6]\.[1-2]$/.test(r.tower_position ?? '') || positions.has(r.tower_position) ||
        !text(r.player_name,512) || !positive(r.total_bp) || !text(r.captured_at,100) ||
        !/T.*(Z|[+-][0-9]{2}:[0-9]{2})$/.test(r.captured_at) || !Number.isFinite(Date.parse(r.captured_at)) ||
        !Array.isArray(r.heroes) || r.heroes.length !== 5) return false;
    positions.add(r.tower_position);
    let sum = 0;
    for (const h of r.heroes) {
      if (!h || !text(h.name,256) || !positive(h.bp) ||
          !(h.awakening === null || (Number.isInteger(h.awakening) && h.awakening >= 0 && h.awakening <= 5))) return false;
      sum += h.bp;
    }
    if (sum !== r.total_bp) return false;
    if (i % 2) {
      const prev = body.reports[i-1];
      if (prev.tower_position.slice(0,4) !== r.tower_position.slice(0,4) ||
          prev.player_name !== r.player_name || Date.parse(prev.captured_at) !== Date.parse(r.captured_at)) return false;
    }
  }
  return true;
}
export async function sha256(value) {
  const result = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(result)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const reply = (status, body) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function createHandler(rpc) {
  return async request => {
    if (!['GET','POST'].includes(request.method)) return reply(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
    const auth = request.headers.get('Authorization') ?? '';
    if (!/^Bearer [\x21-\x7e]{32,512}$/.test(auth)) return reply(401,{ok:false,code:'UNAUTHORIZED'});
    try {
      const tokenHash = await sha256(auth.slice(7));
      const context = await rpc('awakening_context',{p_token_hash:tokenHash});
      if (!context.ok) return reply(context.status ?? 401,context);
      if (request.method === 'GET') return reply(200,context);
      if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return reply(415,{ok:false,code:'JSON_REQUIRED'});
      if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return reply(413,{ok:false,code:'TOO_LARGE'});
      const reader = request.body?.getReader();
      if (!reader) return reply(400,{ok:false,code:'INVALID_JSON'});
      const chunks=[]; let length=0;
      while (true) {
        const {done,value}=await reader.read(); if (done) break;
        length += value.byteLength;
        if (length>MAX_BODY) { await reader.cancel(); return reply(413,{ok:false,code:'TOO_LARGE'}); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset=0;
      for (const chunk of chunks) { bytes.set(chunk,offset);offset+=chunk.length; }
      let raw,body;
      try { raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);body=JSON.parse(raw); }
      catch { return reply(400,{ok:false,code:'INVALID_JSON'}); }
      if (!validate(body,request.headers.get('Idempotency-Key'))) return reply(400,{ok:false,code:'INVALID_REPORT'});
      const result=await rpc('awakening_import',{p_token_hash:tokenHash,p_body:body,p_body_hash:await sha256(raw)});
      return reply(result.ok ? 200 : (result.status ?? 400),result);
    } catch {
      return reply(503,{ok:false,code:'TEMPORARILY_UNAVAILABLE'});
    }
  };
}
