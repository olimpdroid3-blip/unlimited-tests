import { randomSecret } from "./wor-crypto.mjs";
export function worAdminPage() {
  const nonce = randomSecret();
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Программа альянса — управление</title>
 <style nonce="${nonce}">:root{font:16px system-ui;color:#ecf1f9;background:#101722}body{max-width:1100px;margin:36px auto;padding:0 18px}a{color:#9ecfff}h1{font-size:28px}section{padding:20px;margin:20px 0;background:#1c2838;border:1px solid #3b4c64;border-radius:12px}input,button{font:inherit;padding:9px;border-radius:6px;border:1px solid #647d9d;margin:6px 0}button{cursor:pointer;background:#b8d9ff;color:#12233a;margin-right:8px}input{box-sizing:border-box;width:100%;background:#101722;color:inherit;display:block}label{display:block;margin:10px 0}td,th{text-align:left;padding:9px;border-bottom:1px solid #3b4c64;font-size:14px}table{border-collapse:collapse;width:100%}td{overflow-wrap:anywhere}.scroll{overflow:auto}#message{white-space:pre-wrap;color:#ffda9f}small{color:#bbcadf}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
 <a href="/">← Tower Keeper</a><h1>Программа альянса</h1><p id="message" role="status"></p><main id="app"></main>
 <script nonce="${nonce}">
 const app=document.querySelector('#app'),message=document.querySelector('#message');let csrf='',timer;
 function el(tag,text,parent=app){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;}
 function section(title){const s=el('section');el('h2',title,s);return s;}
 function input(parent,label,type='text',value=''){const l=el('label',label,parent),i=el('input',undefined,l);i.type=type;i.value=value;return i;}
 function button(parent,label,fn){const b=el('button',label,parent);b.type='button';b.onclick=async()=>{b.disabled=true;message.textContent='';try{await fn();}catch(e){message.textContent=e.message;}finally{b.disabled=false;}};return b;}
 async function api(path,data,method='POST'){const r=await fetch(path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(method==='GET'?{}:{body:JSON.stringify(data)})});let b;try{b=await r.json();}catch{throw Error('Сервис недоступен');}if(!r.ok)throw Error(b.message||'Действие не выполнено');return b;}
 async function upload(path,file){const r=await fetch(path,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:file});const b=await r.json();if(!r.ok)throw Error(b.message||'Файл не принят');return b;}
 function table(parent,headers,rows){const wrap=el('div',undefined,parent);wrap.className='scroll';const t=el('table',undefined,wrap),head=el('tr',undefined,t);headers.forEach(x=>el('th',x,head));for(const cells of rows){const row=el('tr',undefined,t);for(const c of cells){const td=el('td',undefined,row);if(typeof c==='function')c(td);else td.textContent=String(c??'');}}}
 const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 async function login(){
  app.replaceChildren();const s=section('Вход владельца через Telegram');el('p','Управление доступно только закреплённому Telegram ID владельца. Подтвердите вход в теме «Важлива інформація онлі». Отдельный пароль сайта не нужен.',s);
  button(s,'Получить запрос на вход',async()=>{
   clearTimeout(timer);const poll_secret=b64(crypto.getRandomValues(new Uint8Array(32))),poll_hash=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(poll_secret)));
   const r=await api('/api/wor/admin/start',{poll_hash});
   const a=el('a','Открыть нашего бота',s);a.href=r.activate_url;a.target='_blank';a.rel='noopener noreferrer';el('p','После открытия бота нажмите «Подтвердить» в теме клана. Затем вернитесь сюда. Срок запроса — 10 минут.',s);
   const stop=Date.now()+600000;
   async function poll(){if(Date.now()>stop){message.textContent='Запрос истёк. Начните вход заново.';return;}try{const b=await api('/api/wor/admin/poll',{request_id:r.request_id,poll_secret});if(b.status==='ok'){await render();return;}timer=setTimeout(poll,3000);}catch(e){message.textContent=e.message;}}
   timer=setTimeout(poll,3000);
  });
 }
 async function action(action,target,value=''){await api('/api/wor/admin/action',{action,target,value});await render();}
 async function render(){
  clearTimeout(timer);let data;try{data=await api('/api/wor/admin',undefined,'GET');}catch{await login();return;}csrf=data.csrf;app.replaceChildren();
  button(app,'Выйти',async()=>{await api('/api/wor/admin/logout',{});csrf='';await login();});
  const members=section('Участники');table(members,['Telegram ID','Имя','Статус','Лимит','Действия'],data.members.map(m=>[m.id,m.name,m.banned?'Заблокирован':'Разрешён',m.limit??data.settings.device_limit,td=>{if(m.id!==data.settings.owner_id)button(td,m.banned?'Разблокировать':'Заблокировать',()=>action(m.banned?'unban':'ban',m.id));button(td,'Отозвать все',()=>action('revoke_all',m.id));const l=input(td,'Лимит','number',m.limit??data.settings.device_limit);l.min=1;l.max=10;button(td,'Сохранить',()=>action('limit',m.id,l.value));}]));
  const devices=section('Устройства');const name=id=>data.members.find(x=>x.id===id)?.name??id;table(devices,['Код','Участник / ID','Выдана','Продлена','Версия','До UTC','Статус',''],data.devices.map(d=>[d.machine,name(d.owner)+' / '+d.owner,d.issued,d.renewed,d.version,d.expiry,d.status,td=>{if(d.status==='active')button(td,'Отозвать',()=>action('revoke',d.id));}]));
  const settings=section('Настройки');const lim=input(settings,'Лимит устройств по умолчанию','number',data.settings.device_limit);lim.min=1;lim.max=10;button(settings,'Сохранить лимит',()=>action('limit','default',lim.value));el('p','Подтверждения: NoName Clan → Важлива інформація онлі (тема 6). Отзыв сразу запрещает продление и загрузки. Уже выданная офлайн-лицензия может работать до своей даты окончания (7 дней).',settings);el('pre','Публичный ключ лицензий: '+data.settings.license_public_key,settings);
  const releases=section('Обновления');el('p','Загрузите подписанный на своём компьютере manifest.json и соответствующий EXE. Сервер сверяет SHA-256 файла и сохраняет исходные байты. Подпись проверяет Windows-программа своим закреплённым офлайн-ключом.',releases);
  const mf=input(releases,'manifest.json','file'),exe=input(releases,'EXE (до 50 МиБ)','file');mf.accept='.json';exe.accept='.exe';
  button(releases,'Загрузить релиз',async()=>{if(!mf.files[0]||!exe.files[0])throw Error('Выберите manifest.json и EXE');if(mf.files[0].size>32768||exe.files[0].size>52428800)throw Error('Слишком большой файл');const r=await upload('/api/wor/admin/manifest',mf.files[0]);try{await upload('/api/wor/admin/exe/'+r.release_id,exe.files[0]);}catch(e){message.textContent='Загрузка не завершена. Удалите черновик и повторите. '+e.message;await render();return;}await render();});
  table(releases,['Версия','Минимум','Состояние','Действия'],data.releases.map(r=>[r.manifest.version,r.manifest.min_version,r.id===data.settings.current_release?'Опубликован':r.ready?'Готов':'Черновик',td=>{if(r.ready&&r.id!==data.settings.current_release)button(td,'Опубликовать',async()=>{await api('/api/wor/admin/publish',{release_id:r.id});await render();});if(r.id!==data.settings.current_release)button(td,'Удалить',async()=>{await api('/api/wor/admin/delete-release',{release_id:r.id});await render();});}]));
  const tables=section('Таблицы шансов');const current=data.tables.find(t=>t.id===data.settings.current_tables);el('p',current?'Текущая версия: '+current.version+'; '+current.bytes+' байт; SHA-256: '+current.sha256:'Файл пока не загружен.',tables);if(current){const a=el('a','Просмотреть исходный tables.json',tables);a.href='/api/wor/admin/tables';a.target='_blank';a.rel='noopener noreferrer';}const tf=input(tables,'Подписанный tables.json (до 1 МиБ)','file');tf.accept='.json';button(tables,'Загрузить таблицы',async()=>{if(!tf.files[0]||tf.files[0].size>1048576)throw Error('Выберите файл до 1 МиБ');await upload('/api/wor/admin/tables',tf.files[0]);await render();});
  const backup=section('Бэкапы и экспорт');const a=el('a','Скачать список устройств, настройки, релизы и аудит',backup);a.href='/api/wor/admin/export';button(backup,'Создать снимок в БД',async()=>{await api('/api/wor/admin/snapshot',{});message.textContent='Снимок сохранён';});el('p','Ежедневные снимки в 02:15 UTC хранятся 35 дней. Экспорт содержит хэши секретов и личные данные: храните зашифрованным. Файлы релизов и ключ Vault резервируются отдельно — см. инструкцию.',backup);
  const journal=section('Журнал действий');table(journal,['Дата','Telegram ID','Действие','Объект'],data.audit.slice().reverse().map(x=>[x.at,x.actor,x.action,x.target]));
 }
 render().catch(e=>message.textContent=e.message);
 </script></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'nonce-" +
        nonce +
        "'; style-src 'nonce-" +
        nonce +
        "'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
