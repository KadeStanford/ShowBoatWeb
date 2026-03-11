/* ShowBoat — App Router & State Management */
const App = {
  currentPage: null,
  history: [],
  user: null,

  routes: {
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
        // If on auth page or no page, go home
        if (!this.currentPage || this.currentPage === 'login' || this.currentPage === 'signup') {
          this.navigate('home');
        }
      } else {
        this.showNav(false);
        this.navigate('login');
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
    if (route.auth && !this.user) { this.navigate('login'); return; }
    if (!route.auth && this.user && (page === 'login' || page === 'signup')) { this.navigate('home'); return; }

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

    // Render page
    const el = document.getElementById('page-content');
    const result = route.render(params);
    // If render returns HTML string (sync pages like auth)
    if (typeof result === 'string') el.innerHTML = result;
    // Async renders handle el.innerHTML themselves

    // Scroll to top
    el.scrollTop = 0;
    window.scrollTo(0, 0);

    // Trigger entrance animations
    if (typeof Animate !== 'undefined') {
      // Small delay to let async renders populate the DOM
      setTimeout(() => Animate.afterPageRender(), 50);
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
