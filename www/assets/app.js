// ============================================
// Scan2Excel v2 — app.js
// ============================================
let modules=[], scanModId=null, files=[], editingMod=null, editingUser=null, currentRecords=[], selected=new Set();

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function uid(){return Math.random().toString(36).slice(2,9)}
function toast(m,type){const t=$('#toast');t.textContent=m;t.className='toast show '+(type||'ok');setTimeout(()=>t.className='toast',2600)}
async function api(url,opts){const r=await fetch(url,opts);if(r.status===401){window.setToken&&window.setToken('');location.href=(window.loginPage?window.loginPage():'login.php');return}return r.json()}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function fileType(name){const e=name.split('.').pop().toLowerCase();
  if(['jpg','jpeg','png','webp','gif','bmp','heic'].includes(e))return 'image';
  if(e==='pdf')return 'pdf'; if(['xlsx','xls','csv','tsv'].includes(e))return 'sheet'; return 'image';}
function fmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB'}

// ---- Navigation ----
function closeAllModals(){
  $$('.modal').forEach(m=>m.hidden=true);
  const em=$('#exportMenu');if(em)em.hidden=true;
  document.body.classList.remove('modal-open');
}
$$('.navbtn').forEach(b=>b.onclick=()=>{
  closeAllModals();
  $$('.navbtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#v-'+b.dataset.view).classList.add('active');
  if(b.dataset.view==='data')loadData();
  if(b.dataset.view==='modules')renderModules();
  if(b.dataset.view==='admin')loadUsers();
});
$('#logout').onclick=async()=>{await fetch('auth.php?action=logout');window.setToken&&window.setToken('');location.href=(window.loginPage?window.loginPage():'login.php')};

// ============================================
// MODULES
// ============================================
async function loadModules(){
  const d=await api('api/modules.php?action=list');
  modules=d.modules||[];
  if(!scanModId&&modules.length)scanModId=modules[0].id;
  renderScanMods();renderModules();buildFilters();
}
function renderScanMods(){
  const l=$('#scanModList');
  if(!modules.length){l.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="et">No modules yet</div><div class="hint">Create a module first in the Modules tab.</div></div>';return}
  l.innerHTML='';
  modules.forEach(m=>{
    const d=document.createElement('div');d.className='modcard'+(m.id==scanModId?' sel':'');
    d.innerHTML=`<span class="tag">${esc(m.icon||'DOC')}</span><div class="mt">${esc(m.name)}</div>
      <div class="md">${m.header.length} fields${m.line.length?' · '+m.line.length+' item cols':''}</div>`;
    d.onclick=()=>{scanModId=m.id;renderScanMods()};l.appendChild(d);
  });
}
function renderModules(){
  const l=$('#modlist');
  if(!modules.length){l.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="eic">◇</div><div class="et">No modules yet</div><div class="hint">Click “New module” to define your first extraction template.</div></div>';return}
  l.innerHTML='';
  modules.forEach(m=>{
    const d=document.createElement('div');d.className='modcard';
    d.innerHTML=`<button class="rm" title="Delete">&times;</button><span class="tag">${esc(m.icon||'DOC')}</span>
      <div class="mt">${esc(m.name)}</div><div class="md">${m.header.length} fields${m.line.length?' · '+m.line.length+' item cols':''}</div>`;
    d.querySelector('.rm').onclick=async e=>{e.stopPropagation();
      if(!confirm(`Delete module “${m.name}”? Existing scans stay, but you can't add new ones to it.`))return;
      const r=await api('api/modules.php?action=delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:m.id})});
      if(r.ok){loadModules();toast('Module deleted')}else toast(r.error||'Failed','err')};
    d.onclick=()=>openModModal(m);l.appendChild(d);
  });
}
function frow(val,ph){const w=document.createElement('div');w.className='frow';
  w.innerHTML=`<input value="${esc(val)}" placeholder="${ph}"><button class="del">&times;</button>`;
  w.querySelector('.del').onclick=()=>w.remove();return w}
function openModModal(m){
  editingMod=m?m.id:null;
  $('#modTitle').textContent=m?'Edit module':'New module';
  $('#modName').value=m?m.name:'';$('#modIcon').value=m?m.icon:'';
  const hf=$('#headerFields');hf.innerHTML='';(m?m.header:[{key:''}]).forEach(f=>hf.appendChild(frow(f.key,'Field name')));
  const lf=$('#lineFields');lf.innerHTML='';(m?m.line:[]).forEach(f=>lf.appendChild(frow(f.key,'Column name')));
  $('#modModal').hidden=false;document.body.classList.add('modal-open');
}
$('#newModBtn').onclick=()=>openModModal(null);
$('#addHeader').onclick=()=>$('#headerFields').appendChild(frow('','Field name'));
$('#addLine').onclick=()=>$('#lineFields').appendChild(frow('','Column name'));
$('#modClose').onclick=$('#modCancel').onclick=()=>{$('#modModal').hidden=true;document.body.classList.remove('modal-open')};
$('#saveMod').onclick=async()=>{
  const name=$('#modName').value.trim();if(!name)return toast('Enter a module name','err');
  const grab=id=>[...$('#'+id).querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean).map(k=>({key:k}));
  const header=grab('headerFields'),line=grab('lineFields');
  if(!header.length&&!line.length)return toast('Add at least one field','err');
  const r=await api('api/modules.php?action=save',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:editingMod,name,icon:$('#modIcon').value.trim().toUpperCase()||'DOC',header,line})});
  if(r.ok){$('#modModal').hidden=true;document.body.classList.remove('modal-open');loadModules();toast('Module saved')}else toast(r.error||'Failed','err');
};

