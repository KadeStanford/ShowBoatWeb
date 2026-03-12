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
        <div class="landing-nav-brand">
          <img src="img/logo-wordmark.png" alt="ShowBoat" class="brand-icon" style="height:32px;border-radius:8px">
          <img src="img/logo-icon.png" alt="ShowBoat" class="brand-wordmark">
        </div>
        <div class="landing-nav-links">
          <button class="landing-nav-login" onclick="App.navigate('login')">Sign In</button>
          <button class="btn-primary landing-nav-cta" onclick="document.getElementById('waitlist-section').scrollIntoView({behavior:'smooth'})">Join Waitlist</button>
        </div>
      </nav>

      <!-- Hero -->
      <section class="landing-hero">
        <div class="landing-hero-orb landing-hero-orb--1"></div>
        <div class="landing-hero-orb landing-hero-orb--2"></div>
        <div class="landing-hero-content">
          <div class="landing-badge">${UI.icon('zap', 14)} Invite-only &middot; Spots are limited</div>
          <h1 class="landing-h1">Track what you watch.<br>Together.</h1>
          <p class="landing-tagline">Episode-level ratings, Plex sync, a live friend feed, and a Group Matcher that ends the "what should we watch" debate. ShowBoat is the tracker for people who actually care.</p>
          <div class="landing-cta-row">
            <button class="btn-primary landing-cta-main" onclick="document.getElementById('waitlist-section').scrollIntoView({behavior:'smooth'})">${UI.icon('mail', 18)} Join the Waitlist</button>
            <button class="landing-cta-secondary" onclick="App.navigate('login')">Have an invite? Sign in &rarr;</button>
          </div>
        </div>
        <div class="landing-hero-visual">
          <div class="landing-hero-phone">
            <div class="landing-phone-screen">
              <div class="landing-phone-bar">
                <span class="landing-phone-bar-dot"></span>
                <span class="landing-phone-bar-title">Activity</span>
                <span></span>
              </div>
              <div class="landing-mock-feed">
                <div class="landing-feed-item">
                  <div class="landing-feed-av" style="background:var(--emerald-600)">S</div>
                  <div class="landing-feed-body"><span class="landing-feed-name">Sarah</span> rated <strong>Succession</strong> S4E6 <span class="landing-feed-score">9/10</span></div>
                </div>
                <div class="landing-feed-item">
                  <div class="landing-feed-av" style="background:var(--indigo-500)">J</div>
                  <div class="landing-feed-body"><span class="landing-feed-name">Jake</span> started watching <strong>The Bear</strong></div>
                </div>
                <div class="landing-feed-item">
                  <div class="landing-feed-av" style="background:#e879f9">K</div>
                  <div class="landing-feed-body"><span class="landing-feed-name">Kim</span> added <strong>Severance</strong> to watchlist</div>
                </div>
                <div class="landing-feed-item">
                  <div class="landing-feed-av" style="background:var(--emerald-600)">S</div>
                  <div class="landing-feed-body"><span class="landing-feed-name">Sarah</span> rated <strong>Euphoria</strong> S2E1 <span class="landing-feed-score">8/10</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Stats ribbon -->
      <section class="landing-stats">
        <div class="landing-stat"><span class="landing-stat-num">10/10</span><span class="landing-stat-label">Episode Ratings</span></div>
        <div class="landing-stat"><span class="landing-stat-num">${UI.icon('refresh-cw', 20)}</span><span class="landing-stat-label">Plex Auto-Sync</span></div>
        <div class="landing-stat"><span class="landing-stat-num">${UI.icon('users', 20)}</span><span class="landing-stat-label">Social Feed</span></div>
        <div class="landing-stat"><span class="landing-stat-num">${UI.icon('shuffle', 20)}</span><span class="landing-stat-label">Group Matcher</span></div>
      </section>

      <!-- Features -->
      <section class="landing-features">
        <div class="landing-section-header">
          <h2 class="landing-section-title">Everything you need to track smarter</h2>
          <p class="landing-section-sub">Built for the way you actually watch — not the way apps think you do.</p>
        </div>
        <div class="landing-features-grid">
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('star', 24)}</div>
            <h3>Episode-Level Ratings</h3>
            <p>Rate individual episodes out of 10. Build your personal all-time ranking across every show you've ever watched.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('activity', 24)}</div>
            <h3>Plex Sync</h3>
            <p>Connect your Plex server and your entire watch history imports automatically. Zero manual logging.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('users', 24)}</div>
            <h3>Live Activity Feed</h3>
            <p>An iMessage-style feed of what friends are watching and rating in real-time. Stay in the loop effortlessly.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('shuffle', 24)}</div>
            <h3>Group Matcher</h3>
            <p>Tinder for movie night. Swipe on titles with friends and surface what you both want to watch together.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('bar-chart-2', 24)}</div>
            <h3>Deep Analytics</h3>
            <p>Top genres, most-watched directors, average scores by show, and monthly viewing trends in rich charts.</p>
          </div>
          <div class="landing-feature-card">
            <div class="landing-feature-icon">${UI.icon('award', 24)}</div>
            <h3>Badges & Milestones</h3>
            <p>Earn badges for watching milestones — completionist runs, rating streaks, genre mastery. Show them off.</p>
          </div>
        </div>
      </section>

      <!-- Testimonial -->
      <section class="landing-proof-section">
        <div class="landing-proof-inner">
          <div class="landing-proof-mark">&ldquo;</div>
          <p class="landing-proof-quote">Finally, a tracker that treats episodes like first-class citizens.</p>
          <p class="landing-proof-attr">&mdash; ShowBoat beta tester</p>
        </div>
      </section>

      <!-- Waitlist -->
      <section class="landing-cta-section" id="waitlist-section">
        <div class="landing-cta-inner">
          <h2>Get early access</h2>
          <p>ShowBoat is invite-only. Drop your email and we'll send a code when a spot opens.</p>
          <div class="waitlist-form" id="waitlist-form-wrap">
            <input type="text" id="waitlist-name" class="waitlist-input" placeholder="Your name (optional)">
            <input type="email" id="waitlist-email" class="waitlist-input" placeholder="Email address" required>
            <button class="btn-primary landing-cta-main" onclick="AuthPages.joinWaitlist()">${UI.icon('mail', 18)} Request Invite</button>
          </div>
          <div id="waitlist-success" style="display:none;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:10px;padding:16px 20px;margin-top:12px;color:#34d399;font-weight:500">
            ${UI.icon('check-circle', 18)} You're on the list! We'll reach out soon.
          </div>
          <p class="landing-cta-signin">Already have an invite code? <a href="#" onclick="App.navigate('signup'); return false;">Create your account &rarr;</a></p>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="landing-footer-inner">
          <div class="landing-footer-brand">
            <img src="img/logo-wordmark.png" alt="ShowBoat" style="height:24px;border-radius:6px;opacity:.6">
          </div>
          <div class="tmdb-attribution" style="justify-content:center;margin:0">
            <img src="img/tmdb-logo.svg" alt="TMDB" class="tmdb-attr-logo">
            <p>This product uses TMDB and the TMDB APIs but is not endorsed or approved by TMDB.</p>
          </div>
        </div>
      </footer>
    </div>`;
  },

  async joinWaitlist() {
    const email = document.getElementById('waitlist-email')?.value?.trim();
    const name = document.getElementById('waitlist-name')?.value?.trim() || '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('Please enter a valid email address', 'error'); return; }
    try {
      // Check for duplicate
      const existing = await db.collection('waitlist').where('email', '==', email.toLowerCase()).limit(1).get();
      if (!existing.empty) { UI.toast('You\'re already on the waitlist!', 'info'); return; }
      await db.collection('waitlist').add({ email: email.toLowerCase(), name, createdAt: Date.now() });
      document.getElementById('waitlist-form-wrap').style.display = 'none';
      document.getElementById('waitlist-success').style.display = 'block';
    } catch (e) { UI.toast('Something went wrong. Please try again.', 'error'); }
  },

  renderLogin() {
    return `<div class="auth-split-page">
      <!-- Left panel: promo -->
      <div class="auth-split-left">
        <div class="auth-split-brand"><img src="img/logo-icon.png" alt="ShowBoat" class="brand-wordmark"></div>
        <h2 class="auth-split-headline">Your shows.<br>Your ratings.<br>Your crew.</h2>
        <p class="auth-split-sub">The social tracker for people who take their TV seriously.</p>
        <div class="auth-features-list">${this._featureHighlights}</div>
        <a href="#" class="auth-split-back" onclick="App.navigate('landing'); return false;">${UI.icon('arrow-left', 16)} Back to home</a>
      </div>
      <!-- Right panel: form -->
      <div class="auth-split-right">
        <div class="auth-form-card">
          <div class="auth-form-header">
            <div class="auth-logo-sm"><img src="img/logo-wordmark.png" alt="ShowBoat" class="brand-icon"></div>
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
        <div class="auth-split-brand"><img src="img/logo-icon.png" alt="ShowBoat" class="brand-wordmark"></div>
        <h2 class="auth-split-headline">Join the crew.<br>Start tracking.</h2>
        <p class="auth-split-sub">ShowBoat is invite-only right now. Have a code? You're in.</p>
        <div class="auth-features-list">${this._featureHighlights}</div>
        <a href="#" class="auth-split-back" onclick="App.navigate('landing'); return false;">${UI.icon('arrow-left', 16)} Back to home</a>
      </div>
      <div class="auth-split-right">
        <div class="auth-form-card">
          <div class="auth-form-header">
            <div class="auth-logo-sm"><img src="img/logo-wordmark.png" alt="ShowBoat" class="brand-icon"></div>
            <h1 class="auth-title">Create Account</h1>
            <p class="auth-subtitle">You'll need an invite code to join</p>
          </div>
          <form class="auth-form" onsubmit="AuthPages.handleSignup(event)">
            <div class="input-group">
              <label>Invite Code</label>
              <div class="input-wrapper">
                ${UI.icon('key', 18)}
                <input type="text" id="signup-code" placeholder="XXXX-XXXX" autocomplete="off" required maxlength="9" style="text-transform:uppercase;letter-spacing:2px" oninput="AuthPages.formatCode(this)">
              </div>
            </div>
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
    const code = document.getElementById('signup-code').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (!code || !username || !email || !password || !confirm) { UI.toast('Please fill in all fields', 'error'); return; }
    if (password.length < 8) { UI.toast('Password must be at least 8 characters', 'error'); return; }
    if (!/\d/.test(password)) { UI.toast('Password must contain at least one number', 'error'); return; }
    if (password !== confirm) { UI.toast('Passwords do not match', 'error'); return; }

    const btn = document.getElementById('signup-btn');
    btn.disabled = true; btn.textContent = 'Verifying code...';
    try {
      // Validate invite code first (public read — no auth needed)
      const validCode = await Services.validateInviteCode(code);
      if (!validCode) { UI.toast('Invalid or already used invite code', 'error'); btn.disabled = false; btn.innerHTML = UI.icon('user-plus', 18) + ' Create Account'; return; }

      btn.textContent = 'Creating account...';
      // Prevent onAuthStateChanged from firing background setup before the user doc exists
      App.signupInProgress = true;
      // Create Firebase Auth account first so we're authenticated for Firestore queries
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: username });

      // Now check username uniqueness (requires auth)
      const snap = await db.collection('users').where('username_lowercase', '==', username.toLowerCase()).get();
      if (!snap.empty) {
        // Username taken — delete the just-created auth account and bail
        await cred.user.delete();
        UI.toast('Username is already taken', 'error');
        btn.disabled = false; btn.innerHTML = UI.icon('user-plus', 18) + ' Create Account';
        return;
      }

      // Mark code as used, provision user with 5 tickets and 3 invite codes of their own
      await Services.useInviteCode(code, cred.user.uid);
      await db.collection('users').doc(cred.user.uid).set({
        username, username_lowercase: username.toLowerCase(),
        email: email.toLowerCase(), createdAt: Date.now(),
        tickets: 5, invitedWith: validCode.code
      });
      // Generate 3 invite codes for the new user to share
      await Services.generateUserInviteCodes(cred.user.uid, 3);
      // Account fully provisioned — let onAuthStateChanged run normally
      App.signupInProgress = false;
      App.navigate('home');
    } catch (err) {
      App.signupInProgress = false;
      UI.toast(err.message, 'error');
      btn.disabled = false; btn.innerHTML = UI.icon('user-plus', 18) + ' Create Account';
    }
  },

  togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = UI.icon(show ? 'eye' : 'eye-off', 20);
  },

  formatCode(el) {
    const cur = el.selectionStart;
    const before = el.value.slice(0, cur).replace(/[^A-Za-z0-9]/g, '').length;
    const raw = el.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    el.value = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
    const newPos = before > 4 ? before + 1 : before;
    el.setSelectionRange(newPos, newPos);
  }
};
