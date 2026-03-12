/* ShowBoat — Guided Tour */
const GuidedTour = {
  steps: [
    {
      target: '[data-page="home"]',
      title: 'Home',
      text: 'Your personalized feed with trending shows, recent activity, and what your friends are watching.',
      position: 'top'
    },
    {
      target: '[data-page="discover"]',
      title: 'Discover',
      text: 'Browse thousands of movies and TV shows. Filter by genre, sort by rating, and find your next binge.',
      position: 'top'
    },
    {
      target: '[data-page="watchlist"]',
      title: 'Watchlist',
      text: 'Save shows and movies you want to watch later. Never forget a recommendation again.',
      position: 'top'
    },
    {
      target: '[data-page="friends"]',
      title: 'Friends',
      text: 'Add friends, see what they\'re watching, compare taste, and get recommendations based on shared interests.',
      position: 'top'
    },
    {
      target: '[data-page="profile"]',
      title: 'Profile',
      text: 'View your stats, earn badges, connect Plex, manage shared lists, and access settings.',
      position: 'top'
    },
    {
      target: '.search-bar, .friends-search-bar, [id*="search"]',
      title: 'Search',
      text: 'Search for any movie, show, or person across the app.',
      position: 'bottom',
      page: 'discover'
    }
  ],

  _currentStep: 0,
  _overlay: null,
  _active: false,

  shouldAutoStart() {
    return !localStorage.getItem('showboat_tour_complete');
  },

  start() {
    if (this._active) return;
    this._active = true;
    this._currentStep = 0;
    this._createOverlay();
    this._showStep(0);
  },

  _createOverlay() {
    if (this._overlay) this._overlay.remove();
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.id = 'guided-tour-overlay';
    overlay.innerHTML = `
      <div class="tour-backdrop"></div>
      <div class="tour-spotlight" id="tour-spotlight"></div>
      <div class="tour-tooltip" id="tour-tooltip">
        <div class="tour-tooltip-title" id="tour-title"></div>
        <div class="tour-tooltip-text" id="tour-text"></div>
        <div class="tour-tooltip-footer">
          <span class="tour-step-counter" id="tour-counter"></span>
          <div class="tour-tooltip-btns">
            <button class="tour-skip-btn" onclick="GuidedTour.skip()">Skip</button>
            <button class="tour-prev-btn" id="tour-prev" onclick="GuidedTour.prev()">Back</button>
            <button class="tour-next-btn" id="tour-next" onclick="GuidedTour.next()">Next</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;
  },

  _showStep(idx) {
    if (idx < 0 || idx >= this.steps.length) { this.finish(); return; }
    this._currentStep = idx;
    const step = this.steps[idx];

    // On native mobile, open the dropdown so nav targets are visible
    const isNativeMobile = typeof Native !== 'undefined' && Native.isNative;
    let target;
    if (isNativeMobile && step.target.includes('data-page')) {
      const dropdown = document.getElementById('mobile-dropdown');
      const menuBtn = document.getElementById('mobile-menu-btn');
      if (dropdown && !dropdown.classList.contains('open')) {
        dropdown.classList.add('open');
        if (menuBtn) menuBtn.classList.add('open');
      }
      target = document.querySelector(`.mobile-dropdown-btn${step.target}`);
    } else {
      target = document.querySelector(step.target);
    }
    const spotlight = document.getElementById('tour-spotlight');
    const tooltip = document.getElementById('tour-tooltip');

    // Update text
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').textContent = step.text;
    document.getElementById('tour-counter').textContent = `${idx + 1} / ${this.steps.length}`;
    document.getElementById('tour-prev').style.display = idx === 0 ? 'none' : '';
    document.getElementById('tour-next').textContent = idx === this.steps.length - 1 ? 'Done' : 'Next';

    if (target) {
      const rect = target.getBoundingClientRect();
      const pad = 6;
      spotlight.style.display = 'block';
      spotlight.style.left = (rect.left - pad) + 'px';
      spotlight.style.top = (rect.top - pad) + 'px';
      spotlight.style.width = (rect.width + pad * 2) + 'px';
      spotlight.style.height = (rect.height + pad * 2) + 'px';

      // Position tooltip
      this._positionTooltip(tooltip, rect, step.position || 'bottom');
    } else {
      // No target found — show centered tooltip
      spotlight.style.display = 'none';
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
    }
  },

  _positionTooltip(tooltip, rect, position) {
    tooltip.style.transform = '';
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipWidth = Math.min(300, vw - 32);
    tooltip.style.width = tooltipWidth + 'px';

    // Measure tooltip height for clipping checks
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    const tH = tooltip.offsetHeight || 160;
    tooltip.style.visibility = '';

    // Auto-flip: if 'top' would clip above viewport, show below; if 'bottom' would clip below, show above
    let pos = position;
    if (pos === 'top' && rect.top - gap - tH < 8) pos = 'bottom';
    else if (pos === 'bottom' && rect.bottom + gap + tH > vh - 8) pos = 'top';

    // Also handle sidebar targets: if target is on the left side, position to the right of it
    const isSidebar = rect.right < 200;
    const isMobileDropdown = !!tooltip.closest('body')?.querySelector('.mobile-dropdown.open');
    if (isSidebar && !isMobileDropdown) {
      tooltip.style.left = (rect.right + gap) + 'px';
      tooltip.style.top = Math.max(16, Math.min(rect.top, vh - tH - 16)) + 'px';
      tooltip.style.transform = '';
      return;
    }

    const leftPos = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - 16));
    tooltip.style.left = leftPos + 'px';

    if (pos === 'top') {
      tooltip.style.top = (rect.top - gap - tH) + 'px';
      tooltip.style.transform = '';
    } else {
      tooltip.style.top = (rect.bottom + gap) + 'px';
      tooltip.style.transform = '';
    }
  },

  next() {
    if (this._currentStep >= this.steps.length - 1) { this.finish(); return; }
    this._showStep(this._currentStep + 1);
  },

  prev() {
    if (this._currentStep > 0) this._showStep(this._currentStep - 1);
  },

  skip() {
    this.finish();
  },

  finish() {
    this._active = false;
    localStorage.setItem('showboat_tour_complete', '1');
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    // Close mobile dropdown if it was opened by tour
    const dropdown = document.getElementById('mobile-dropdown');
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (dropdown) dropdown.classList.remove('open');
    if (menuBtn) menuBtn.classList.remove('open');
  }
};