// ============================================
// SCAN (bulk, multi-type)
// ============================================
const drop=$('#drop'),fileInput=$('#fileInput');
drop.onclick=()=>fileInput.click();
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',ev=>addFiles(ev.dataTransfer.files));
fileInput.onchange=()=>{addFiles(fileInput.files);fileInput.value=''};
function addFiles(list){
  [...list].forEach(f=>files.push({id:uid(),file:f,name:f.name,size:f.size,type:fileType(f.name),status:'wait'}));
  renderFiles();
}
function renderFiles(){
  const l=$('#filelist');l.innerHTML='';
  files.forEach(f=>{
    const d=document.createElement('div');d.className='fileitem';
    const tl={image:'IMG',pdf:'PDF',sheet:'XLS'}[f.type];
    d.innerHTML=`<div class="fic ${f.type}">${tl}</div>
      <div class="fmeta"><div class="fname">${esc(f.name)}</div><div class="fsize">${fmtSize(f.size)}</div></div>
      <span class="fstat ${f.status}">${statusText(f.status)}</span>
      <button class="fx" title="Remove">&times;</button>`;
    d.querySelector('.fx').onclick=()=>{files=files.filter(x=>x.id!==f.id);renderFiles()};
    l.appendChild(d);
  });
  $('#scanActions').hidden=!files.length;
}
function statusText(s){return {wait:'Ready',doing:'Processing…',done:'Done',err:'Failed'}[s]||s}
$('#scanBtn').onclick=async()=>{
  if(!scanModId)return toast('Select a module first','err');
  if(!files.length)return;
  const btn=$('#scanBtn');btn.disabled=true;
  const ov=$('#aiScanOverlay');if(ov){ov.hidden=false;}
  const combine=$('#combineMode')&&$('#combineMode').checked;
  let done=0,fail=0;const pending=files.filter(f=>f.status!=='done');

  if(combine && pending.length>1){
    // ---- Combine mode: all files -> ONE record ----
    pending.forEach(f=>{f.status='doing'});renderFiles();
    $('#scanStatus').textContent=`Combining ${pending.length} files…`;
    if($('#aiScanText'))$('#aiScanText').textContent=`Merging ${pending.length} files into one record…`;
    const fd=new FormData();
    pending.forEach(f=>fd.append('file[]',f.file));
    fd.append('module_id',scanModId);
    try{
      const r=await api('api/scan.php',{method:'POST',body:fd});
      if(r&&r.ok){pending.forEach(f=>f.status='done');done=pending.length}
      else{pending.forEach(f=>f.status='err');fail=pending.length;console.warn(r&&r.error);if(r&&r.error)toast(r.error,'err')}
    }catch(e){pending.forEach(f=>f.status='err');fail=pending.length}
    renderFiles();
  } else {
    // ---- Normal mode: each file -> its own record ----
    for(const f of pending){
      f.status='doing';renderFiles();
      $('#scanStatus').textContent=`Processing ${done+fail+1} of ${pending.length}…`;
      if($('#aiScanText'))$('#aiScanText').textContent=`Reading document ${done+fail+1} of ${pending.length}…`;
      const fd=new FormData();fd.append('file',f.file);fd.append('module_id',scanModId);
      try{
        const r=await api('api/scan.php',{method:'POST',body:fd});
        if(r&&r.ok){f.status='done';done++}else{f.status='err';fail++;console.warn(r&&r.error)}
      }catch(e){f.status='err';fail++}
      renderFiles();
    }
  }
  if(ov)ov.hidden=true;
  btn.disabled=false;
  $('#scanStatus').textContent=`${done} done${fail?', '+fail+' failed':''}`;
  toast(combine&&done?`Combined into 1 record ✓`:`${done} file(s) extracted${fail?', '+fail+' failed':''}`, fail&&!done?'err':'ok');
  if(done){files=files.filter(f=>f.status!=='done');renderFiles();
    setTimeout(()=>{$$('.navbtn').forEach(x=>x.classList.remove('active'));document.querySelector('[data-view="data"]').classList.add('active');
      $$('.view').forEach(v=>v.classList.remove('active'));$('#v-data').classList.add('active');loadData()},600);}
};


