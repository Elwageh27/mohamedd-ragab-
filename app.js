// MINIA LEAGUE — Google Sheets / Apps Script edition
const API_URL = 'https://script.google.com/macros/s/AKfycbylbdane1GA_dBoUSD2u0-HEJk_0iLcGJc4GthfRoPAdsI9YdEPjDm5LNv0NHCtvF1ArA/exec';
const $ = id => document.getElementById(id);
let data = { competition:{title:'القسم الرابع',subtitle:'منطقة المنيا وبني سويف',season:'2026 / 2027',coachName:'كابتن رجب الوجيه',phone:'01200503513',currentWeek:4}, teams:[], matches:[], standings:[], fixtures:[] };
let adminPin = '';
let isAdmin = false;
const toast = msg => { const el=$('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); };
const weekName = n => ({1:'الأول',2:'الثاني',3:'الثالث',4:'الرابع',5:'الخامس',6:'السادس',7:'السابع',8:'الثامن',9:'التاسع',10:'العاشر'}[n] || String(n));
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function apiGet(extraParams={}){
 return new Promise((resolve,reject)=>{
  const cb='leagueCallback_'+Date.now()+'_'+Math.floor(Math.random()*100000);
  const script=document.createElement('script');
  const timer=setTimeout(()=>{cleanup();reject(new Error('انتهت مهلة الاتصال بقاعدة البيانات'));},15000);
  function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
  window[cb]=(response)=>{cleanup();resolve(response);};
  script.onerror=()=>{cleanup();reject(new Error('تعذر تحميل بيانات الدوري'));};
  const params=new URLSearchParams({callback:cb,_:Date.now(),...extraParams});
  script.src=API_URL+'?'+params.toString();
  document.head.appendChild(script);
 });
}
function normalize(response){
 // Apps Script returns the full {success, data} envelope for normal JSON,
 // but its JSONP callback may receive the data object directly.
 if(!response || typeof response !== 'object') throw new Error('استجابة غير صالحة من قاعدة البيانات');
 if(response.success === false) throw new Error(response.error || 'تعذر تحميل بيانات قاعدة البيانات');
 const d = response.data && typeof response.data === 'object' ? response.data : response;
 if(!Array.isArray(d.standings)) throw new Error('بيانات جدول الترتيب غير موجودة في استجابة قاعدة البيانات');
 const standings=d.standings;
 return {
  competition:d.competition || data.competition,
  teams:standings.map(t=>({id:String(t.id),name:String(t.name),played:Number(t.played||0),won:Number(t.won||0),drawn:Number(t.drawn||0),lost:Number(t.lost||0),gf:Number(t.gf||0),ga:Number(t.ga||0),diff:Number(t.diff||0),points:Number(t.points||0)})),
  standings,
  matches:Array.isArray(d.matches)?d.matches:[],
  fixtures:Array.isArray(d.fixtures)?d.fixtures:[]
 };
}
async function loadData(){
 const response=await apiGet();
 data=normalize(response);
 render();
 if($('connectionStatus')) $('connectionStatus').textContent='متصل بقاعدة البيانات السحابية';
 return data;
}
async function verifyAdminPin(pin){
 const nonce='v'+Date.now().toString(36)+Math.random().toString(36).slice(2,12);
 await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'verifyPin',pin,nonce})});
 await new Promise(r=>setTimeout(r,500));
 const result=await apiGet({authCheck:nonce});
 return !!(result && result.authVerified === true);
}
async function apiPost(action,fields={}){
 if(!adminPin) throw new Error('سجل دخول الإدارة أولًا');
 // text/plain is a CORS-safelisted content type; Apps Script receives JSON in postData.contents.
 await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,pin:adminPin,...fields})});
 // no-cors intentionally hides the response; re-read the source of truth to confirm the change.
 await new Promise(r=>setTimeout(r,900));
 return await loadData();
}
function calculateMatchCount(){return Math.round(data.teams.reduce((sum,t)=>sum+Number(t.played||0),0)/2);}
function render(){
 const standings=data.standings||[];
 const matches=[...(data.matches||[])].sort((a,b)=>Number(b.week)-Number(a.week));
 $('heroTitle').innerHTML=escapeHtml(data.competition.title).replace('الرابع','<em>الرابع</em>');
 $('heroSubtitle').textContent=data.competition.subtitle;
 $('seasonLabel').textContent=data.competition.season;
 $('teamCount').textContent=data.teams.length;
 $('statTeams').textContent=data.teams.length;
 $('statMatches').textContent=calculateMatchCount();
 $('statWeek').textContent=weekName(Number(data.competition.currentWeek));
 $('tableWeek').textContent='بعد الأسبوع '+weekName(Number(data.competition.currentWeek));
 $('tableSeason').textContent=data.competition.subtitle;
 $('statLeader').textContent=standings[0]?.name||'—';
 $('standingsBody').innerHTML=standings.map((t,i)=>`<tr><td class="rank">${i+1}</td><td class="team-cell"><span class="team-badge">⚽</span>${escapeHtml(t.name)}</td><td>${t.played}</td><td class="positive">${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf}</td><td>${t.ga}</td><td class="${t.diff>0?'positive':t.diff<0?'negative':''}">${t.diff>0?'+':''}${t.diff}</td><td class="points">${t.points}</td></tr>`).join('');
 $('resultsList').innerHTML=matches.length?matches.map(m=>matchHtml(m,false)).join(''):'<div class="empty-state">لم يتم تسجيل نتائج المباريات الجديدة بعد.</div>';
 $('fixturesList').innerHTML='<div class="empty-state">سيتم تفعيل إدارة المباريات القادمة في المرحلة التالية.</div>';
 $('coachWhatsApp').href=`https://wa.me/2${String(data.competition.phone||'').replace(/\D/g,'')}`;
 if(isAdmin) renderAdmin();
}
function teamName(id){return data.teams.find(t=>t.id===String(id))?.name||'فريق غير معروف';}
function matchHtml(m,admin){return `<div class="match-row"><span class="match-week">الأسبوع ${m.week}</span><div class="match-teams"><span>${escapeHtml(teamName(m.homeId))}</span><span class="score">${m.homeGoals} - ${m.awayGoals}</span><span>${escapeHtml(teamName(m.awayId))}</span></div><span class="match-date">${escapeHtml(m.date||'')}</span>${admin?`<span class="mini-actions"><button class="mini-btn" data-edit-match="${escapeHtml(m.id)}">تعديل</button><button class="mini-btn delete" data-delete-match="${escapeHtml(m.id)}">حذف</button></span>`:''}</div>`;}
function fillSelects(){['homeTeam','awayTeam'].forEach(id=>{const s=$(id);if(!s)return;const old=s.value;s.innerHTML=data.teams.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');if([...s.options].some(o=>o.value===old))s.value=old;});}
function renderAdmin(){
 fillSelects();
 $('adminMatches').innerHTML=data.matches.slice().sort((a,b)=>Number(b.week)-Number(a.week)).map(m=>matchHtml(m,true)).join('')||'<div class="empty-state">لا توجد نتائج مسجلة.</div>';
 $('manualTeam').innerHTML=data.teams.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
 renderManualStats();
 $('adminTeams').innerHTML=data.teams.map(t=>`<div class="admin-item"><span>${escapeHtml(t.name)}</span><div class="mini-actions"><button class="mini-btn" data-rename-team="${escapeHtml(t.id)}">تعديل الاسم</button><button class="mini-btn delete" data-delete-team="${escapeHtml(t.id)}">حذف</button></div></div>`).join('');
 $('settingTitle').value=data.competition.title;$('settingSubtitle').value=data.competition.subtitle;$('settingSeason').value=data.competition.season;$('settingCoach').value=data.competition.coachName;$('settingPhone').value=data.competition.phone;$('settingWeek').value=data.competition.currentWeek;
}
function renderManualStats(){
 const id=$('manualTeam')?.value || data.teams[0]?.id;
 const t=data.standings.find(x=>String(x.id)===String(id));
 if(!t)return;
 const fields={manualPlayed:t.played,manualWon:t.won,manualDrawn:t.drawn,manualLost:t.lost,manualGF:t.gf,manualGA:t.ga,manualPoints:t.points};
 Object.entries(fields).forEach(([key,value])=>{if($(key))$(key).value=value;});
}
function setAdmin(on){isAdmin=on;$('loginCard').classList.toggle('hidden',on);$('dashboard').classList.toggle('hidden',!on);if(on)renderAdmin();}

// Admin login: the PIN is kept in memory only and is never embedded in the public site.
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const pin=$('password').value.trim();
 if(!pin){$('loginNote').textContent='اكتب رمز الإدارة.';return;}
 const button=e.submitter;button.disabled=true;$('loginNote').textContent='جارٍ التحقق من الرمز...';
 try{
  const valid=await verifyAdminPin(pin);
  if(!valid) throw new Error('رمز الإدارة غير صحيح.');
  adminPin=pin;setAdmin(true);await loadData();$('password').value='';$('loginNote').textContent='';toast('تم التحقق وفتح لوحة الإدارة.');
 }catch(err){adminPin='';setAdmin(false);$('loginNote').textContent=err.message||'تعذر التحقق من رمز الإدارة.';}
 finally{button.disabled=false;}
});
$('logoutBtn').addEventListener('click',()=>{adminPin='';setAdmin(false);$('password').value='';toast('تم تسجيل الخروج');});
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.tab).classList.add('active');}));
$('matchForm').addEventListener('submit',async e=>{
 e.preventDefault();const homeId=$('homeTeam').value,awayId=$('awayTeam').value;
 if(homeId===awayId){toast('اختار فريقين مختلفين');return;}
 const button=e.submitter;button.disabled=true;
 try{await apiPost('addMatch',{week:Number($('matchWeek').value),homeId,awayId,homeGoals:Number($('homeGoals').value),awayGoals:Number($('awayGoals').value),date:$('matchDate').value});$('matchFeedback').textContent='تم حفظ النتيجة وتحديث الترتيب.';e.target.reset();$('matchWeek').value=Number(data.competition.currentWeek)+1;toast('تم حفظ النتيجة وتحديث الجدول عند الجميع');}
 catch(err){$('matchFeedback').textContent='تعذر تأكيد الحفظ. راجع رمز الإدارة واتصال الإنترنت ثم حدّث الصفحة.';toast(err.message);}
 finally{button.disabled=false;}
});
$('teamForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('newTeamName').value.trim();if(!name)return;try{await apiPost('addTeam',{name});e.target.reset();toast('تمت إضافة الفريق');}catch(err){toast('تعذر إضافة الفريق: '+err.message);}});
$('adminMatches').addEventListener('click',async e=>{
 const editId=e.target.dataset.editMatch, deleteId=e.target.dataset.deleteMatch;
 if(editId){
  const m=data.matches.find(x=>String(x.id)===String(editId));if(!m)return;
  const week=prompt('رقم الأسبوع',m.week);if(week===null)return;
  const hg=prompt('أهداف الفريق الأول',m.homeGoals);if(hg===null)return;
  const ag=prompt('أهداف الفريق الثاني',m.awayGoals);if(ag===null)return;
  try{await apiPost('editMatch',{id:editId,week:Number(week),homeGoals:Number(hg),awayGoals:Number(ag),date:m.date||''});toast('تم تعديل النتيجة وإعادة حساب الجدول');}
  catch(err){toast('تعذر تعديل النتيجة: '+err.message);}return;
 }
 if(!deleteId)return;
 if(!confirm('متأكد من حذف النتيجة؟ سيتم إعادة حساب الترتيب.'))return;
 try{await apiPost('deleteMatch',{id:deleteId});toast('تم حذف النتيجة وإعادة الحساب');}
 catch(err){toast('تعذر حذف النتيجة: '+err.message);}
});
$('manualTeam').addEventListener('change',renderManualStats);
$('manualStatsForm').addEventListener('submit',async e=>{
 e.preventDefault();const id=$('manualTeam').value;
 const stats={played:Number($('manualPlayed').value),won:Number($('manualWon').value),drawn:Number($('manualDrawn').value),lost:Number($('manualLost').value),gf:Number($('manualGF').value),ga:Number($('manualGA').value),points:Number($('manualPoints').value)};
 if(Object.values(stats).some(v=>!Number.isInteger(v)||v<0)){toast('كل القيم لازم تكون أرقامًا صحيحة غير سالبة.');return;}
 if(stats.won+stats.drawn+stats.lost!==stats.played){toast('مجموع الفوز والتعادل والخسارة لازم يساوي عدد المباريات.');return;}
 if(!confirm('سيتم استبدال الرصيد الأساسي لهذا الفريق بهذه القيم، ثم إضافة نتائج المباريات المسجلة فوقه. متأكد؟'))return;
 try{await apiPost('updateBaseStats',{id,stats});toast('تم تصحيح الرصيد الأساسي وإعادة حساب الترتيب');}
 catch(err){toast('تعذر حفظ التصحيح: '+err.message);}
});
$('adminTeams').addEventListener('click',async e=>{
 const del=e.target.dataset.deleteTeam,rename=e.target.dataset.renameTeam;
 if(del){if(data.matches.some(m=>String(m.homeId)===del||String(m.awayId)===del)){toast('لا يمكن حذف فريق لديه مباريات مسجلة.');return;}if(confirm('حذف الفريق؟')){try{await apiPost('deleteTeam',{id:del});toast('تم حذف الفريق');}catch(err){toast('تعذر حذف الفريق: '+err.message);}}}
 if(rename){const t=data.teams.find(x=>x.id===rename),name=prompt('اكتب الاسم الجديد للفريق',t?.name);if(name?.trim()){try{await apiPost('renameTeam',{id:rename,name:name.trim()});toast('تم تعديل اسم الفريق');}catch(err){toast('تعذر تعديل الفريق: '+err.message);}}}
});
$('settingsForm').addEventListener('submit',async e=>{e.preventDefault();const values={League_Name:$('settingTitle').value,Region:$('settingSubtitle').value,Season:$('settingSeason').value,Coach_Name:$('settingCoach').value,Coach_Phone:$('settingPhone').value,Current_Week:Number($('settingWeek').value)};try{await apiPost('updateSettings',{values});$('settingsFeedback').textContent='تم حفظ الإعدادات';toast('تم تحديث بيانات البطولة');}catch(err){toast('تعذر حفظ الإعدادات: '+err.message);}});
// The original project had a local-only fixtures feature; it is intentionally disabled until the API gets a shared Fixtures sheet.
const fixtureTabButton=document.querySelector('[data-tab="fixtureTab"]');if(fixtureTabButton)fixtureTabButton.style.display='none';
const fixtureTab=$('fixtureTab');if(fixtureTab)fixtureTab.style.display='none';
$('resetBtn').style.display='none';
$('adminReveal').addEventListener('click',()=>{
 $('admin').classList.remove('hidden');
 $('admin').scrollIntoView({behavior:'smooth',block:'start'});
});
$('menuToggle').addEventListener('click',()=>document.querySelector('.site-header nav').classList.toggle('open'));
$('yearNow').textContent=new Date().getFullYear();
loadData().catch(err=>{console.error(err);toast('تعذر الاتصال بقاعدة بيانات الدوري: '+err.message);$('standingsBody').innerHTML='<tr><td colspan="10">تعذر تحميل الجدول. أعد تحميل الصفحة.</td></tr>';});
