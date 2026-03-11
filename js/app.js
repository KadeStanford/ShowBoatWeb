/* ShowBoat — App Router & State Management */
const App = {
  currentPage: null,
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
    'youtube':            { render: (p) => YouTubePage.render(p), auth: true, nav: true }
  },

  init() {
    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        this.showNav(true);
        // Restore Plex connection + library cache from Firestore (runs in background)
        Services.restorePlexOnLogin().catch(() => {});
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

  navigate(page, params) {
    if (this.currentPage === page && !params) return;

    const route = this.routes[page];
    if (!route) { console.warn('Unknown route:', page); return; }

    // Auth guard
    if (route.auth && !this.user) { this.navigate('landing'); return; }
    if (!route.auth && this.user && (page === 'login' || page === 'signup' || page === 'landing')) { this.navigate('home'); return; }

    // Cleanup previous page
    if (this.currentPage === 'home') HomePage.destroy?.();

    // Track history
    if (this.currentPage && this.currentPage !== page) {
      this.history.push(this.currentPage);
      if (this.history.length > 50) this.history.shift();
    }

    this.currentPage = page;

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
    const sidebarPages = ['home', 'discover', 'watchlist', 'friends', 'activity', 'shared-lists', 'matcher-setup', 'analytics', 'profile'];
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Render page with transition
    const el = document.getElementById('page-content');
    el.classList.add('page-exit');
    setTimeout(() => {
      el.classList.remove('page-exit');
      el.classList.add('page-enter');
      const result = route.render(params);
      if (typeof result === 'string') el.innerHTML = result;
      setTimeout(() => el.classList.remove('page-enter'), 300);
    }, 120);

    // Scroll to top
    el.scrollTop = 0;
    window.scrollTo(0, 0);

    // Trigger entrance animations — 200ms fallback for sync pages (auth)
    // Async pages call Animate.afterPageRender() themselves after drawing
    if (typeof Animate !== 'undefined') {
      setTimeout(() => Animate.afterPageRender(), 200);
    }
  },

  back() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      this.navigate(prev);
      // Remove the extra history entry added by navigate
      this.history.pop();
    } else {
      this.navigate('home');
    }
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
