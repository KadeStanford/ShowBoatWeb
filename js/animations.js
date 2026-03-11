/* ShowBoat — Animations Utility
   Uses native Web Animations API + IntersectionObserver for reliable sitewide animations.
   No external library required. */

const Animate = {
  // Default easing curves
  ease: 'cubic-bezier(.4, 0, .2, 1)',
  easeOut: 'cubic-bezier(0, 0, .2, 1)',
  easeIn: 'cubic-bezier(.4, 0, 1, 1)',
  spring: 'cubic-bezier(.175, .885, .32, 1.275)',

  // Track active observer
  _observer: null,

  /** Animate a page container on navigation */
  pageIn(el) {
    if (!el) return;
    el.animate([
      { opacity: 0, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 300, easing: this.ease, fill: 'forwards' });
  },

  /** Stagger-animate children of a container (e.g. grid cards, list items) */
  staggerIn(container, selector, opts = {}) {
    if (!container) return;
    const items = container.querySelectorAll(selector);
    if (!items.length) return;
    const { duration = 350, stagger = 40, distance = 16, scale = false, direction = 'up' } = opts;
    const transforms = {
      up: `translateY(${distance}px)`,
      down: `translateY(-${distance}px)`,
      left: `translateX(${distance}px)`,
      right: `translateX(-${distance}px)`
    };
    const fromTransform = (scale ? 'scale(.96) ' : '') + (transforms[direction] || transforms.up);
    items.forEach((item, i) => {
      item.animate([
        { opacity: 0, transform: fromTransform },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { duration, delay: i * stagger, easing: this.ease, fill: 'forwards' });
    });
  },

  /** Fade + scale in a single element */
  fadeIn(el, opts = {}) {
    if (!el) return;
    const { duration = 300, delay = 0 } = opts;
    return el.animate([
      { opacity: 0, transform: 'scale(.96) translateY(6px)' },
      { opacity: 1, transform: 'scale(1) translateY(0)' }
    ], { duration, delay, easing: this.ease, fill: 'forwards' });
  },

  /** Slide in from right */
  slideIn(el, opts = {}) {
    if (!el) return;
    const { duration = 350, delay = 0 } = opts;
    return el.animate([
      { opacity: 0, transform: 'translateX(24px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration, delay, easing: this.ease, fill: 'forwards' });
  },

  /** Pop in (scale bounce) */
  popIn(el, opts = {}) {
    if (!el) return;
    const { duration = 400, delay = 0 } = opts;
    return el.animate([
      { opacity: 0, transform: 'scale(.7)' },
      { opacity: 1, transform: 'scale(1.05)' },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration, delay, easing: this.spring, fill: 'forwards' });
  },

  /** Animate out (for page transitions, modals, etc.) */
  fadeOut(el, opts = {}) {
    if (!el) return Promise.resolve();
    const { duration = 200 } = opts;
    const anim = el.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-8px)' }
    ], { duration, easing: this.easeIn, fill: 'forwards' });
    return anim.finished;
  },

  /** Setup IntersectionObserver for scroll-based reveal animations.
   *  Call once after page content is loaded. Elements with
   *  data-animate="fade|slide|pop|stagger" will animate when scrolled into view. */
  observeScrollReveal(root) {
    this.disconnectObserver();
    const targets = (root || document).querySelectorAll('[data-animate]');
    if (!targets.length) return;

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const type = el.dataset.animate;
        this._observer.unobserve(el);

        if (type === 'fade') this.fadeIn(el);
        else if (type === 'slide') this.slideIn(el);
        else if (type === 'pop') this.popIn(el);
        else if (type === 'stagger') this.staggerIn(el, ':scope > *');
        else this.fadeIn(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(t => {
      t.style.opacity = '0';
      this._observer.observe(t);
    });
  },

  disconnectObserver() {
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
  },

  /** Animate all standard ShowBoat page elements after render.
   *  Called automatically from App.navigate after page render completes. */
  afterPageRender() {
    const content = document.getElementById('page-content');
    if (!content) return;

    requestAnimationFrame(() => {
      // Page container
      const page = content.querySelector('[class$="-page"]');
      if (page) this.pageIn(page);

      // Grid cards
      const grid = content.querySelector('.media-grid');
      if (grid) this.staggerIn(grid, '.media-card', { stagger: 35, scale: true });

      // List items
      const lists = content.querySelectorAll('.watchlist-items, .friend-items, .activity-items, .shame-items, .history-items, .list-items, .cast-list, .search-result-items');
      lists.forEach(list => this.staggerIn(list, ':scope > *', { stagger: 30 }));

      // Horizontal scroll sections
      const hScroll = content.querySelectorAll('.horizontal-scroll');
      hScroll.forEach(hs => this.staggerIn(hs, ':scope > *', { direction: 'left', stagger: 50 }));

      // Stats cards
      const stats = content.querySelector('.stats-grid');
      if (stats) this.staggerIn(stats, ':scope > *', { scale: true, stagger: 60 });

      // Badges grid
      const badges = content.querySelector('.badges-grid');
      if (badges) this.staggerIn(badges, ':scope > *', { scale: true, stagger: 40 });

      // Menu grid
      const menu = content.querySelector('.menu-grid');
      if (menu) this.staggerIn(menu, ':scope > *', { scale: true, stagger: 45 });

      // Details page sections
      const detailsTop = content.querySelector('.details-top');
      if (detailsTop) this.fadeIn(detailsTop, { duration: 400, delay: 80 });
      const detailsGrid = content.querySelector('.details-content-grid');
      if (detailsGrid) this.fadeIn(detailsGrid, { duration: 400, delay: 160 });

      // Episode list
      const episodes = content.querySelector('.episode-list');
      if (episodes) this.staggerIn(episodes, ':scope > *', { stagger: 25 });

      // Scroll-reveal elements
      this.observeScrollReveal(content);
    });
  }
};