// ---- Document viewer popup ----
function openViewer(r){
  const files=r.image_path?r.image_path.split(',').filter(Boolean):[];
  if(!files.length)return;
  let idx=0;
  const ov=$('#viewerOverlay'), body=$('#viewerBody'), cap=$('#viewerCap');
  function show(){
    const src=`api/file.php?scan=${r.id}&i=${idx}`;
    if(r.source_type==='pdf'){
      body.innerHTML=`<iframe src="${src}" style="width:100%;height:100%;border:0;border-radius:10px;background:#fff"></iframe>`;
    }else{
      body.innerHTML=`<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:10px">`;
    }
    cap.textContent=`${esc(r.module_name)} · ${idx+1} of ${files.length}`;
    $('#viewerPrev').style.visibility=files.length>1?'visible':'hidden';
    $('#viewerNext').style.visibility=files.length>1?'visible':'hidden';
  }
  $('#viewerPrev').onclick=()=>{idx=(idx-1+files.length)%files.length;show()};
  $('#viewerNext').onclick=()=>{idx=(idx+1)%files.length;show()};
  show();
  ov.hidden=false;document.body.classList.add('modal-open');
}
function closeViewer(){const ov=$('#viewerOverlay');if(ov){ov.hidden=true;$('#viewerBody').innerHTML='';document.body.classList.remove('modal-open')}}

