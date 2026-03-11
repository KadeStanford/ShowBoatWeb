/* ShowBoat — Auth Pages (Login + Signup) */
const AuthPages = {
  renderLogin() {
    return `<div class="auth-page">
      <div class="auth-logo">${UI.icon('tv', 40)}</div>
      <h1 class="auth-title">ShowBoat</h1>
      <p class="auth-subtitle">Your personal media tracker</p>
      <form class="auth-form" onsubmit="AuthPages.handleLogin(event)">
        <div class="input-group">
          <label>Email Address</label>
          <div class="input-wrapper">
            ${UI.icon('mail', 20)}
            <input type="email" id="login-email" placeholder="name@example.com" autocomplete="email" required>
          </div>
        </div>
        <div class="input-group">
          <label>Password</label>
          <div class="input-wrapper">
            ${UI.icon('lock', 20)}
            <input type="password" id="login-password" placeholder="Enter your password" autocomplete="current-password" required>
            <button type="button" class="toggle-password" onclick="AuthPages.togglePass('login-password', this)">${UI.icon('eye-off', 20)}</button>
          </div>
        </div>
        <button type="submit" class="btn-primary" id="login-btn">Sign In</button>
        <div class="auth-footer">
          Don't have an account? <a href="#" onclick="App.navigate('signup'); return false;">Create Account</a>
        </div>
      </form>
    </div>`;
  },

  renderSignup() {
    return `<div class="auth-page">
      <div style="width:100%;max-width:400px">
        <button class="back-btn" onclick="App.navigate('login')" style="width:40px;height:40px;border-radius:50%;background:var(--slate-900);border:1px solid var(--slate-800);display:flex;align-items:center;justify-content:center;margin-bottom:24px;color:white">${UI.icon('arrow-left', 20)}</button>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle" style="margin-bottom:32px">Join ShowBoat today</p>
        <form class="auth-form" onsubmit="AuthPages.handleSignup(event)">
          <div class="input-group">
            <label>Username</label>
            <div class="input-wrapper">
              ${UI.icon('user', 20)}
              <input type="text" id="signup-username" placeholder="Choose a username" autocomplete="username" required>
            </div>
          </div>
          <div class="input-group">
            <label>Email Address</label>
            <div class="input-wrapper">
              ${UI.icon('mail', 20)}
              <input type="email" id="signup-email" placeholder="name@example.com" autocomplete="email" required>
            </div>
          </div>
          <div class="input-group">
            <label>Password</label>
            <div class="input-wrapper">
              ${UI.icon('lock', 20)}
              <input type="password" id="signup-password" placeholder="Create a password" autocomplete="new-password" required minlength="8">
              <button type="button" class="toggle-password" onclick="AuthPages.togglePass('signup-password', this)">${UI.icon('eye-off', 20)}</button>
            </div>
            <span class="input-helper">Must be at least 8 characters and contain a number</span>
          </div>
          <div class="input-group">
            <label>Confirm Password</label>
            <div class="input-wrapper">
              ${UI.icon('check-circle', 20)}
              <input type="password" id="signup-confirm" placeholder="Confirm your password" autocomplete="new-password" required>
            </div>
          </div>
          <button type="submit" class="btn-primary" id="signup-btn">Sign Up</button>
        </form>
      </div>
    </div>`;
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { UI.toast('Please enter email and password', 'error'); return; }
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      UI.toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  },

  async handleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!username || !email || !password || !confirm) { UI.toast('Please fill in all fields', 'error'); return; }
    if (password.length < 8) { UI.toast('Password must be at least 8 characters', 'error'); return; }
    if (!/\d/.test(password)) { UI.toast('Password must contain at least one number', 'error'); return; }
    if (password !== confirm) { UI.toast('Passwords do not match', 'error'); return; }

    const btn = document.getElementById('signup-btn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      // Check username uniqueness
      const snap = await db.collection('users').where('username_lowercase', '==', username.toLowerCase()).get();
      if (!snap.empty) { UI.toast('Username is already taken', 'error'); btn.disabled = false; btn.textContent = 'Sign Up'; return; }

      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: username });
      await db.collection('users').doc(cred.user.uid).set({
        username, username_lowercase: username.toLowerCase(),
        email: email.toLowerCase(), createdAt: Date.now()
      });
    } catch (err) {
      UI.toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Sign Up';
    }
  },

  togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = UI.icon(show ? 'eye' : 'eye-off', 20);
  }
};
