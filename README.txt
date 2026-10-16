========================================
 EXTRACTO APP (Capacitor — real app, CRM style)
========================================

This is the REAL app (not a website-in-a-box). The UI (login, scan, review,
masters, settings, users) is bundled INSIDE the app, so screens open instantly
and feel native. Data / AI / SAP all come from your live server
(https://scan.eurobond.co.in) over the API, using a login token.

HOW IT BUILDS (same as your CRM: push -> GitHub builds APK)
-----------------------------------------------------------
This repo has GitHub Actions. On every push it:
  npm install  ->  npx cap add android  ->  patch icons+camera  ->  build APK
You just download the finished APK from the Actions tab. No Android Studio needed.

ONE-TIME SETUP
--------------
1. Make a new GitHub repo, e.g.  extracto-mobile  (private is fine)
2. Open this "ExtractoApp" folder in VS Code
3. VS Code terminal:
     git init
     git add .
     git commit -m "Extracto app"
     git branch -M main
     git remote add origin https://github.com/EUROBOND-AI/extracto-mobile.git
     git push -u origin main

GET THE APK
-----------
1. GitHub repo -> Actions tab
2. Open the latest "Build Extracto App (Capacitor)" run (green tick = done, ~4-6 min)
3. Scroll down -> Artifacts -> "Extracto-app-debug" -> download -> unzip -> app-debug.apk
4. Install on any phone (allow Unknown sources)

WHEN I UPDATE THE UI
--------------------
- I give you updated www/ files -> you copy-paste over them in VS Code
- git add . && git commit -m "update" && git push
- Download the new APK from Actions.

NOTE: App UI code lives in www/. The server (scan.eurobond.co.in) stays as-is;
the app just talks to its API. Backend changes do NOT need a new APK.

FILES
-----
  www/                  the app UI (your Extracto screens, bundled)
  capacitor.config.json app id/name/webDir
  package.json          Capacitor dependencies
  patch-android.sh      injects Eurobond icon + camera permission after build
  android-res/          the app icon images
  .github/workflows/    the auto-build
