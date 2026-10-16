// ============================================
// Extracto — app-config.js
// Shared bootstrap for BOTH the website and the Android (Capacitor) app.
// - On the website: API_BASE is '' (same origin), login uses the session.
// - In the app: API_BASE points to the live server, login uses a saved token.
// Load this BEFORE app.js / creditnote.js on every page.
// ============================================
(function(){
  // Detect if we're running inside the Capacitor app (file:// or capacitor://)
  // In-app when Capacitor is present, or when served from localhost/file (app webview),
  // i.e. NOT from the real website domain.
  var host = location.hostname || '';
  var isApp = !!(window.Capacitor) ||
              location.protocol === 'file:' ||
              location.protocol === 'capacitor:' ||
              host === 'localhost' || host === '' ;

  // Live server used by the app for ALL data/AI/SAP calls
  var SERVER = 'https://scan.eurobond.co.in';

  window.API_BASE = isApp ? SERVER : '';
  window.IS_NATIVE_APP = !!isApp;

  // ---- token storage (app only; web uses the session cookie) ----
  window.getToken = function(){ try { return localStorage.getItem('extracto_token')||''; } catch(e){ return ''; } };
  window.setToken = function(t){ try { if(t) localStorage.setItem('extracto_token',t); else localStorage.removeItem('extracto_token'); } catch(e){} };

  // Build a full URL for an API path ('api/x.php' or 'auth.php')
  window.apiUrl = function(path){
    if(/^https?:\/\//i.test(path)) return path;        // already absolute
    var base = window.API_BASE || '';
    if(base && path.charAt(0)!=='/') path = '/'+path;
    return base + path;
  };

  // Attach the token header for app requests
  window.authHeaders = function(extra){
    var h = extra || {};
    var t = window.getToken();
    if(window.IS_NATIVE_APP && t) h['Authorization'] = 'Bearer '+t;
    return h;
  };

  // Where to send the user when not logged in
  window.loginPage = function(){
    return window.IS_NATIVE_APP ? 'login.html' : 'login.php';
  };

  // Build a URL for <img src> or a download/open link.
  // In the app: full server URL + ?token= (since headers can't ride on img/anchor).
  window.srcUrl = function(path){
    var u = window.apiUrl(path);
    if(window.IS_NATIVE_APP){
      var t = window.getToken();
      if(t) u += (u.indexOf('?')>=0?'&':'?') + 'token=' + encodeURIComponent(t);
    }
    return u;
  };

  // Patch window.fetch so EVERY existing fetch() call works in the app
  // (prepends API_BASE for relative api/auth URLs, adds the token header).
  var _fetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    try {
      if (typeof input === 'string' && window.IS_NATIVE_APP) {
        // only rewrite our own relative API/auth/asset calls
        if (/^(api\/|auth\.php|assets\/|file\.php)/i.test(input) || input.charAt(0)==='/') {
          input = window.apiUrl(input);
        }
        init = init || {};
        init.headers = window.authHeaders(init.headers || {});
        // send/accept cookies not needed in app; token carries identity
      }
    } catch(e){}
    return _fetch(input, init);
  };
})();