// ============================================
// DATA + filters
// ============================================
function buildFilters(){
  const s=$('#fModule');if(s){s.innerHTML='<option value="">All modules</option>';
    modules.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.name;s.appendChild(o)})}
}
$('#applyFilters')&&($('#applyFilters').onclick=loadData);
$('#clearFilters')&&($('#clearFilters').onclick=()=>{['fModule','fType','fFrom','fTo','fQ'].forEach(id=>{const e=$('#'+id);if(e)e.value=''});if($('#fUser'))$('#fUser').value='';loadData()});
function filterQS(){
  const p=new URLSearchParams();
  const add=(id,key)=>{const e=$('#'+id);if(e&&e.value)p.set(key,e.value)};
  add('fModule','module_id');add('fType','type');add('fFrom','from');add('fTo','to');add('fQ','q');
  if($('#fUser'))add('fUser','user_id');
  return p.toString();
}
async function loadData(){
  const area=$('#dataArea');area.innerHTML='<div class="loading">Loading…</div>';
  selected.clear();
  const d=await api('api/records.php?action=list&'+filterQS());
  currentRecords=d.records||[];
  $('#dataCount').textContent=currentRecords.length+' record'+(currentRecords.length!==1?'s':'');
  $('#dataToolbar').hidden=!currentRecords.length;
  updateDelBtn();
  if(!currentRecords.length){area.innerHTML='<div class="empty"><div class="eic">▤</div><div class="et">No records found</div><div class="hint">Try adjusting the filters, or scan some documents.</div></div>';return}
  area.innerHTML='';
  currentRecords.forEach((r,ri)=>area.appendChild(recCard(r,ri)));
}
function recCard(r,ri){
  const c=document.createElement('div');c.className='rec';
  const typeLabel={image:'Image',pdf:'PDF',sheet:'Sheet'}[r.source_type]||'Doc';
  const fileCount=r.image_path?r.image_path.split(',').filter(Boolean).length:0;
  const isViewable=r.source_type==='image'||r.source_type==='pdf';
  let thumb='';
  if(fileCount&&isViewable){
    const thumbSrc=`api/file.php?scan=${r.id}&i=0`;
    thumb=`<button class="rec-thumb" data-view="${r.id}" data-count="${fileCount}" title="Click to view">`;
    if(r.source_type==='image'){thumb+=`<img src="${thumbSrc}" loading="lazy" alt="scan">`;}
    else{thumb+=`<span class="thumb-pdf">PDF</span>`;}
    if(fileCount>1)thumb+=`<span class="thumb-badge">${fileCount}</span>`;
    thumb+=`</button>`;
  }
  let h=`<div class="rec-head">
      <input type="checkbox" class="selbox" data-sel="${r.id}">
      ${thumb}
      <div class="rec-headmeta">
        <div class="rec-headtop"><span class="rtag">${esc(r.icon||'DOC')}</span><span class="rtitle">${esc(r.module_name)}</span></div>
        <span class="rmeta">${typeLabel} · ${r.created_at.slice(0,10)}${IS_ADMIN?' · '+esc(r.user_name):''}${r.original_name?' · '+esc(r.original_name):''}</span>
      </div>
      <div class="ractions">
        ${fileCount&&isViewable?`<button class="btn btn-ghost btn-sm" data-view="${r.id}">View</button>`:''}
        <button class="btn btn-ghost btn-sm" data-save="${r.id}">Save</button>
        <button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button>
      </div></div>`;
  h+='<div class="grid2">';
  Object.keys(r.header).forEach(k=>{h+=`<div class="fldwrap"><label>${esc(k)}</label><input data-rec="${r.id}" data-hk="${esc(k)}" value="${esc(r.header[k])}"></div>`});
  h+='</div>';
  if(r.items&&r.items.length){
    const cols=Object.keys(r.items[0]);
    h+=`<div class="items-label">Line items (${r.items.length})</div><div class="items"><table class="items-tbl"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th></th></tr></thead><tbody>`;
    r.items.forEach((it,ii)=>{h+='<tr>'+cols.map(c=>`<td><input data-rec="${r.id}" data-ii="${ii}" data-ik="${esc(c)}" value="${esc(it[c])}"></td>`).join('')+`<td><button class="dx" data-delitem="${r.id}|${ii}">&times;</button></td></tr>`});
    h+='</tbody></table></div>';
  }
  c.innerHTML=h;
  // wire
  c.querySelector('[data-sel]').onchange=e=>{e.target.checked?selected.add(r.id):selected.delete(r.id);updateDelBtn()};
  c.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openViewer(r));
  c.querySelectorAll('input[data-hk]').forEach(i=>i.oninput=()=>{r.header[i.dataset.hk]=i.value});
  c.querySelectorAll('input[data-ik]').forEach(i=>i.oninput=()=>{r.items[+i.dataset.ii][i.dataset.ik]=i.value});
  c.querySelector('[data-save]').onclick=async()=>{
    const res=await api('api/records.php?action=update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scan_id:r.id,header:r.header,items:r.items})});
    if(res.ok)toast('Changes saved');else toast(res.error||'Failed','err')};
  c.querySelector('[data-del]').onclick=async()=>{
    if(!confirm('Delete this record?'))return;
    const res=await api('api/records.php?action=delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scan_id:r.id})});
    if(res.ok){loadData();toast('Record deleted')}};
  c.querySelectorAll('[data-delitem]').forEach(b=>b.onclick=()=>{
    const[rid,ii]=b.dataset.delitem.split('|');r.items.splice(+ii,1);
    const idx=currentRecords.findIndex(x=>x.id==rid);const card=recCard(currentRecords[idx],idx);
    b.closest('.rec').replaceWith(card);toast('Item removed — click Save to keep')});
  return c;
}
function updateDelBtn(){const b=$('#delSelected');if(b){b.hidden=!selected.size;b.textContent=`Delete selected (${selected.size})`}}
$('#selAll')&&($('#selAll').onchange=e=>{
  $$('.selbox').forEach(cb=>{cb.checked=e.target.checked;const id=+cb.dataset.sel;e.target.checked?selected.add(id):selected.delete(id)});updateDelBtn()});
$('#delSelected')&&($('#delSelected').onclick=async()=>{
  if(!selected.size)return;if(!confirm(`Delete ${selected.size} selected record(s)?`))return;
  const res=await api('api/records.php?action=delete_many',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scan_ids:[...selected]})});
  if(res.ok){toast(`${res.deleted} deleted`);loadData()}});

