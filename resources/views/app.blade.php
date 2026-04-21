<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="csrf-token" content="{{ csrf_token() }}"/>
  <title>SDO Koronadal City – Leave Card System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="{{ asset('css/app.css') }}"/>
</head>
<body>
<div id="app">
  <!-- LOGIN SCREEN -->
  <div id="s-login" class="screen">
    <div class="lw">
      <div class="split">
        <div class="sl">
          <div class="l-logos">
            <img src="https://upload.wikimedia.org/wikipedia/en/a/a8/DepEd_Koronadal.png" alt="DepEd" onerror="this.style.display='none'"/>
          </div>
          <div class="l-tag">DepEd SDO Koronadal City</div>
          <h1>Leave Card<br/>Management<br/>System</h1>
          <div class="l-rule"></div>
          <p>Official digital leave tracking system for all personnel of the Schools Division Office of Koronadal City.</p>
          <br/><small>SDO KORONADAL CITY — SINCE 2024</small>
        </div>
        <div class="sr">
          <div class="lfw">
            <h2>Welcome Back</h2>
            <div class="lsub">Sign in to your account</div>
            <form id="loginForm" autocomplete="off">
              <div class="lf">
                <label>Email / Employee ID</label>
                <div class="lfi"><input id="lid" type="text" placeholder="your@deped.gov.ph" required/></div>
              </div>
              <div class="lf">
                <label>Password</label>
                <div class="lfi">
                  <input id="lpw" type="password" placeholder="••••••••" required/>
                  <button type="button" class="leye" id="eyeBtn">👁</button>
                </div>
              </div>
              <div id="loginErr" class="lerr"></div>
              <button type="submit" class="lbtn">Sign In</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- APP SCREEN -->
  <div id="s-app" class="screen">
    <div id="sbOverlay" class="sb-overlay"></div>
    <div id="sidebar" class="sidebar"></div>
    <header class="topbar"><div id="topbar"></div></header>
    <main class="ca">
      <div id="pg-home"  class="page"></div>
      <div id="pg-list"  class="page"></div>
      <div id="pg-cards" class="page"></div>
      <div id="pg-nt"    class="page"></div>
      <div id="pg-t"     class="page"></div>
      <div id="pg-sa"    class="page"></div>
      <div id="pg-user"  class="page"></div>
    </main>
  </div>
</div>
<script>
  window.CSRF_TOKEN = "{{ csrf_token() }}";
  window.API_BASE   = "{{ url('/api') }}";
</script>
<script src="{{ asset('js/app.js') }}"></script>
</body>
</html>
