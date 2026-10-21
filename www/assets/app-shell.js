// ============================================
// Extracto — app-shell.js  (Android app only)
// Simple, clean phone app — like your CRM / WhatsApp:
//   top bar (☰ + Extracto) · Home · bottom tabs · side drawer
// Website is untouched (this file does nothing on the web).
// ============================================
(function(){
  if(!window.IS_NATIVE_APP) return;
  document.body.classList.add('is-app');

  // ---------- icons (line style, like CRM) ----------
  var I={
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3.2"/>',
    data:'<path d="M4 5h16M4 10h16M4 15h16M4 20h10"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    doc:'<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    rupee:'<path d="M7 4h10M7 9h10M7 4c5 0 7 2 7 5s-3 5-7 5l7 6"/>',
    grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    out:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H4"/>',
    x:'<path d="M6 6l12 12M18 6 6 18"/>',
    chev:'<path d="M9 6l6 6-6 6"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    send:'<path d="M4 12 20 4l-6 16-3-7z"/>'
  };
  function ic(n,cls){return '<svg class="'+(cls||'i')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+I[n]+'</svg>';}
  function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  var ME={name:'',role:'',email:''}, MODS=[], HAS_CN=false;

  document.addEventListener('DOMContentLoaded', function(){
    var main=document.querySelector('.main'); if(!main) return;

    // ---------- top bar ----------
    var top=document.createElement('header'); top.className='ax-top';
    top.innerHTML='<button class="ax-ib" id="axMenu" aria-label="Menu">'+ic('menu')+'</button>'+
      '<div class="ax-brand">Extracto</div>'+
      '<button class="ax-ib" id="axRefresh" aria-label="Refresh">'+ic('refresh')+'</button>';
    document.body.insertBefore(top, document.body.firstChild);

    // ---------- home view (own design) ----------
    var home=document.createElement('section'); home.id='v-home'; home.className='view';
    home.innerHTML=
      '<div class="hx-head"><div><div class="ax-hi">Welcome</div><div class="hx-name" id="axName">&nbsp;</div>'+
      '<div class="hx-date" id="axSub">&nbsp;</div></div><button class="hx-av" data-go="profile" id="axHAv">U</button></div>'+
      '<button class="hx-scan" id="axScanNow"><div class="hx-scan-t"><b>Scan documents</b>'+
      '<span>Photo, PDF or Excel — the AI fills every field for you</span></div>'+
      '<span class="hx-scan-btn">'+ic('scan')+'</span></button>'+
      '<div class="hx-month"><div class="hx-m"><b id="axS1">0</b><span>Scans today</span></div>'+
      '<div class="hx-m"><b id="axS2">0</b><span>Credit notes</span></div>'+
      '<div class="hx-m"><b id="axS3">0</b><span>Pending SAP</span></div></div>'+
      '<div class="ax-sec hx-sec"><span>Your modules</span><button data-go="appmods">See all</button></div>'+
      '<div class="hx-mods" id="axHomeMods"></div>'+
      '<div class="ax-sec">Recent activity</div>'+
      '<div class="ax-list" id="axRecent"><div class="ax-empty">Nothing yet — scan your first document.</div></div>';
    main.insertBefore(home, main.firstChild);

    // ---------- modules view ----------
    var mv=document.createElement('section'); mv.id='v-appmods'; mv.className='view';
    mv.innerHTML='<div class="vhead"><h1>Modules</h1><p>Pick a module, then scan.</p></div><div class="hx-mods hx-mods-all" id="axAllMods"></div>';
    main.appendChild(mv);

    // ---------- profile view ----------
    var prof=document.createElement('section'); prof.id='v-profile'; prof.className='view';
    prof.innerHTML=
      '<div class="ax-pcard"><div class="ax-av" id="axAv">U</div>'+
      '<div class="ax-pname" id="axPName">&nbsp;</div><div class="ax-prole" id="axPRole">&nbsp;</div></div>'+
      '<div class="ax-list">'+
        row('user','Name','axPN')+row('doc','Email','axPE')+row('grid','Role','axPR')+
      '</div>'+
      '<button class="ax-signout" id="axOut2">'+ic('out')+' Sign out</button>'+
      '<div class="ax-ver">Extracto · Eurobond<br>Developed and Designed by <b>Karthik G</b></div>';
    main.appendChild(prof);
    function row(icon,label,id){
      return '<div class="ax-row"><span class="ax-rowic">'+ic(icon)+'</span><div class="ax-rowt"><div class="ax-rowl">'+label+'</div><div class="ax-rowv" id="'+id+'">—</div></div></div>';
    }

    // ---------- bottom tabs ----------
    var tabs=document.createElement('nav'); tabs.className='ax-tabs';
    tabs.innerHTML=tab('home','home','Home')+tab('scan','scan','Scan')+tab('appmods','grid','Modules')+tab('profile','user','Profile');
    document.body.appendChild(tabs);
    function tab(v,icon,label){return '<button class="ax-tab" data-go="'+v+'">'+ic(icon)+'<span>'+label+'</span></button>';}

    // ---------- drawer ----------
    var scrim=document.createElement('div'); scrim.className='ax-scrim';
    var dr=document.createElement('aside'); dr.className='ax-drawer';
    dr.innerHTML=
      '<div class="ax-dh"><div><div class="ax-dbrand">Extracto</div>'+
      '<div class="ax-dname" id="axDName">&nbsp;</div><div class="ax-drole" id="axDRole">&nbsp;</div></div>'+
      '<button class="ax-dx" id="axClose">'+ic('x')+'</button></div>'+
      '<div class="ax-dbody">'+
        '<div class="ax-dsec">Main</div>'+
        drow('home','home','Home')+drow('scan','scan','Scan documents')+drow('appmods','grid','All modules')+
        '<div class="ax-dsec">Modules</div><div id="axDMods"></div>'+
        '<div class="ax-dsec">Account</div>'+
        drow('profile','user','Profile')+
        '<button class="ax-drow ax-drow-out" id="axOut1"><span class="ax-drowic">'+ic('out')+'</span><span class="ax-drowt">Sign out</span></button>'+
      '</div>';
    document.body.appendChild(scrim); document.body.appendChild(dr);
    function drow(v,icon,label){return '<button class="ax-drow" data-go="'+v+'"><span class="ax-drowic">'+ic(icon)+'</span><span class="ax-drowt">'+label+'</span>'+ic('chev','ax-chev')+'</button>';}

    function openDrawer(){dr.classList.add('open');scrim.classList.add('open');}
    function closeDrawer(){dr.classList.remove('open');scrim.classList.remove('open');}
    document.getElementById('axMenu').onclick=openDrawer;
    document.getElementById('axClose').onclick=closeDrawer;
    scrim.onclick=closeDrawer;

    // ---------- navigation ----------
    function go(v){
      document.querySelectorAll('.view').forEach(function(x){x.classList.remove('active');});
      var el=document.getElementById('v-'+v); if(el) el.classList.add('active');
      var tabV=(v==='creditnote')?'appmods':v;
      document.querySelectorAll('.ax-tab').forEach(function(t){t.classList.toggle('active',t.dataset.go===tabV);});
      try{
        if(v==='home') loadHome();
      }catch(e){}
      window.scrollTo(0,0); closeDrawer();
    }
    window.axGo=go;
    document.addEventListener('click',function(e){
      var b=e.target.closest('[data-go]'); if(b){ e.preventDefault(); go(b.dataset.go); }
    });
    document.getElementById('axScanNow').onclick=function(){go('scan');};
    document.getElementById('axRefresh').onclick=function(){location.reload();};

    async function signOut(){
      try{ await fetch(window.apiUrl('auth.php?action=logout')); }catch(e){}
      window.setToken&&window.setToken(''); location.href='login.html';
    }
    document.getElementById('axOut1').onclick=signOut;
    document.getElementById('axOut2').onclick=signOut;

    // scan screen wording for phones
    var dt=document.querySelector('#drop .drop-t'); if(dt) dt.textContent='Tap to take a photo or choose files';
    var ds=document.querySelector('#drop .drop-s'); if(ds) ds.textContent='Camera, gallery, PDF or Excel · many at once';
    var cdt=document.querySelector('#cnDrop .drop-t'); if(cdt) cdt.textContent='Tap to take photos or choose files';

    // ---------- data ----------
    loadMe(); loadMods(); go('home');

    async function loadMe(){
      try{
        var r=await fetch(window.apiUrl('auth.php?action=me')); if(r.status===401){location.href='login.html';return;}
        var d=await r.json(); if(!d||!d.ok) return;
        ME={name:d.name||'',role:d.role==='admin'?'Administrator':'User',email:d.email||''};
        var h=new Date().getHours(), g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
        set('.ax-hi',g,true); 
        set('axName',ME.name); set('axSub',fmtDate());
        set('axDName',ME.name); set('axDRole',ME.email||ME.role);
        set('axAv',(ME.name||'U').charAt(0).toUpperCase()); set('axHAv',(ME.name||'U').charAt(0).toUpperCase()); set('axPName',ME.name); set('axPRole',ME.role);
        set('axPN',ME.name||'—'); set('axPE',ME.email||'—'); set('axPR',ME.role);
      }catch(e){}
    }
    async function loadMods(){
      try{
        var a=await (await fetch(window.apiUrl('auth.php?action=my_access'))).json();
        HAS_CN=!!(a&&a.modules&&a.modules.indexOf('credit_note')>=0);
      }catch(e){}
      try{
        var d=await (await fetch(window.apiUrl('api/modules.php?action=list'))).json();
        MODS=(d&&d.modules)||[];
      }catch(e){}
      var box=document.getElementById('axDMods'); var h='';
      if(HAS_CN) h+='<button class="ax-drow" data-cn="1"><span class="ax-drowic">'+ic('rupee')+'</span><span class="ax-drowt">Credit Note · SAP</span>'+ic('chev','ax-chev')+'</button>';
      MODS.forEach(function(m){
        h+='<button class="ax-drow" data-mod="'+m.id+'"><span class="ax-drowic ax-tag">'+esc((m.icon||'DOC').slice(0,3))+'</span><span class="ax-drowt">'+esc(m.name)+'</span>'+ic('chev','ax-chev')+'</button>';
      });
      if(!h) h='<div class="ax-dempty">No modules yet</div>';
      box.innerHTML=h;
      box.querySelectorAll('[data-mod]').forEach(function(b){
        b.onclick=function(){ pickModule(b.dataset.mod); };
      });
      var cn=box.querySelector('[data-cn]'); if(cn) cn.onclick=function(){ go('creditnote'); };
      var tiles='';
      if(HAS_CN) tiles+='<button class="hx-tile" data-cn="1"><span class="hx-ti">'+ic('rupee')+'</span><b>Credit Note</b><small>SAP uploader</small></button>';
      MODS.forEach(function(m){
        tiles+='<button class="hx-tile" data-mod="'+m.id+'"><span class="hx-ti hx-tag">'+esc((m.icon||'DOC').slice(0,3))+'</span><b>'+esc(m.name)+'</b><small>'+(m.header?m.header.length:0)+' fields</small></button>';
      });
      if(!tiles) tiles='<div class="ax-empty">No modules yet</div>';
      ['axHomeMods','axAllMods'].forEach(function(id){
        var el=document.getElementById(id); el.innerHTML=tiles;
        el.querySelectorAll('[data-mod]').forEach(function(b){ b.onclick=function(){ pickModule(b.dataset.mod); }; });
        el.querySelectorAll('[data-cn]').forEach(function(b){ b.onclick=function(){ go('creditnote'); }; });
      });
    }
    // open Scan with this module selected
    function pickModule(id){
      go('scan');
      var idx=-1; MODS.forEach(function(m,i){ if(String(m.id)===String(id)) idx=i; });
      var cards=document.querySelectorAll('#scanModList .modcard');
      if(idx>=0 && cards[idx]) cards[idx].click();
    }
    async function loadHome(){
      try{
        var d=await (await fetch(window.apiUrl('api/stats.php'))).json(); if(!d||!d.ok) return;
        count('axS1',d.scans_today); count('axS2',d.cn_month); count('axS3',d.cn_pending);
        var box=document.getElementById('axRecent');
        if(d.recent&&d.recent.length){
          box.innerHTML=d.recent.map(function(r){
            return '<div class="ax-row"><span class="ax-rowic">'+ic(r.t==='cn'?'rupee':'doc')+'</span>'+
              '<div class="ax-rowt"><div class="ax-rowv">'+esc(r.title)+'</div><div class="ax-rowl">'+(r.t==='cn'?'Credit note':'Scan')+' · '+ago(r.at)+'</div></div></div>';
          }).join('');
        }
      }catch(e){}
    }
  });

  // ---------- helpers ----------
  function set(id,v,isSel){ var e=isSel?document.querySelector(id):document.getElementById(id); if(e) e.textContent=v; }
  function fmtDate(){ return new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}); }
  function count(id,n){
    var e=document.getElementById(id); if(!e) return; n=parseInt(n)||0;
    var t0=performance.now(), dur=600;
    (function step(t){ var p=Math.min(1,(t-t0)/dur); e.textContent=Math.round(n*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(step); })(t0);
  }
  function ago(s){
    var t=new Date(String(s).replace(' ','T')); var m=Math.floor((Date.now()-t)/60000);
    if(isNaN(m)) return ''; if(m<1) return 'just now'; if(m<60) return m+' min ago';
    var h=Math.floor(m/60); if(h<24) return h+' hr ago'; var d=Math.floor(h/24); return d+' day'+(d>1?'s':'')+' ago';
  }
})();