// ---- Export menu ----
$('#exportBtn')&&($('#exportBtn').onclick=e=>{e.stopPropagation();$('#exportMenu').hidden=!$('#exportMenu').hidden});
document.addEventListener('click',e=>{
  // only close export menu; never let this interfere with modals
  const m=$('#exportMenu');
  if(m&&!m.hidden&&!e.target.closest('.export-wrap'))m.hidden=true;
});
// Backdrop click + ESC close for all modals
$$('.modal').forEach(mod=>{
  mod.addEventListener('mousedown',e=>{if(e.target===mod){mod.hidden=true;document.body.classList.remove('modal-open')}});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAllModals()});
$('#exportMenu')&&$$('#exportMenu button').forEach(b=>b.onclick=()=>{
  const qs=filterQS();const url='api/export.php?format='+b.dataset.fmt+(qs?'&'+qs:'');
  if(b.dataset.fmt==='pdf')window.open(url,'_blank');else window.location=url;
  toast('Preparing '+b.dataset.fmt.toUpperCase()+'…');
});

// ============================================
// ADMIN — users
// ============================================
async function loadUsers(){
  if(!IS_ADMIN)return;
  const tb=$('#usersTable tbody');tb.innerHTML='<tr><td colspan="7" class="loading">Loading…</td></tr>';
  const d=await api('auth.php?action=users_list');const users=d.users||[];
  const acc=await api('auth.php?action=access_list');const amap=(acc&&acc.access)||{};
  tb.innerHTML='';
  users.forEach(u=>{
    const hasCN = u.role==='admin' || ((amap[u.id]||[]).includes('credit_note'));
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.team)}</td>
      <td><span class="badge ${u.role}">${u.role==='admin'?'Admin':'User'}</span></td>
      <td>${u.role==='admin'?'<span class="hint">always</span>':`<label class="switch"><input type="checkbox" data-cn="${u.id}" ${hasCN?'checked':''}><span></span></label>`}</td>
      <td>${u.created_at.slice(0,10)}</td>
      <td><div class="acts"><button class="iconbtn" data-edit="${u.id}" title="Edit">✎</button>
      <button class="iconbtn del" data-del="${u.id}" title="Delete">🗑</button></div></td>`;
    tr.querySelector('[data-edit]').onclick=()=>openUserModal(u);
    const cn=tr.querySelector('[data-cn]');
    if(cn)cn.onchange=async()=>{
      const r=await api('auth.php?action=access_set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:u.id,module_key:'credit_note',on:cn.checked})});
      if(r&&r.ok)toast(cn.checked?'Credit Note access granted':'Access removed');else toast('Failed','err')};
    tr.querySelector('[data-del]').onclick=async()=>{
      if(!confirm(`Delete user “${u.name}”? Their scans and modules will be removed.`))return;
      const r=await api('auth.php?action=user_delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:u.id})});
      if(r.ok){loadUsers();toast('User deleted')}else toast(r.error||'Failed','err')};
    tb.appendChild(tr);
  });
}
function openUserModal(u){
  editingUser=u?u.id:null;
  $('#userTitle').textContent=u?'Edit user':'New user';
  $('#uName').value=u?u.name:'';$('#uEmail').value=u?u.email:'';$('#uTeam').value=u?u.team:'';
  $('#uRole').value=u?u.role:'user';$('#uPass').value='';
  $('#uEmail').disabled=!!u;
  $('#pwHint').textContent=u?'Leave blank to keep current password':'Set a password (min 4 chars)';
  $('#userModal').hidden=false;document.body.classList.add('modal-open');
}
if(IS_ADMIN){
  $('#newUserBtn').onclick=()=>openUserModal(null);
  $('#userClose').onclick=$('#userCancel').onclick=()=>{$('#userModal').hidden=true;document.body.classList.remove('modal-open')};
  $('#saveUser').onclick=async()=>{
    const name=$('#uName').value.trim(),email=$('#uEmail').value.trim(),team=$('#uTeam').value.trim()||'General',
      role=$('#uRole').value,password=$('#uPass').value;
    if(!name)return toast('Enter a name','err');
    if(!editingUser&&(!email||password.length<4))return toast('Email and password (min 4) required','err');
    const action=editingUser?'user_update':'user_create';
    const body=editingUser?{id:editingUser,name,team,role,password}:{name,email,team,role,password};
    const r=await api('auth.php?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.ok){$('#userModal').hidden=true;loadUsers();toast('User saved')}else toast(r.error||'Failed','err')};
}

// init
loadModules();
