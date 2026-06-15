<script lang="ts">
  let { onlogin }: { onlogin: (email: string, password: string) => Promise<void> } = $props();
  let email = $state('admin@spark.local');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    loading = true;
    error = '';
    try { await onlogin(email, password); }
    catch (cause) { error = cause instanceof Error ? cause.message : 'Login gagal.'; }
    finally { loading = false; }
  }
</script>

<main class="login-shell">
  <section class="login-card">
    <div class="login-brand"><span>S</span><div><strong>Spark Builder</strong><small>Workspace administrator</small></div></div>
    <div class="login-copy"><span>AKSES AMAN</span><h1>Kelola website dari perangkat apa pun.</h1><p>Masuk untuk menyimpan revisi, mengelola media, dan menerbitkan halaman.</p></div>
    <form onsubmit={submit}>
      <label>Email admin<input type="email" autocomplete="username" bind:value={email} required /></label>
      <label>Password<input type="password" autocomplete="current-password" bind:value={password} minlength="12" required /></label>
      {#if error}<p class="error">{error}</p>{/if}
      <button disabled={loading}>{loading ? 'Memeriksa...' : 'Masuk ke builder'}</button>
    </form>
    <small class="hint">Kredensial diatur melalui environment server dan tidak pernah disimpan di browser.</small>
  </section>
</main>

<style>
  .login-shell{min-height:100svh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 20% 0,#dff0d8,transparent 35%),#eef1ec}.login-card{width:min(440px,100%);padding:28px;border:1px solid #dfe5df;border-radius:28px;background:rgba(255,255,255,.95);box-shadow:0 30px 80px rgba(22,35,25,.13)}.login-brand{display:flex;align-items:center;gap:11px}.login-brand>span{display:grid;width:42px;height:42px;place-items:center;border-radius:14px;background:#17211b;color:#d9ff62;font-weight:900}.login-brand strong,.login-brand small{display:block}.login-brand small{margin-top:2px;color:#79857d}.login-copy{margin:34px 0 24px}.login-copy>span{color:#4d7d59;font-size:10px;font-weight:850;letter-spacing:.15em}.login-copy h1{margin:8px 0 0;font-size:38px;line-height:1;letter-spacing:-.055em}.login-copy p{color:#68766d;line-height:1.55}form{display:grid;gap:14px}label{display:grid;gap:7px;color:#58665e;font-size:12px;font-weight:750}input{min-height:48px;padding:0 14px;border:1px solid #d7ded8;border-radius:14px;background:#fafbf9;font:inherit}form button{min-height:50px;border:0;border-radius:15px;background:#17211b;color:#fff;font-weight:850}.error{margin:0;padding:10px;border-radius:10px;background:#fff0ed;color:#a33b2e;font-size:12px}.hint{display:block;margin-top:18px;color:#8a958e;line-height:1.45}
</style>
