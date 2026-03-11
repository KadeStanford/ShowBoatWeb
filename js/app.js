/* ShowBoat — App Router & State Management */
const App = {
  currentPage: null,
  currentParams: null,
  history: [],
  user: null,

  routes: {
    'landing':            { render: () => AuthPages.renderLanding(), auth: false, nav: false },
    'login':              { render: () => AuthPages.renderLogin(), auth: false, nav: false },
    'signup':             { render: () => AuthPages.renderSignup(), auth: false, nav: false },
    'home':               { render: (p) => HomePage.render(p), auth: true, nav: true, navIdx: 0 },
    'discover':           { render: (p) => DiscoverPage.render(p), auth: true, nav: true, navIdx: 1 },
    'watchlist':          { render: () => WatchlistPage.render(), auth: true, nav: true, navIdx: 2 },
    'friends':            { render: () => FriendsPage.render(), auth: true, nav: true, navIdx: 3 },
    'profile':            { render: () => ProfilePage.render(), auth: true, nav: true, navIdx: 4 },
    'settings':           { render: () => SettingsPage.render(), auth: true, nav: true },
    'details':            { render: (p) => DetailsPage.render(p), auth: true, nav: true },
    'activity':           { render: () => ActivityPage.render(), auth: true, nav: true },
    'wall-of-shame':      { render: () => WallOfShamePage.render(), auth: true, nav: true },
    'friend-profile':     { render: (p) => FriendProfilePage.render(p), auth: true, nav: true },
    'matcher-setup':      { render: () => MatcherSetupPage.render(), auth: true, nav: true },
    'matcher-swipe':      { render: (p) => MatcherSwipePage.render(p), auth: true, nav: false },
    'matcher-results':    { render: (p) => MatcherResultsPage.render(p), auth: true, nav: true },
    'matcher-history':    { render: () => MatcherHistoryPage.render(), auth: true, nav: true },
    'analytics':          { render: () => AnalyticsPage.render(), auth: true, nav: true },
    'badges':             { render: () => BadgesPage.render(), auth: true, nav: true },
    'plex-connect':       { render: () => PlexConnectPage.render(), auth: true, nav: true },
    'plex-watched':       { render: () => PlexWatchedPage.render(), auth: true, nav: true },
    'plex-now-playing':   { render: () => PlexNowPlayingPage.render(), auth: true, nav: true },
    'shared-lists':       { render: () => SharedListsPage.render(), auth: true, nav: true },
    'shared-list-detail': { render: (p) => SharedListDetailPage.render(p), auth: true, nav: true },
    'actor-details':      { render: (p) => ActorDetailsPage.render(p), auth: true, nav: true },
    'cast-list':          { render: (p) => CastListPage.render(p), auth: true, nav: true },
    'shared-actors':      { render: (p) => SharedActorsPage.render(p), auth: true, nav: true },
    'youtube':            { render: (p) => YouTubePage.render(p), auth: true, nav: true },
    'friend-watched-all': { render: (p) => FriendWatchedAllPage.render(p), auth: true, nav: true },
    'watched-history':    { render: () => WatchedHistoryPage.render(), auth: true, nav: true },
    'friend-watchlist-all': { render: (p) => FriendWatchlistAllPage.render(p), auth: true, nav: true },
    'friend-analytics':   { render: (p) => FriendAnalyticsPage.render(p), auth: true, nav: true }
  },

  signupInProgress: false,

  init() {
    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        // If signup is still provisioning the account, skip background setup
        if (this.signupInProgress) return;
        this.showNav(true);
        // Restore Plex connection + library cache from Firestore (runs in background)
        Services.restorePlexOnLogin().catch(() => {});
        // Ensure Plex watch history is backported into activity collection
        Services.ensurePlexActivityBackfill().catch(() => {});
        // Check for newly earned badges and show unlock notifications
        setTimeout(() => checkAndNotifyNewBadges().catch(() => {}), 3000);
        // Auto-start guided tour for new users
        setTimeout(() => { if (typeof GuidedTour !== 'undefined' && GuidedTour.shouldAutoStart()) GuidedTour.start(); }, 1500);
        // If on auth page or no page, try to restore from URL hash first
        if (!this.currentPage || this.currentPage === 'login' || this.currentPage === 'signup' || this.currentPage === 'landing') {
          const hash = window.location.hash.slice(1);
          if (hash) {
            const [hashPage, queryStr] = hash.split('?');
            if (hashPage && this.routes[hashPage] && this.routes[hashPage].auth) {
              let params = {};
              if (queryStr) {
                const sp = new URLSearchParams(queryStr);
                for (const [k, v] of sp) params[k] = this.deserializeParam(v);
              }
              this.navigate(hashPage, Object.keys(params).length ? params : undefined);
            } else {
              this.navigate('home');
            }
          } else {
            this.navigate('home');
          }
        }
      } else {
        this.showNav(false);
        // Show landing page for unauthenticated visitors; if they were already on login/signup keep that
        const cur = this.currentPage;
        if (!cur || (cur !== 'login' && cur !== 'signup' && cur !== 'landing')) {
          this.navigate('landing');
        } else if (!cur) {
          this.navigate('landing');
        }
      }
      // Hide loading screen
      const loading = document.getElementById('loading-screen');
      if (loading) loading.style.display = 'none';
    });

    // Handle browser back/forward
    window.addEventListener('hashchange', () => this.onHashChange());

    // Setup nav buttons (bottom nav)
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) this.navigate(page);
      });
    });

    // Setup sidebar nav buttons (desktop)
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) this.navigate(page);
      });
    });
  },

  navigate(page, params, _isBack) {
    const route = this.routes[page];
    if (!route) { console.warn('Unknown route:', page); return; }

    // Auth guard
    if (route.auth && !this.user) { this.navigate('landing'); return; }
    if (!route.auth && this.user && (page === 'login' || page === 'signup' || page === 'landing')) { this.navigate('home'); return; }

    // Cleanup previous page
    if (this.currentPage === 'home') HomePage.destroy?.();
    if (this.currentPage === 'discover') {
      const grid = document.getElementById('discover-results');
      if (grid) DiscoverPage.state._savedGridHTML = grid.innerHTML;
    }

    // Track history (unless going back)
    if (!_isBack && this.currentPage) {
      if (this._rootPages.has(page)) {
        this.history = [];
      } else {
        this._pushHistory(this.currentPage, this.currentParams);
      }
    }

    this.currentPage = page;
    this.currentParams = params || null;

    // Update hash without triggering hashchange handler
    const hash = params ? `#${page}?${new URLSearchParams(this.serializeParams(params)).toString()}` : `#${page}`;
    if (window.location.hash !== hash) {
      window._skipHashChange = true;
      window.location.hash = hash;
    }

    // Show/hide nav
    this.showNav(route.nav);

    // Update active nav button
    if (route.navIdx !== undefined) {
      document.querySelectorAll('.nav-btn').forEach((btn, i) => btn.classList.toggle('active', i === route.navIdx));
    }
    // Update active sidebar button
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Render page — instant swap, let JS Animate handle entrance
    const el = document.getElementById('page-content');
    el.style.opacity = '0';
    const result = route.render(params);
    if (typeof result === 'string') el.innerHTML = result;
    requestAnimationFrame(() => { el.style.opacity = ''; });

    // Scroll to top
    el.scrollTop = 0;
    window.scrollTo(0, 0);

    // Trigger entrance animations
    if (typeof Animate !== 'undefined') {
      requestAnimationFrame(() => Animate.afterPageRender());
    }
  },

  // Root pages that clear navigation pileup — going to these always resets history
  _rootPages: new Set(['home', 'friends', 'discover', 'watchlist', 'profile', 'activity']),

  back() {
    if (this.history.length === 0) { this.navigate('home', undefined, true); return; }
    const entry = this.history.pop();
    if (!entry) { this.navigate('home', undefined, true); return; }
    const page = typeof entry === 'string' ? entry : entry.page;
    const params = typeof entry === 'string' ? undefined : entry.params;
    this.navigate(page, params, true);
  },

  _pushHistory(page, params) {
    if (!page) return;
    const entry = params ? { page, params } : { page };
    // Avoid consecutive duplicate entries
    const last = this.history[this.history.length - 1];
    const lastPage = last ? (typeof last === 'string' ? last : last.page) : null;
    if (lastPage === page) return;
    this.history.push(entry);
    if (this.history.length > 50) this.history.shift();
  },

  onHashChange() {
    if (window._skipHashChange) { window._skipHashChange = false; return; }
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const [page, queryStr] = hash.split('?');
    let params = {};
    if (queryStr) {
      const sp = new URLSearchParams(queryStr);
      for (const [k, v] of sp) params[k] = this.deserializeParam(v);
    }
    if (this.routes[page]) this.navigate(page, Object.keys(params).length ? params : undefined);
  },

  showNav(show) {
    const nav = document.getElementById('bottom-nav');
    const sidebar = document.getElementById('sidebar-nav');
    const isDesktop = window.innerWidth > 1023;
    if (nav) nav.style.display = (show && !isDesktop) ? 'flex' : 'none';
    if (sidebar) {
      if (show && isDesktop) {
        sidebar.classList.remove('hidden');
        sidebar.style.display = 'flex';
      } else {
        sidebar.classList.add('hidden');
        sidebar.style.display = '';
      }
    }
    document.getElementById('page-content')?.classList.toggle('has-nav', show);
  },

  serializeParams(params) {
    const result = {};
    for (const [k, v] of Object.entries(params)) {
      result[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return result;
  },

  deserializeParam(val) {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (/^\d+$/.test(val)) return parseInt(val);
    try { return JSON.parse(val); } catch (_) { return val; }
  }
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
