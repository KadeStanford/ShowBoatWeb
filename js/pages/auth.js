/* ShowBoat — Auth Pages (Login + Signup + Landing) */
const AuthPages = {

  _featureHighlights: `
    <div class="auth-feature"><div class="auth-feature-icon">${UI.icon('star', 20)}</div><div><p class="auth-feature-title">Rate Everything</p><p class="auth-feature-desc">Score shows, movies & individual episodes out of 10</p></div></div>
    <div class="auth-feature"><div class="auth-feature-icon">${UI.icon('users', 20)}</div><div><p class="auth-feature-title">Friends & Activity</p><p class="auth-feature-desc">See what friends are watching in a live activity feed</p></div></div>
    <div class="auth-feature"><div class="auth-feature-icon">${UI.icon('activity', 20)}</div><div><p class="auth-feature-title">Plex Sync</p><p class="auth-feature-desc">Auto-import your full Plex watch history</p></div></div>
    <div class="auth-feature"><div class="auth-feature-icon">${UI.icon('shuffle', 20)}</div><div><p class="auth-feature-title">What to Watch?</p><p class="auth-feature-desc">Matcher finds shows your group all wants to see</p></div></div>`,

  renderLanding() {
    return `<div class="landing-page">
      <!-- Nav -->
      <nav class="landing-nav">
        <div class="landing-nav-brand">${UI.icon('tv', 24)}<span>ShowBoat</span></div>
        <div class="landing-nav-links">
          <button class="landing-nav-login" onclick="App.navigate('login')">Sign In</button>
          <button class="btn-primary landing-nav-cta" onclick="App.navigate('signup')">Get Started Free</button>
        </div>
      </nav>

      <!-- Hero -->
      <section class="landing-hero">
        <div class="landing-hero-glow"></div>
        <div class="landing-hero-content">
          <div class="landing-badge">${UI.icon('zap', 14)} Free to use &middot; No ads</div>
          <h1 class="landing-h1">Track shows.<br>Rate episodes.<br><span class="landing-h1-accent">Watch together.</span></h1>
          <p class="landing-tagline">ShowBoat is the social TV &amp; movie tracker you've been waiting for — rate every episode, sync your Plex history, and see exactly what your friends are watching.</p>
          <div class="landing-cta-row">
            <button class="btn-primary landing-cta-main" onclick="App.navigate('signup')">${UI.icon('user-plus', 18)} Create Free Account</button>
            <button class="landing-cta-secondary" onclick="App.navigate('login')">Already have an account? Sign in</button>
          </div>
        </div>
        <div class="landing-hero-mockup">
          <div class="landing-phone">
            <div class="landing-phone-inner">
              <div class="landing-mock-activity">
                <div class="landing-mock-row mine"><div class="landing-mock-bubble mine-b"><div class="landing-mock-poster"></div><div><p class="landing-mock-action">rated S4E6 9/10</p><p class="landing-mock-title">Succession</p></div></div></div>
                <div class="landing-mock-row theirs"><div class="landing-mock-av">J</div><div class="landing-mock-bubble theirs-b"><div class="landing-mock-poster"></div><div><p class="landing-mock-action">watched</p><p class="landing-mock-title">The Bear</p></div></div></div>
                <div class="landing-mock-row mine"><div class="landing-mock-bubble mine-b"><div class="landing-mock-poster"></div><div><p class="landing-mock-action">added to watchlist</p><p class="landing-mock-title">Severance</p></div></div></div>
                <div class="landing-mock-row theirs"><div class="landing-mock-av">K</div><div class="landing-mock-bubble theirs-b"><div class="landing-mock-poster"></div><div><p class="landing-mock-action">rated S2E1 8/10</p><p class="landing-mock-title">Euphoria</p></div></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Grid -->
      <section class="landing-features">
        <h2 class="landing-section-title">Everything you need to track your watching life</h2>
        <div class="landing-features-grid">
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('tv', 28)}</div>
            <h3>TV &amp; Movies</h3>
            <p>Track every show, season, episode, and movie. Mark watched, build watchlists, browse trending.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('star', 28)}</div>
            <h3>Episode Ratings</h3>
            <p>Rate individual episodes, not just whole shows. Build your own ranking of the best episodes ever made.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('users', 28)}</div>
            <h3>Social Activity Feed</h3>
            <p>See what friends are watching in real time. The iMessage-style feed keeps you connected on-screen.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('alert-triangle', 28)}</div>
            <h3>Wall of Shame</h3>
            <p>Call out friends who still haven't watched the classics. A lighthearted way to nudge binge-worthy shows.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('activity', 28)}</div>
            <h3>Plex Sync</h3>
            <p>Connect your Plex server to automatically import your entire watch history — no manual entry needed.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('shuffle', 28)}</div>
            <h3>Group Matcher</h3>
            <p>Can't decide what to watch together? The Matcher finds shows everyone in your group actually wants to see.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('bar-chart-2', 28)}</div>
            <h3>Analytics</h3>
            <p>Deep stats on your watching habits — top shows, genres, episode ratings, monthly activity and more.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('award', 28)}</div>
            <h3>Badges</h3>
            <p>Earn badges as you hit milestones. The completionist in you will love unlocking every one.</p>
          </div>
        </div>
      </section>

      <!-- CTA Banner -->
      <section class="landing-cta-section">
        <h2>Ready to start tracking?</h2>
        <p>Free forever. No credit card. Sign up in 30 seconds.</p>
        <button class="btn-primary landing-cta-main" onclick="App.navigate('signup')">${UI.icon('user-plus', 18)} Create Your Free Account</button>
        <p class="landing-cta-signin">Already a member? <a href="#" onclick="App.navigate('login'); return false;">Sign in</a></p>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="tmdb-attribution" style="justify-content:center;margin:0">
          <img src="img/tmdb-logo.svg" alt="TMDB" class="tmdb-attr-logo">
          <p>This product uses TMDB and the TMDB APIs but is not endorsed or approved by TMDB.</p>
        </div>
      </footer>
    </div>`;
  },

  renderLogin() {
    return `<div class="auth-split-page">
      <!-- Left panel: promo -->
      <div class="auth-split-left">
        <div class="auth-split-brand">${UI.icon('tv', 32)}<span>ShowBoat</span></div>
        <h2 class="auth-split-headline">Your shows.<br>Your ratings.<br>Your crew.</h2>
        <p class="auth-split-sub">The social tracker for people who take their TV seriously.</p>
        <div class="auth-features-list">${this._featureHighlights}</div>
        <a href="#" class="auth-split-back" onclick="App.navigate('landing'); return false;">${UI.icon('arrow-left', 16)} Back to home</a>
      </div>
      <!-- Right panel: form -->
      <div class="auth-split-right">
        <div class="auth-form-card">
          <div class="auth-form-header">
            <div class="auth-logo-sm">${UI.icon('tv', 28)}</div>
            <h1 class="auth-title">Welcome back</h1>
            <p class="auth-subtitle">Sign in to your ShowBoat account</p>
          </div>
          <form class="auth-form" onsubmit="AuthPages.handleLogin(event)">
            <div class="input-group">
              <label>Email Address</label>
              <div class="input-wrapper">
                ${UI.icon('mail', 18)}
                <input type="email" id="login-email" placeholder="name@example.com" autocomplete="email" required>
              </div>
            </div>
            <div class="input-group">
              <label>Password</label>
              <div class="input-wrapper">
                ${UI.icon('lock', 18)}
                <input type="password" id="login-password" placeholder="Your password" autocomplete="current-password" required>
                <button type="button" class="toggle-password" onclick="AuthPages.togglePass('login-password', this)">${UI.icon('eye-off', 18)}</button>
              </div>
            </div>
            <button type="submit" class="btn-primary auth-submit-btn" id="login-btn">${UI.icon('log-in', 18)} Sign In</button>
            <p class="auth-footer">No account yet? <a href="#" onclick="App.navigate('signup'); return false;">Create one free</a></p>
          </form>
          <div class="tmdb-attribution auth-tmdb">
            <img src="img/tmdb-logo.svg" alt="TMDB" class="tmdb-attr-logo">
            <p>Uses TMDB APIs. Not endorsed by TMDB.</p>
          </div>
        </div>
      </div>
    </div>`;
  },

  renderSignup() {
    return `<div class="auth-split-page">
      <div class="auth-split-left">
        <div class="auth-split-brand">${UI.icon('tv', 32)}<span>ShowBoat</span></div>
        <h2 class="auth-split-headline">Join the crew.<br>Start tracking.</h2>
        <p class="auth-split-sub">Free forever. No credit card. Takes 30 seconds.</p>
        <div class="auth-features-list">${this._featureHighlights}</div>
        <a href="#" class="auth-split-back" onclick="App.navigate('landing'); return false;">${UI.icon('arrow-left', 16)} Back to home</a>
      </div>
      <div class="auth-split-right">
        <div class="auth-form-card">
          <div class="auth-form-header">
            <div class="auth-logo-sm">${UI.icon('user-plus', 28)}</div>
            <h1 class="auth-title">Create Account</h1>
            <p class="auth-subtitle">Join ShowBoat — it's totally free</p>
          </div>
          <form class="auth-form" onsubmit="AuthPages.handleSignup(event)">
            <div class="input-group">
              <label>Username</label>
              <div class="input-wrapper">
                ${UI.icon('user', 18)}
                <input type="text" id="signup-username" placeholder="Choose a username" autocomplete="username" required>
              </div>
            </div>
            <div class="input-group">
              <label>Email Address</label>
              <div class="input-wrapper">
                ${UI.icon('mail', 18)}
                <input type="email" id="signup-email" placeholder="name@example.com" autocomplete="email" required>
              </div>
            </div>
            <div class="input-group">
              <label>Password</label>
              <div class="input-wrapper">
                ${UI.icon('lock', 18)}
                <input type="password" id="signup-password" placeholder="At least 8 chars + a number" autocomplete="new-password" required minlength="8">
                <button type="button" class="toggle-password" onclick="AuthPages.togglePass('signup-password', this)">${UI.icon('eye-off', 18)}</button>
              </div>
            </div>
            <div class="input-group">
              <label>Confirm Password</label>
              <div class="input-wrapper">
                ${UI.icon('check-circle', 18)}
                <input type="password" id="signup-confirm" placeholder="Confirm your password" autocomplete="new-password" required>
              </div>
            </div>
            <button type="submit" class="btn-primary auth-submit-btn" id="signup-btn">${UI.icon('user-plus', 18)} Create Account</button>
            <p class="auth-footer">Already have an account? <a href="#" onclick="App.navigate('login'); return false;">Sign in</a></p>
          </form>
        </div>
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
