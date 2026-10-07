const fs=require('fs');
const results=[];
function redact(obj){return JSON.parse(JSON.stringify(obj,(k,v)=>{
  if(typeof v==='string'&&/token|password|secret|authorization|cookie/i.test(String(k)))return '[REDACTED len='+v.length+']';
  if(typeof v==='string'&&v.length>300)return v.slice(0,120)+'...[trunc]';
  return v;
}));}
async function hit(name,url,opts={}){
  try{
    const res=await fetch(url,opts);
    const ct=res.headers.get('content-type')||'';
    const text=await res.text();
    let body;
    try{body=JSON.parse(text);}catch{body={rawType:ct,rawLen:text.length,snippet:text.replace(/\s+/g,' ').slice(0,160)};}
    const shape=body&&typeof body==='object'?(Array.isArray(body)?'array(len='+body.length+')':'keys='+Object.keys(body).slice(0,12).join(',')):typeof body;
    results.push({name,status:res.status,shape,body:redact(body)});
    return {res,body,status:res.status};
  }catch(e){results.push({name,error:e.message});return {error:e.message};}
}
(async()=>{
const login=await hit('LOGIN_connect','http://127.0.0.1:3000/api/auth/connect',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0 QA-Accountant'},body:JSON.stringify({code:'SS-2283',name:'QA'})});
const token=login.body&&login.body.token; const user=login.body&&login.body.user;
if(!token){console.log(JSON.stringify({fatal:'no token',results},null,2)); process.exit(1);}
results.push({name:'LOGIN_USER_SUMMARY',status:200,body:{id:user.id,role:user.role,roleName:user.roleName,email:user.email?String(user.email).replace(/(.{3}).+(@.+)/,'$1***$2'):null,username:user.username?String(user.username).slice(0,6)+'***':null}});
const H={'Content-Type':'application/json','User-Agent':'Mozilla/5.0 QA-Accountant','Authorization':'Bearer '+token,'Cookie':'south_street_token='+token};
await hit('SETTINGS_account_me_GET','http://127.0.0.1:3000/api/account/me',{headers:H});
await hit('SETTINGS_account_security_GET','http://127.0.0.1:3000/api/account/security',{headers:H});
await hit('SETTINGS_account_me_PUT','http://127.0.0.1:3000/api/account/me',{method:'PUT',headers:H,body:JSON.stringify({phone:user.phone||'0556277603'})});
await hit('SETTINGS_account_me_PATCH','http://127.0.0.1:3000/api/account/me',{method:'PATCH',headers:H,body:JSON.stringify({phone:user.phone||'0556277603'})});
await hit('RECEIPTS_GET','http://127.0.0.1:3000/api/receipts',{headers:H});
await hit('RECEIPTS_GET_unauth','http://127.0.0.1:3000/api/receipts',{headers:{'User-Agent':'Mozilla/5.0 QA'}});
await hit('BOOKINGS_CONFIRM_GET','http://127.0.0.1:3000/api/bookings/confirm',{headers:H});
await hit('BOOKINGS_CONFIRM_POST_act','http://127.0.0.1:3000/api/bookings/confirm',{method:'POST',headers:H,body:JSON.stringify({reservationId:'NONEXIST-QA',action:'confirm'})});
await hit('BOOKINGS_LIST','http://127.0.0.1:3000/api/bookings',{headers:H});
await hit('FIREWALL_GET','http://127.0.0.1:3000/api/security/firewall',{headers:H});
await hit('FIREWALL_POST_block','http://127.0.0.1:3000/api/security/firewall',{method:'POST',headers:H,body:JSON.stringify({action:'block',ip:'203.0.113.9',note:'QA should fail'})});
await hit('SECURITY_MONITOR','http://127.0.0.1:3000/api/security/monitor',{headers:H});
await hit('ADMIN_USERS_GET','http://127.0.0.1:3000/api/admin/users',{headers:H});
await hit('ADMIN_USERS_POST','http://127.0.0.1:3000/api/admin/users',{method:'POST',headers:H,body:JSON.stringify({action:'list'})});
await hit('ADMIN_DB_TABLES','http://127.0.0.1:3000/api/admin/db-tables',{headers:H});
await hit('ADMIN_SECURITY_KEY','http://127.0.0.1:3000/api/admin/security-key',{headers:H});
await hit('SESSION_HEARTBEAT','http://127.0.0.1:3000/api/session/heartbeat',{method:'POST',headers:H,body:JSON.stringify({})});
await hit('AUTH_CONFIG','http://127.0.0.1:3000/api/auth/config',{headers:H});
await hit('UI_portal','http://127.0.0.1:3000/portal',{headers:H});
await hit('UI_admin','http://127.0.0.1:3000/admin',{headers:H});
fs.writeFileSync('qa_accountant_results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
})();
