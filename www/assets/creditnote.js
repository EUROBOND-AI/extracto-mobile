// ============================================
// Extracto — Credit Note (SAP) module  v3.4
// Bulk: many parties at once, grouped by AI, one uploader per batch.
// ============================================
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function uid(){return Math.random().toString(36).slice(2,9)}
async function api(url,opts){const r=await fetch(url,opts);if(r.status===401){window.setToken&&window.setToken('');location.href=(window.loginPage?window.loginPage():'login.php');return}return r.json()}
function toast(m,t){const el=document.getElementById('toast');if(!el)return;el.textContent=m;el.className='toast show '+(t||'ok');setTimeout(()=>el.className='toast',2800)}

let cnFiles=[], lastBatch=null;
// URL helper: full server URL + token in the app, relative on web
function S(p){ return window.srcUrl ? window.srcUrl(p) : p; }
function go(p){ window.location = S(p); }

// ---- show Credit Note nav if user has access ----
(async()=>{const d=await api('auth.php?action=my_access');const mods=(d&&d.modules)||[];
  if(mods.includes('credit_note')){const b=$('#nav-creditnote');if(b)b.hidden=false;}})();

// ---- sub-tab switching ----
$$('.cn-tab').forEach(t=>t.onclick=()=>{
  $$('.cn-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  $$('.cn-panel').forEach(p=>p.hidden=true);
  $('#cn-'+t.dataset.cn).hidden=false;
  if(t.dataset.cn==='list')cnLoadList();
  if(t.dataset.cn==='masters')loadMaster('gl');
});

// ---- file upload ----
const drop=$('#cnDrop'), fin=$('#cnFileInput');
if(drop){
  drop.onclick=()=>fin.click();
  ['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',ev=>addFiles(ev.dataTransfer.files));
  fin.onchange=()=>{addFiles(fin.files);fin.value=''};
}
function addFiles(list){[...list].forEach(f=>cnFiles.push({id:uid(),file:f,name:f.name,size:f.size}));renderCnFiles()}
function renderCnFiles(){
  const l=$('#cnFilelist');l.innerHTML='';
  cnFiles.forEach((f,i)=>{
    const d=document.createElement('div');d.className='fileitem';
    d.innerHTML=`<div class="fic image">${i+1}</div><div class="fmeta"><div class="fname">${esc(f.name)}</div><div class="fsize">${(f.size/1024).toFixed(0)} KB</div></div><button class="fx">&times;</button>`;
    d.querySelector('.fx').onclick=()=>{cnFiles=cnFiles.filter(x=>x.id!==f.id);renderCnFiles()};
    l.appendChild(d);
  });
  $('#cnActions').hidden=!cnFiles.length;
}

// ---- scan (bulk) ----
$('#cnScanBtn')&&($('#cnScanBtn').onclick=async()=>{
  if(!cnFiles.length)return;
  const btn=$('#cnScanBtn');btn.disabled=true;$('#cnStatus').textContent='Reading…';
  const ov=document.getElementById('aiScanOverlay');
  const msgs=['Reading '+cnFiles.length+' documents at once','What your team does in hours, done in seconds','Every customer matched automatically','The right invoice picked for you','All SAP fields built — zero typing','No manual work. No mistakes. No stress.','Sit back — the AI is handling everything','You focus on approvals. The AI does the rest.','Relax — the AI has this','Precision at machine speed','Turning paperwork into SAP-ready data','Almost done — reviewing every detail','Grouping every party on its own','Card codes captured straight from the page','Amounts and taxes worked out for you','Series and branch filled in automatically','12 hours of work, finished in a moment','Your accounts team just got superpowers','Reading handwriting, stamps and tables alike','Every rupee accounted for','Built for your team, by your team','This is what effortless looks like','Checked twice — ready for SAP','One scan. Everything done.'];
  let mi=0,msgTimer=null,tmrTimer=null;
  // live timer MM:SS:MS — shows how long the AI is taking
  const tEl=document.getElementById('aiScanTimer');const t0=Date.now();
  if(tEl){tEl.textContent='00:00:00';tmrTimer=setInterval(()=>{
    const d=Date.now()-t0,mm=String(Math.floor(d/60000)).padStart(2,'0'),
      ss=String(Math.floor(d/1000)%60).padStart(2,'0'),ms=String(Math.floor(d/10)%100).padStart(2,'0');
    tEl.textContent=mm+':'+ss+':'+ms;},33);}
  if(ov){ov.hidden=false;const te=document.getElementById('aiScanText');if(te){te.textContent=msgs[0];msgTimer=setInterval(()=>{mi=(mi+1)%msgs.length;te.textContent=msgs[mi]},1800);}}
  const stop=()=>{if(ov)ov.hidden=true;if(msgTimer)clearInterval(msgTimer);if(tmrTimer)clearInterval(tmrTimer);};
  const docType=document.querySelector('input[name=cnDoc]:checked').value;
  try{
    // Upload ALL files in one go (groups only if too many for PHP's upload limit),
    // then read them. Everything is collected into ONE review list.
    const GROUP=15, groups=[]; for(let i=0;i<cnFiles.length;i+=GROUP) groups.push(cnFiles.slice(i,i+GROUP));
    let batch=0, up=null;
    for(let gi=0; gi<groups.length; gi++){
      if(groups.length>1)$('#cnStatus').textContent='Uploading '+Math.min((gi+1)*GROUP,cnFiles.length)+' / '+cnFiles.length+'…';
      const fd=new FormData();
      groups[gi].forEach(f=>fd.append('file[]',f.file));
      fd.append('doc_type',docType);
      if(batch)fd.append('batch_no',batch);
      if(gi===groups.length-1)fd.append('final','1');
      up=await api('api/creditnote.php?action=scan',{method:'POST',body:fd});
      if(!up||!up.ok){stop();$('#cnStatus').textContent='';toast((up&&up.error)||'Upload failed','err');btn.disabled=false;return;}
      batch=up.batch_no;
    }
    const chunks=up.chunks;
    lastBatch=batch;
    // Read each chunk one after another, collect ALL into one list (no per-batch noise)
    let allNotes=[], anyRecovered=false, finalNotes=null;
    for(let ci=0; ci<chunks; ci++){
      let done=false, attempts=0;
      while(!done && attempts<2){
        attempts++;
        const cr=await api('api/creditnote.php?action=scan_chunk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batch_no:batch,chunk:ci})});
        if(cr&&cr.ok){ allNotes=allNotes.concat(cr.notes||[]); if(cr.recovered)anyRecovered=true;
          if(cr.final_notes)finalNotes=cr.final_notes; done=true; }
        else { if(attempts<2){ await new Promise(r=>setTimeout(r,4000)); }
          else { toast('Could not read part of the batch — the rest is saved','err'); done=true; } }
      }
    }
    stop();
    // use the server's merged/clean list (duplicates collapsed) when available
    const notesToShow = finalNotes || allNotes;
    renderReview(notesToShow,batch);
    cnFiles=[];renderCnFiles();
    $('#cnStatus').textContent=notesToShow.length+' credit note(s) found';
    if(anyRecovered)toast(notesToShow.length+' read ✓ — some long documents, please review','err');
    else toast(notesToShow.length+' credit note(s) read ✓');
  }catch(e){stop();$('#cnStatus').textContent='';toast('Error','err')}
  btn.disabled=false;
});

// ---- review: list of all notes from this batch ----
function renderReview(notes,batch){
  const area=$('#cnReview');
  let h=`<div class="panel"><div class="flex between"><div class="panel-label">3 &middot; Review ${notes.length} credit note(s) <span class="hint">Edit anything, Save each, then download the batch</span></div>
    <div class="flex" style="gap:8px"><button class="btn btn-ghost btn-sm" id="batchHeader">Download Header (all)</button>
    <button class="btn btn-ghost btn-sm" id="batchRow">Download Row (all)</button>
    <button class="btn btn-a btn-sm" id="batchSap">Post all to SAP</button></div></div></div>`;
  area.innerHTML=h;
  notes.forEach(n=>area.appendChild(reviewCard(n)));
  $('#batchHeader').onclick=()=>go('api/cn_uploader.php?which=header&batch='+batch);
  $('#batchRow').onclick=()=>go('api/cn_uploader.php?which=row&batch='+batch);
  $('#batchSap').onclick=async()=>{
    if(!confirm('Post all '+notes.length+' credit note(s) in this batch to SAP?'))return;
    const b=$('#batchSap');b.disabled=true;b.textContent='Posting…';
    const res=await api('api/creditnote.php?action=sap_post_bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batch})});
    b.disabled=false;b.textContent='Post all to SAP';
    if(res&&res.ok)toast(res.posted+' posted to SAP ✓'+(res.failed?(' · '+res.failed+' failed'):''));
    else if(res&&res.not_configured)toast('SAP not set up — download the uploaders instead','err');
    else toast((res&&res.error)||'SAP post failed','err');
  };
}
function reviewCard(r){
  const c=document.createElement('div');c.className='panel cn-review';
  const fc=r.image_path?r.image_path.split(',').filter(Boolean).length:0;
  c.innerHTML=`
    <div class="flex between" style="margin-bottom:12px">
      <div class="flex" style="gap:10px;align-items:center">
        ${fc?`<button class="rec-thumb" data-view="${r.id}"><img src="${S(`api/file.php?cn=${r.id}&i=0`)}" loading="lazy">${fc>1?'<span class="thumb-badge">'+fc+'</span>':''}</button>`:''}
        <div><div class="rtitle">${esc(r.party_name||'(no party)')}</div>
        <span class="rmeta">₹${esc(r.cn_amount)} · ${r.is_gst?'GST':'Non-GST'} · ${esc(r.account_code||'no acct')}</span></div>
      </div>
    </div>
    <div class="cn-grid">
      <div class="fldwrap"><label>Party name</label><input id="p_${r.id}" value="${esc(r.party_name)}"></div>
      <div class="fldwrap"><label>Card code</label><input id="c_${r.id}" value="${esc(r.card_code)}"></div>
      <div class="fldwrap"><label>Amount</label><input id="a_${r.id}" value="${esc(r.cn_amount)}"></div>
      <div class="fldwrap"><label>GST?</label><select id="g_${r.id}"><option value="0"${!r.is_gst?' selected':''}>Non-GST</option><option value="1"${r.is_gst?' selected':''}>GST</option></select></div>
      <div class="fldwrap"><label>Remark</label><input id="rm_${r.id}" value="${esc(r.remark_text||r.remark_key)}"></div>
      <div class="fldwrap"><label>Account code</label><input id="ac_${r.id}" value="${esc(r.account_code)}" readonly></div>
      <div class="fldwrap"><label>Invoice no</label><input id="rn_${r.id}" value="${esc(r.rev_ref_no)}"></div>
      <div class="fldwrap"><label>Invoice date</label><input id="rd_${r.id}" value="${esc(r.rev_ref_date)}" placeholder="yyyymmdd"></div>
      <div class="fldwrap"><label>Location</label><input id="lo_${r.id}" value="${esc(r.location_code)}"></div>
      <div class="fldwrap"><label>BPL id</label><input id="bp_${r.id}" value="${esc(r.bpl_id)}" readonly></div>
      <div class="fldwrap"><label>Series</label><input id="se_${r.id}" value="${esc(r.series)}" readonly></div>
      <div class="fldwrap"><label>Price</label><input id="pr_${r.id}" value="${esc(r.price)}" readonly></div>
    </div>
    <div class="cn-derived"><span class="chip2">GSTTranTyp: <b id="gt_${r.id}">${esc(r.gst_tran_typ)}</b></span>
      <span class="chip2">TaxCode: <b id="tc_${r.id}">${esc(r.tax_code)}</b></span>
      <span class="chip2">TaxType: <b id="tt_${r.id}">${esc(r.tax_type)}</b></span></div>
    <div class="fldwrap" style="margin-top:12px"><label>Comments</label><input id="cm_${r.id}" value="${esc(r.comments)}"></div>
    <div class="flex" style="margin-top:14px;gap:10px"><button class="btn btn-primary btn-sm" id="sv_${r.id}">Save &amp; recompute</button></div>`;
  // view
  const vb=c.querySelector('[data-view]');if(vb)vb.onclick=()=>openViewerCN(r);
  // customer autocomplete
  attachCustomerSearch(c.querySelector('#p_'+r.id), c.querySelector('#c_'+r.id));
  // LIVE: changing GST? instantly recomputes the GST-driven fields (no Save needed)
  function liveGst(){
    const gst=parseInt(c.querySelector('#g_'+r.id).value)===1;
    const amt=parseFloat((c.querySelector('#a_'+r.id).value||'').replace(/[^0-9.]/g,''))||0;
    c.querySelector('#gt_'+r.id).textContent=gst?'GA':'--';
    c.querySelector('#tc_'+r.id).textContent=gst?'IGST@18':'NIL';
    c.querySelector('#tt_'+r.id).textContent=gst?'Y':'N';
    c.querySelector('#pr_'+r.id).value=gst?(Math.round(amt/118*100*100)/100):amt;
  }
  c.querySelector('#g_'+r.id).onchange=liveGst;
  c.querySelector('#a_'+r.id).addEventListener('input',liveGst);
  // save
  c.querySelector('#sv_'+r.id).onclick=async()=>{
    const body={id:r.id,doc_type:r.doc_type,is_gst:parseInt(c.querySelector('#g_'+r.id).value),
      party_name:c.querySelector('#p_'+r.id).value,card_code:c.querySelector('#c_'+r.id).value,
      cn_amount:c.querySelector('#a_'+r.id).value,remark_key:c.querySelector('#rm_'+r.id).value,
      rev_ref_no:c.querySelector('#rn_'+r.id).value,rev_ref_date:c.querySelector('#rd_'+r.id).value,
      location_code:c.querySelector('#lo_'+r.id).value,comments:c.querySelector('#cm_'+r.id).value};
    const res=await api('api/creditnote.php?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(res&&res.ok){
      c.querySelector('#ac_'+r.id).value=res.account_code||'';c.querySelector('#bp_'+r.id).value=res.bpl_id||'';
      c.querySelector('#se_'+r.id).value=res.series||'';c.querySelector('#pr_'+r.id).value=res.price||'';
      c.querySelector('#c_'+r.id).value=res.card_code||c.querySelector('#c_'+r.id).value;
      c.querySelector('#rd_'+r.id).value=res.rev_ref_date||c.querySelector('#rd_'+r.id).value;
      c.querySelector('#gt_'+r.id).textContent=res.gst_tran_typ;c.querySelector('#tc_'+r.id).textContent=res.tax_code;c.querySelector('#tt_'+r.id).textContent=res.tax_type;
      toast('Saved ✓');
    }else toast((res&&res.error)||'Failed','err');
  };
  return c;
}

// ---- document viewer ----
function openViewerCN(r){
  const files=r.image_path?r.image_path.split(',').filter(Boolean):[];if(!files.length)return;
  let idx=0;const ov=$('#viewerOverlay'),body=$('#viewerBody'),cap=$('#viewerCap');
  function show(){const src=S(`api/file.php?cn=${r.id}&i=${idx}`);
    body.innerHTML=`<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:10px">`;
    cap.textContent=`${esc(r.party_name||'Document')} · ${idx+1} of ${files.length}`;
    $('#viewerPrev').style.visibility=files.length>1?'visible':'hidden';$('#viewerNext').style.visibility=files.length>1?'visible':'hidden';}
  $('#viewerPrev').onclick=()=>{idx=(idx-1+files.length)%files.length;show()};
  $('#viewerNext').onclick=()=>{idx=(idx+1)%files.length;show()};
  show();ov.hidden=false;document.body.classList.add('modal-open');
}

// ---- customer autocomplete ----
function attachCustomerSearch(partyInp, cardInp){
  if(!partyInp)return;let box;
  partyInp.addEventListener('input',async()=>{
    const q=partyInp.value.trim();if(q.length<2){if(box)box.remove();return}
    const d=await api('api/creditnote.php?action=masters&m=customer&q='+encodeURIComponent(q));
    if(box)box.remove();if(!d||!d.rows||!d.rows.length)return;
    box=document.createElement('div');box.className='ac-box';
    d.rows.forEach(row=>{const it=document.createElement('div');it.className='ac-it';
      it.innerHTML=`<b>${esc(row.bp_code)}</b> — ${esc(row.bp_name)}`;
      it.onclick=()=>{partyInp.value=row.bp_name;if(cardInp)cardInp.value=row.bp_code;box.remove()};box.appendChild(it)});
    partyInp.parentNode.style.position='relative';partyInp.parentNode.appendChild(box);
  });
  document.addEventListener('click',e=>{if(box&&!partyInp.parentNode.contains(e.target))box.remove()});
}

// ---- history list ----
async function cnLoadList(){
  const area=$('#cnListArea');area.innerHTML='<div class="loading">Loading…</div>';
  const d=await api('api/creditnote.php?action=list');const recs=(d&&d.records)||[];
  $('#cnCount').textContent=recs.length+' credit note'+(recs.length!==1?'s':'');
  if(!recs.length){area.innerHTML='<div class="empty"><div class="eic">₹</div><div class="et">No credit notes yet</div><div class="hint">Scan some in the New tab.</div></div>';return}
  area.innerHTML='';
  recs.forEach(r=>{
    const c=document.createElement('div');c.className='rec';const posted=r.posted_to_sap==1;
    const fc=r.image_path?r.image_path.split(',').filter(Boolean).length:0;
    c.innerHTML=`<div class="rec-head">
      <label class="rec-pick"><input type="checkbox" class="cnpick" data-pick="${r.id}"></label>
      ${fc?`<button class="rec-thumb" data-view="${r.id}"><img src="${S(`api/file.php?cn=${r.id}&i=0`)}" loading="lazy">${fc>1?'<span class="thumb-badge">'+fc+'</span>':''}</button>`:''}
      <div class="rec-headmeta"><div class="rec-headtop"><span class="rtag">${r.doc_type}</span><span class="rtitle">${esc(r.party_name||r.card_code)}</span>
      <span class="badge ${r.is_gst==1?'admin':'user'}">${r.is_gst==1?'GST':'Non-GST'}</span>
      ${posted?'<span class="badge admin">SAP '+esc(r.sap_docnum)+'</span>':''}</div>
      <span class="rmeta">${esc(r.card_code)} · ₹${esc(r.cn_amount)} · ${esc(r.account_code)} · ${r.created_at.slice(0,10)}${IS_ADMIN?' · '+esc(r.user_name):''}</span></div>
      <div class="ractions">
        <button class="btn btn-ghost btn-sm" data-dlh="${r.id}">Header</button>
        <button class="btn btn-ghost btn-sm" data-dlr="${r.id}">Row</button>
        ${posted?'':'<button class="btn btn-a btn-sm" data-sap="'+r.id+'">SAP</button>'}
        <button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button>
      </div></div>`;
    const vb=c.querySelector('[data-view]');if(vb)vb.onclick=()=>openViewerCN(r);
    c.querySelector('[data-dlh]').onclick=()=>go('api/cn_uploader.php?which=header&ids='+r.id);
    c.querySelector('[data-dlr]').onclick=()=>go('api/cn_uploader.php?which=row&ids='+r.id);
    const sb=c.querySelector('[data-sap]');if(sb)sb.onclick=()=>postSap(r.id);
    c.querySelector('[data-del]').onclick=async()=>{if(!confirm('Delete this credit note?'))return;
      const res=await api('api/creditnote.php?action=delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id})});
      if(res&&res.ok){cnLoadList();toast('Deleted · '+(res.files_deleted||0)+' photo(s) removed')}};
    area.appendChild(c);
  });
  setupBulk();
}

// ---- bulk actions in History ----
function pickedIds(){return $$('.cnpick:checked').map(b=>b.dataset.pick)}
function updateSel(){
  const n=pickedIds().length;const cnt=$('#cnSelCount');if(cnt)cnt.textContent=n+' selected';
  const sa=$('#cnSelAll');if(sa){const all=$$('.cnpick');sa.checked=all.length>0&&n===all.length;}
}
function setupBulk(){
  const bar=$('#cnBulkBar');if(!bar)return;
  bar.hidden=!$$('.cnpick').length;
  $$('.cnpick').forEach(b=>b.onchange=updateSel);
  const sa=$('#cnSelAll');if(sa)sa.onchange=()=>{$$('.cnpick').forEach(b=>b.checked=sa.checked);updateSel()};
  updateSel();
}
$('#cnBulkHeader')&&($('#cnBulkHeader').onclick=()=>{const ids=pickedIds();if(!ids.length){toast('Select some first','err');return}go('api/cn_uploader.php?which=header&ids='+ids.join(','))});
$('#cnBulkRow')&&($('#cnBulkRow').onclick=()=>{const ids=pickedIds();if(!ids.length){toast('Select some first','err');return}go('api/cn_uploader.php?which=row&ids='+ids.join(','))});
$('#cnBulkDel')&&($('#cnBulkDel').onclick=async()=>{const ids=pickedIds();if(!ids.length){toast('Select some first','err');return}
  if(!confirm('Delete '+ids.length+' credit note(s)? Photos also removed.'))return;
  const res=await api('api/creditnote.php?action=delete_bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
  if(res&&res.ok){cnLoadList();toast(res.deleted+' deleted')}else toast('Failed','err')});
$('#cnBulkSap')&&($('#cnBulkSap').onclick=async()=>{const ids=pickedIds();if(!ids.length){toast('Select some first','err');return}
  if(!confirm('Post '+ids.length+' credit note(s) to SAP now?'))return;
  $('#cnBulkSap').disabled=true;$('#cnBulkSap').textContent='Posting…';
  const res=await api('api/creditnote.php?action=sap_post_bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
  $('#cnBulkSap').disabled=false;$('#cnBulkSap').textContent='Post to SAP (selected)';
  if(res&&res.ok){cnLoadList();toast(res.posted+' posted to SAP ✓'+(res.failed?(' · '+res.failed+' failed'):''))}
  else if(res&&res.not_configured){toast('SAP not set up — use Header/Row download','err')}
  else toast((res&&res.error)||'SAP post failed','err')});
$('#cnDlBtn')&&($('#cnDlBtn').onclick=e=>{e.stopPropagation();$('#cnDlMenu').hidden=!$('#cnDlMenu').hidden});
document.addEventListener('click',e=>{const m=$('#cnDlMenu');if(m&&!e.target.closest('.export-wrap'))m.hidden=true});
$('#cnDlMenu')&&$$('#cnDlMenu button').forEach(b=>b.onclick=()=>{const dl=b.dataset.dl;
  if(dl==='header'||dl==='both')window.open(S('api/cn_uploader.php?which=header'),'_blank');
  if(dl==='row'||dl==='both')setTimeout(()=>window.open(S('api/cn_uploader.php?which=row'),'_blank'),dl==='both'?400:0);
  toast('Preparing files…')});

async function postSap(id){
  if(!confirm('Post this credit note directly to SAP?'))return;
  const res=await api('api/creditnote.php?action=sap_post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  if(res&&res.ok)toast('Posted to SAP ✓ DocNum '+(res.sap_docnum||''));
  else if(res&&res.not_configured)toast('SAP not set up — download the uploaders instead','err');
  else toast((res&&res.error)||'SAP post failed','err');
}

// ---- masters (admin) ----
async function loadMaster(which){
  $$('.mt-tab').forEach(t=>t.classList.toggle('active',t.dataset.mt===which));
  const area=$('#masterArea');area.innerHTML='<div class="loading">Loading…</div>';
  if(which==='customer'){
    area.innerHTML=`<div class="panel"><div class="flex between" style="margin-bottom:12px"><input id="custSearch" placeholder="Search customer name or code…" style="flex:1;margin-right:10px"><button class="btn btn-ghost btn-sm" id="custAdd">+ Add customer</button></div><div id="custResults" class="hint">Type to search 6,000+ customers.</div></div>`;
    const inp=$('#custSearch');
    const run=async()=>{const q=inp.value.trim();if(q.length<2){$('#custResults').innerHTML='<span class="hint">Type to search.</span>';return}
      const d=await api('api/creditnote.php?action=masters&m=customer&q='+encodeURIComponent(q));
      const rows=d.rows||[];
      if(!rows.length){$('#custResults').innerHTML='<span class="hint">No match.</span>';return}
      $('#custResults').innerHTML='<div class="lineitems"><table class="items-tbl"><thead><tr><th>Code</th><th>Name</th><th></th></tr></thead><tbody>'+
        rows.map(r=>`<tr><td>${esc(r.bp_code)}</td><td>${esc(r.bp_name)}</td><td class="acts"><button class="iconbtn" data-cedit='${esc(JSON.stringify(r))}'>✎</button><button class="iconbtn del" data-cdel="${r.id}">🗑</button></td></tr>`).join('')+'</tbody></table></div>';
      $('#custResults').querySelectorAll('[data-cedit]').forEach(b=>b.onclick=()=>custForm(JSON.parse(b.dataset.cedit),run));
      $('#custResults').querySelectorAll('[data-cdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this customer?'))return;
        await api('api/creditnote.php?action=master_delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({m:'customer',id:b.dataset.cdel})});run();toast('Deleted')});
    };
    inp.oninput=run;
    $('#custAdd').onclick=()=>custForm({bp_code:'',bp_name:''},run);
    return;
  }
  const d=await api('api/creditnote.php?action=masters&m='+which);const rows=(d&&d.rows)||[];
  let cols,render,blank;
  if(which==='gl'){cols=['Account name','Account code','Remark key'];render=r=>[r.account_name,r.account_code,r.remark_key];blank={account_name:'',account_code:'',remark_key:''}}
  if(which==='bp'){cols=['Branch id','Branch code'];render=r=>[r.branch_id,r.branch_code];blank={branch_id:'',branch_code:''}}
  if(which==='series'){cols=['Doc type','GST sub','Location','Series','Series name'];render=r=>[r.doc_type,r.gst_sub,r.location_code,r.series,r.series_name];blank={doc_type:'CN',gst_sub:'--',location_code:'',series:'',series_name:''}}
  let h=`<div class="panel nopad"><table class="tbl"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}<th></th></tr></thead><tbody>`;
  rows.forEach(r=>{h+='<tr>'+render(r).map(v=>`<td>${esc(v)}</td>`).join('')+`<td class="acts"><button class="iconbtn" data-edit='${esc(JSON.stringify(r))}'>✎</button><button class="iconbtn del" data-del="${r.id}">🗑</button></td></tr>`});
  h+='</tbody></table></div><button class="btn btn-ghost mt" id="masterAdd" style="margin-top:14px">+ Add row</button>';
  area.innerHTML=h;
  area.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>masterForm(which,JSON.parse(b.dataset.edit)));
  area.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this row?'))return;
    await api('api/creditnote.php?action=master_delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({m:which,id:b.dataset.del})});loadMaster(which);toast('Deleted')});
  $('#masterAdd').onclick=()=>masterForm(which,blank);
}
function masterForm(which,row){
  const fields={gl:[['account_name','Account name'],['account_code','Account code'],['remark_key','Remark key']],
    bp:[['branch_id','Branch id'],['branch_code','Branch code']],
    series:[['doc_type','Doc type (CN/DN)'],['gst_sub','GST sub (-- / GA)'],['location_code','Location'],['series','Series'],['series_name','Series name']]}[which];
  const body=fields.map(([k,l])=>`<label>${l}</label><input data-k="${k}" value="${esc(row[k]||'')}">`).join('');
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>${row.id?'Edit':'Add'} row</h3><button class="x">&times;</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn btn-ghost x2">Cancel</button><button class="btn btn-primary save">Save</button></div></div>`;
  document.body.appendChild(m);document.body.classList.add('modal-open');
  const close=()=>{m.remove();document.body.classList.remove('modal-open')};
  m.querySelector('.x').onclick=close;m.querySelector('.x2').onclick=close;m.addEventListener('mousedown',e=>{if(e.target===m)close()});
  m.querySelector('.save').onclick=async()=>{const data={m:which,id:row.id||''};m.querySelectorAll('[data-k]').forEach(i=>data[i.dataset.k]=i.value);
    const res=await api('api/creditnote.php?action=master_save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(res&&res.ok){close();loadMaster(which);toast('Saved ✓')}else toast((res&&res.error)||'Failed','err')};
}
$$('.mt-tab').forEach(t=>t.onclick=()=>loadMaster(t.dataset.mt));



// ---- customer add/edit modal ----
function custForm(row,after){
  const m=document.createElement('div');m.className='modal';
  m.innerHTML='<div class="modal-card"><div class="modal-head"><h3>'+(row.id?'Edit':'Add')+' customer</h3><button class="x">&times;</button></div>'+
    '<div class="modal-body"><label>Card code (CUS…)</label><input id="cf_code" value="'+esc(row.bp_code||'')+'"><label>Customer name</label><input id="cf_name" value="'+esc(row.bp_name||'')+'"></div>'+
    '<div class="modal-foot"><button class="btn btn-ghost x2">Cancel</button><button class="btn btn-primary save">Save</button></div></div>';
  document.body.appendChild(m);document.body.classList.add('modal-open');
  const close=()=>{m.remove();document.body.classList.remove('modal-open')};
  m.querySelector('.x').onclick=close;m.querySelector('.x2').onclick=close;m.addEventListener('mousedown',e=>{if(e.target===m)close()});
  m.querySelector('.save').onclick=async()=>{
    const data={m:'customer',id:row.id||'',bp_code:m.querySelector('#cf_code').value.trim(),bp_name:m.querySelector('#cf_name').value.trim()};
    if(!data.bp_code||!data.bp_name){toast('Code and name required','err');return}
    const res=await api('api/creditnote.php?action=master_save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(res&&res.ok){close();if(after)after();toast('Saved \u2713')}else toast((res&&res.error)||'Failed','err');
  };
}

// ============================================
// API & SETTINGS module (admin) — CRM-style editable cards
// ============================================
window.__loadSettings=loadSettings;
async function loadSettings(){
  const area=document.getElementById('settingsArea'); if(!area)return;
  area.innerHTML='<div class="loading">Loading…</div>';
  const d=await api('api/creditnote.php?action=settings_list');
  const rows=(d&&d.rows)||[];
  if(!rows.length){area.innerHTML='<div class="empty"><div class="et">No settings yet</div></div>';return;}
  area.innerHTML='';
  rows.forEach(function(r){
    const card=document.createElement('div');card.className='set-card';
    const upd=r.updated_at?('updated '+r.updated_at.slice(0,16).replace('T',' ')):'';
    const secret=(r.is_secret==1 || r.config_value==='********');
    card.innerHTML='<div class="set-head"><div class="set-label">'+esc(r.label)+'</div><div class="set-id">id: '+esc(r.config_key)+(upd?' · '+esc(upd):'')+'</div></div>'+
      '<div class="set-row"><input class="set-input" type="text" value="'+esc(r.config_value)+'" data-k="'+esc(r.config_key)+'">'+
      '<button class="btn btn-ghost set-reveal" title="Show the value actually in use">Show</button>'+
      '<button class="btn btn-primary set-save">Save</button></div>';
    if(r.config_value===''){const h=card.querySelector('.set-input');if(h)h.placeholder='(using value from config.php — click Show)';}
    const inp=card.querySelector('.set-input');
    const rv=card.querySelector('.set-reveal');
    if(rv)rv.onclick=async function(){
      if(rv.textContent==='Hide'){inp.value='********';rv.textContent='Show';return;}
      const d=await api('api/creditnote.php?action=setting_reveal&config_key='+encodeURIComponent(r.config_key));
      if(d&&d.ok){inp.value=d.config_value;rv.textContent='Hide';}else toast('Could not reveal','err');
    };
    card.querySelector('.set-save').onclick=async function(){
      const res=await api('api/creditnote.php?action=setting_save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config_key:r.config_key,config_value:inp.value})});
      if(res&&res.ok){toast('Saved \u2713');if(res.updated_at){card.querySelector('.set-id').textContent='id: '+r.config_key+' · updated '+res.updated_at.slice(0,16).replace('T',' ');}}
      else toast((res&&res.error)||'Failed','err');
    };
    area.appendChild(card);
  });
}
document.querySelectorAll('.navbtn[data-view="settings"]').forEach(function(b){b.addEventListener('click',function(){setTimeout(loadSettings,50);});});
})();
