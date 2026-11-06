// MINIA LEAGUE — Google Sheets / Apps Script edition
const API_URL = 'https://script.google.com/macros/s/AKfycbylbdane1GA_dBoUSD2u0-HEJk_0iLcGJc4GthfRoPAdsI9YdEPjDm5LNv0NHCtvF1ArA/exec';
const $ = id => document.getElementById(id);
let data = { competition:{title:'القسم الرابع',subtitle:'منطقة المنيا وبني سويف',season:'2026 / 2027',coachName:'كابتن رجب الوجيه',phone:'01200503513',currentWeek:4}, teams:[], matches:[], standings:[], fixtures:[], news:[] };
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
  fixtures:Array.isArray(d.fixtures)?d.fixtures:[],
  news:Array.isArray(d.news)?d.news:[]
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
function downloadStandingsAsImage(){
 const rows=data.standings||[];
 if(!rows.length){toast('لا يوجد ترتيب متاح لتحويله إلى صورة');return;}
 const width=1800, headerH=300, tableHeadH=100, rowH=94, footerH=150;
 const height=headerH+tableHeadH+rows.length*rowH+footerH;
 const scale=2;
 const canvas=document.createElement('canvas');
 canvas.width=width*scale; canvas.height=height*scale;
 const ctx=canvas.getContext('2d');
 ctx.scale(scale,scale);
 ctx.direction='rtl';
 ctx.fillStyle='#f4f7fb';ctx.fillRect(0,0,width,height);
 // Main title panel
 const grad=ctx.createLinearGradient(0,0,width,headerH);
 grad.addColorStop(0,'#071629');grad.addColorStop(1,'#12345a');
 ctx.fillStyle=grad;ctx.fillRect(0,0,width,headerH);
 // Decorative accents
 ctx.fillStyle='rgba(255,255,255,.06)';
 ctx.beginPath();ctx.arc(150,30,260,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.arc(width-100,headerH+20,210,0,Math.PI*2);ctx.fill();
 // Football emblem
 ctx.beginPath();ctx.arc(width/2,72,37,0,Math.PI*2);ctx.fillStyle='#f0b94d';ctx.fill();
 ctx.font='30px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#071629';ctx.fillText('⚽',width/2,73);
 ctx.fillStyle='#ffffff';ctx.font='800 48px Cairo, sans-serif';ctx.fillText(data.competition.title||'دوري القسم الرابع',width/2,145);
 ctx.font='600 30px Cairo, sans-serif';ctx.fillStyle='#d9e6f5';ctx.fillText(data.competition.subtitle||'منطقة المنيا وبني سويف',width/2,195);
 ctx.font='700 29px Cairo, sans-serif';ctx.fillStyle='#f0b94d';
 const wk=Number(data.competition.currentWeek)||0;
 ctx.fillText('جدول الترتيب بعد الأسبوع '+weekName(wk),width/2,250);
 // Table header
 const top=headerH;
 ctx.fillStyle='#e9eef5';ctx.fillRect(48,top,width-96,tableHeadH);
 const cols=[
  {key:'rank',label:'#',x:1710},{key:'name',label:'الفريق',x:1455},
  {key:'played',label:'لعب',x:1160},{key:'won',label:'فاز',x:1000},
  {key:'drawn',label:'تعادل',x:840},{key:'lost',label:'خسر',x:680},
  {key:'gf',label:'له',x:520},{key:'ga',label:'عليه',x:360},
  {key:'diff',label:'الفارق',x:205},{key:'points',label:'النقاط',x:85}
 ];
 ctx.textBaseline='middle';ctx.font='800 25px Cairo, sans-serif';ctx.fillStyle='#183452';
 cols.forEach(c=>{ctx.textAlign=c.key==='name'?'right':'center';ctx.fillText(c.label,c.x,c.key==='name'?top+tableHeadH/2:top+tableHeadH/2);});
 rows.forEach((t,i)=>{
  const y=top+tableHeadH+i*rowH;
  ctx.fillStyle=i%2===0?'#ffffff':'#f8fafc';ctx.fillRect(48,y,width-96,rowH);
  ctx.strokeStyle='#e1e8f0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,y+rowH);ctx.lineTo(width-48,y+rowH);ctx.stroke();
  // rank marker
  ctx.beginPath();ctx.arc(1710,y+rowH/2,25,0,Math.PI*2);
  ctx.fillStyle=i===0?'#e8b64e':i<3?'#dcebe3':'#edf1f6';ctx.fill();
  ctx.fillStyle=i<3?'#17304d':'#506176';ctx.font='800 23px Cairo, sans-serif';ctx.textAlign='center';ctx.fillText(String(i+1),1710,y+rowH/2+1);
  // team name and small football badge
  ctx.textAlign='right';ctx.fillStyle='#10243d';ctx.font='800 25px Cairo, sans-serif';
  ctx.fillText(String(t.name||''),1515,y+rowH/2,360);
  ctx.textAlign='center';ctx.font='24px Arial';ctx.fillStyle='#36516f';ctx.fillText('⚽',1240,y+rowH/2);
  const vals={played:t.played,won:t.won,drawn:t.drawn,lost:t.lost,gf:t.gf,ga:t.ga,diff:(Number(t.diff)>0?'+':'')+t.diff,points:t.points};
  cols.filter(c=>c.key!=='rank'&&c.key!=='name').forEach(c=>{
   ctx.textAlign='center';ctx.font=c.key==='points'?'900 27px Cairo, sans-serif':'700 25px Cairo, sans-serif';
   ctx.fillStyle=c.key==='points'?'#0b2948':c.key==='won'?'#15936a':c.key==='diff'?(Number(t.diff)>0?'#15936a':Number(t.diff)<0?'#dc4545':'#506176'):'#243b55';
   ctx.fillText(String(vals[c.key]??0),c.x,y+rowH/2);
  });
 });
 const footerY=top+tableHeadH+rows.length*rowH;
 ctx.fillStyle='#071629';ctx.fillRect(0,footerY,width,footerH);
 ctx.fillStyle='#f0b94d';ctx.font='800 31px Cairo, sans-serif';ctx.textAlign='center';
 ctx.fillText('إعداد: كابتن رجب الوجيه',width/2,footerY+58);
 ctx.fillStyle='#d7e2ef';ctx.font='500 22px Cairo, sans-serif';
 ctx.fillText('دوري القسم الرابع • منطقة المنيا وبني سويف • موسم '+(data.competition.season||'2026 / 2027'),width/2,footerY+105);
 const btn=$('downloadStandingsImage');
 btn.disabled=true;btn.dataset.originalText=btn.textContent;btn.textContent='جاري تجهيز الصورة...';
 canvas.toBlob(blob=>{
  btn.disabled=false;btn.innerHTML='<span aria-hidden="true">▧</span> تحميل جدول الترتيب كصورة';
  if(!blob){toast('تعذر إنشاء الصورة على هذا الجهاز');return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='جدول-الترتيب-الاسبوع-'+(wk||'الحالي')+'.png';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  toast('تم تنزيل صورة جدول الترتيب بنجاح');
 },'image/png');
}

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
 renderNews();
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
 $('adminNews').innerHTML=(data.news||[]).map(n=>`<div class="admin-item"><span>${escapeHtml(n.text)}</span><button class="mini-btn delete" data-delete-news="${escapeHtml(n.id)}">حذف</button></div>`).join('')||'<div class="empty-state">لا توجد أخبار منشورة.</div>';
 $('adminTeams').innerHTML=data.teams.map(t=>`<div class="admin-item"><span>${escapeHtml(t.name)}</span><div class="mini-actions"><button class="mini-btn" data-rename-team="${escapeHtml(t.id)}">تعديل الاسم</button><button class="mini-btn delete" data-delete-team="${escapeHtml(t.id)}">حذف</button></div></div>`).join('');
 $('settingTitle').value=data.competition.title;$('settingSubtitle').value=data.competition.subtitle;$('settingSeason').value=data.competition.season;$('settingCoach').value=data.competition.coachName;$('settingPhone').value=data.competition.phone;$('settingWeek').value=data.competition.currentWeek;
}
function renderNews(){
 const track=$('newsTrack'); if(!track)return;
 const items=data.news||[];
 if(!items.length){track.innerHTML='<span class="news-empty">تابعوا آخر أخبار ونتائج البطولة</span>';return;}
 const one=items.map(n=>`<button class="news-item" type="button" data-news-id="${escapeHtml(n.id)}">${escapeHtml(n.text)}</button><span class="news-separator">✦</span>`).join('');
 track.innerHTML=one+one;
 track.style.animationDuration=Math.max(18,items.reduce((s,n)=>s+n.text.length,0)*0.22)+'s';
}
function openNews(id){
 const n=(data.news||[]).find(x=>String(x.id)===String(id));if(!n)return;
 $('newsModalTitle').textContent='خبر البطولة';
 $('newsModalBody').textContent=n.text;
 $('newsModalDate').textContent=n.date||'';
 $('newsModal').classList.remove('hidden');
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
$('newsTrack').addEventListener('click',e=>{const item=e.target.closest('[data-news-id]');if(item)openNews(item.dataset.newsId);});
$('newsPause').addEventListener('click',()=>{const track=$('newsTrack');const paused=track.classList.toggle('paused');$('newsPause').textContent=paused?'▶':'Ⅱ';$('newsPause').setAttribute('aria-label',paused?'تشغيل حركة الأخبار':'إيقاف حركة الأخبار');});
$('newsModalClose').addEventListener('click',()=>$('newsModal').classList.add('hidden'));
$('newsModal').addEventListener('click',e=>{if(e.target===$('newsModal'))$('newsModal').classList.add('hidden');});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('newsModal').classList.add('hidden');});
$('newsForm').addEventListener('submit',async e=>{e.preventDefault();const text=$('newsText').value.trim();if(!text)return;const btn=e.submitter;btn.disabled=true;try{await apiPost('addNews',{text});$('newsText').value='';toast('تم نشر الخبر في الشريط');}catch(err){toast('تعذر نشر الخبر: '+err.message);}finally{btn.disabled=false;}});
$('adminNews').addEventListener('click',async e=>{const id=e.target.dataset.deleteNews;if(!id)return;if(!confirm('حذف هذا الخبر من الشريط؟'))return;try{await apiPost('deleteNews',{id});toast('تم حذف الخبر');}catch(err){toast('تعذر حذف الخبر: '+err.message);}});
$('adminReveal').addEventListener('click',()=>{
 $('admin').classList.remove('hidden');
 $('admin').scrollIntoView({behavior:'smooth',block:'start'});
});
$('menuToggle').addEventListener('click',()=>document.querySelector('.site-header nav').classList.toggle('open'));
$('yearNow').textContent=new Date().getFullYear();
$('downloadStandingsImage').addEventListener('click',downloadStandingsAsImage);
loadData().catch(err=>{console.error(err);toast('تعذر الاتصال بقاعدة بيانات الدوري: '+err.message);$('standingsBody').innerHTML='<tr><td colspan="10">تعذر تحميل الجدول. أعد تحميل الصفحة.</td></tr>';});
