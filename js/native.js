/* ShowBoat — Native Bridge (Capacitor Plugins + Web Fallbacks) */
const Native = {
  /** True when running inside a Capacitor native shell */
  get isNative() {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  },
  get platform() {
    if (!this.isNative) return 'web';
    return Capacitor.getPlatform(); // 'ios' | 'android'
  },

  // ═══════════════════════ SPLASH SCREEN ═══════════════════════
  splash: {
    async hide() {
      if (!Native.isNative) return;
      const { SplashScreen } = Capacitor.Plugins;
      await SplashScreen.hide({ fadeOutDuration: 300 });
    },
    async show() {
      if (!Native.isNative) return;
      const { SplashScreen } = Capacitor.Plugins;
      await SplashScreen.show({ autoHide: true, fadeInDuration: 200, showDuration: 1500 });
    }
  },

  // ═══════════════════════ HAPTICS ═══════════════════════
  haptics: {
    async impact(style) {
      if (!Native.isNative) return;
      const { Haptics } = Capacitor.Plugins;
      await Haptics.impact({ style: style || 'Medium' });
    },
    async notification(type) {
      if (!Native.isNative) return;
      const { Haptics } = Capacitor.Plugins;
      await Haptics.notification({ type: type || 'Success' });
    },
    async vibrate() {
      if (!Native.isNative) return;
      const { Haptics } = Capacitor.Plugins;
      await Haptics.vibrate({ duration: 50 });
    },
    async selectionStart() {
      if (!Native.isNative) return;
      const { Haptics } = Capacitor.Plugins;
      await Haptics.selectionStart();
    },
    async selectionChanged() {
      if (!Native.isNative) return;
      const { Haptics } = Capacitor.Plugins;
      await Haptics.selectionChanged();
    },
    async selectionEnd() {
      if (!Native.isNative) return;
      const { Haptics } = Capacitor.Plugins;
      await Haptics.selectionEnd();
    }
  },

  // ═══════════════════════ SHARE ═══════════════════════
  share: {
    async share({ title, text, url, dialogTitle }) {
      if (Native.isNative) {
        const { Share } = Capacitor.Plugins;
        return Share.share({ title, text, url, dialogTitle: dialogTitle || 'Share via' });
      }
      // Web fallback
      if (navigator.share) {
        return navigator.share({ title, text, url });
      }
      // Clipboard fallback
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url || text);
        if (typeof Components !== 'undefined') Components.showToast('Link copied to clipboard!', 'success');
      }
    }
  },

  // ═══════════════════════ PUSH NOTIFICATIONS ═══════════════════════
  push: {
    _listeners: [],

    async register() {
      if (!Native.isNative) return { receive: 'denied' };
      const { PushNotifications } = Capacitor.Plugins;
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') {
        await PushNotifications.register();
      }
      return perm;
    },

    onRegistration(callback) {
      if (!Native.isNative) return;
      const { PushNotifications } = Capacitor.Plugins;
      const h = PushNotifications.addListener('registration', callback);
      this._listeners.push(h);
    },

    onNotification(callback) {
      if (!Native.isNative) return;
      const { PushNotifications } = Capacitor.Plugins;
      const h = PushNotifications.addListener('pushNotificationReceived', callback);
      this._listeners.push(h);
    },

    onAction(callback) {
      if (!Native.isNative) return;
      const { PushNotifications } = Capacitor.Plugins;
      const h = PushNotifications.addListener('pushNotificationActionPerformed', callback);
      this._listeners.push(h);
    },

    removeAll() {
      this._listeners.forEach(h => h.remove());
      this._listeners = [];
    }
  },

  // ═══════════════════════ STATUS BAR ═══════════════════════
  statusBar: {
    async setDark() {
      if (!Native.isNative) return;
      const { StatusBar } = Capacitor.Plugins;
      await StatusBar.setStyle({ style: 'LIGHT' }); // light icons on dark bg
      if (Native.platform === 'ios') {
        await StatusBar.setOverlaysWebView({ overlay: true });
      } else {
        await StatusBar.setBackgroundColor({ color: '#0f172a' });
      }
    },
    async hide() {
      if (!Native.isNative) return;
      const { StatusBar } = Capacitor.Plugins;
      await StatusBar.hide();
    },
    async show() {
      if (!Native.isNative) return;
      const { StatusBar } = Capacitor.Plugins;
      await StatusBar.show();
    }
  },

  // ═══════════════════════ KEYBOARD ═══════════════════════
  keyboard: {
    onShow(callback) {
      if (!Native.isNative) return;
      const { Keyboard } = Capacitor.Plugins;
      Keyboard.addListener('keyboardWillShow', callback);
    },
    onHide(callback) {
      if (!Native.isNative) return;
      const { Keyboard } = Capacitor.Plugins;
      Keyboard.addListener('keyboardWillHide', callback);
    },
    async hide() {
      if (!Native.isNative) return;
      const { Keyboard } = Capacitor.Plugins;
      await Keyboard.hide();
    }
  },

  // ═══════════════════════ PREFERENCES (for widget data) ═══════════════════════
  prefs: {
    async set(key, value) {
      if (Native.isNative) {
        const { Preferences } = Capacitor.Plugins;
        await Preferences.set({ key, value: JSON.stringify(value) });
      } else {
        localStorage.setItem('sb_' + key, JSON.stringify(value));
      }
    },
    async get(key) {
      if (Native.isNative) {
        const { Preferences } = Capacitor.Plugins;
        const { value } = await Preferences.get({ key });
        return value ? JSON.parse(value) : null;
      }
      const v = localStorage.getItem('sb_' + key);
      return v ? JSON.parse(v) : null;
    },
    async remove(key) {
      if (Native.isNative) {
        const { Preferences } = Capacitor.Plugins;
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem('sb_' + key);
      }
    }
  },

  // ═══════════════════════ WIDGET DATA SYNC ═══════════════════════
  // Writes user stats to shared preferences so native widgets can read them
  async syncWidgetData() {
    try {
      const uid = Services._uid();
      if (!uid) return;

      const stats = await Services.getUserStats();
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};

      // Get up next / currently watching
      const watchlist = await Services.getWatchlist();
      const upNext = watchlist.slice(0, 5).map(w => ({
        name: w.name,
        poster: w.posterPath ? `https://image.tmdb.org/t/p/w200${w.posterPath}` : null,
        type: w.mediaType
      }));

      // Get recent ratings
      let recentRatings = [];
      try {
        const rSnap = await db.collection('users').doc(uid)
          .collection('ratings').orderBy('ratedAt', 'desc').limit(5).get();
        recentRatings = rSnap.docs.map(d => {
          const r = d.data();
          return { name: r.showName || r.movieName || '', score: r.score, type: r.mediaType };
        });
      } catch (_) {}

      const widgetData = {
        updatedAt: Date.now(),
        displayName: userData.displayName || 'ShowBoat User',
        avatar: userData.photoURL || null,
        stats: {
          episodes: stats.episodes,
          movies: stats.movies,
          shows: stats.completed,
          ratings: stats.ratings,
          watchlist: stats.watchlist,
          friends: stats.friends
        },
        upNext,
        recentRatings,
        streak: userData.streak || 0
      };

      await this.prefs.set('widget_data', widgetData);
      return widgetData;
    } catch (e) {
      console.warn('Widget data sync failed:', e);
    }
  },

  // ═══════════════════════ INIT ═══════════════════════
  async init() {
    if (!this.isNative) return;
    console.log(`[Native] Platform: ${this.platform}`);

    // Add native class to html element for CSS targeting
    document.documentElement.classList.add('native-app');

    // Set status bar
    this.statusBar.setDark();

    // Hide splash once app is ready
    this.splash.hide();

    // Register push notifications
    this.push.register();
    this.push.onRegistration(async token => {
      console.log('[Push] Token:', token.value);
      try {
        const uid = auth.currentUser?.uid;
        if (uid && token.value) {
          await db.collection('users').doc(uid).update({
            fcmTokens: firebase.firestore.FieldValue.arrayUnion(token.value)
          });
        }
      } catch (e) { console.warn('Failed to save FCM token:', e); }
    });
    this.push.onNotification(notification => {
      console.log('[Push] Received:', notification);
      if (typeof Components !== 'undefined') {
        Components.showToast(notification.body || 'New notification', 'info');
      }
    });
    this.push.onAction(action => {
      console.log('[Push] Action:', action);
      const data = action.notification?.data;
      if (data?.page) App.navigate(data.page, data.params);
    });

    // Keyboard adjustments
    this.keyboard.onShow(info => {
      document.body.style.setProperty('--keyboard-height', info.keyboardHeight + 'px');
      document.body.classList.add('keyboard-open');
    });
    this.keyboard.onHide(() => {
      document.body.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-open');
    });

    // Sync widget data periodically (every 15 min when app is active)
    this._widgetInterval = setInterval(() => this.syncWidgetData(), 15 * 60 * 1000);

    // Setup native auth listeners (iOS)
    if (this.platform === 'ios') this.nativeAuth.setupListeners();
  },

  // ═══════════════════════ NATIVE AUTH (iOS) ═══════════════════════
  nativeAuth: {
    _listening: false,

    setupListeners() {
      if (this._listening || !Native.isNative) return;
      this._listening = true;
      const { NativeAuth } = Capacitor.Plugins;

      NativeAuth.addListener('authCredential', async (data) => {
        try {
          if (data.method === 'apple') {
            const provider = new firebase.auth.OAuthProvider('apple.com');
            const credential = provider.credential({ idToken: data.idToken, rawNonce: data.nonce });
            await auth.signInWithCredential(credential);
            if (data.fullName && auth.currentUser && !auth.currentUser.displayName) {
              await auth.currentUser.updateProfile({ displayName: data.fullName });
            }
          } else if (data.method === 'google') {
            const credential = firebase.auth.GoogleAuthProvider.credential(data.idToken);
            await auth.signInWithCredential(credential);
          } else if (data.method === 'email' || data.method === 'biometric') {
            await auth.signInWithEmailAndPassword(data.email, data.password);
            if (data.method === 'email') {
              NativeAuth.saveBiometric({ email: data.email, password: data.password }).catch(() => {});
            }
          }
          // Dismiss handled by onAuthStateChanged
        } catch (err) {
          console.error('[NativeAuth] Error:', err);
          NativeAuth.showError({ message: err.message || 'Sign in failed' });
        }
      });

      NativeAuth.addListener('authNavigate', (data) => {
        NativeAuth.dismissLogin();
        if (data.page) App.navigate(data.page);
      });
    },

    async showLogin() {
      if (!Native.isNative || Native.platform !== 'ios') return;
      const { NativeAuth } = Capacitor.Plugins;
      await NativeAuth.showLogin();
    },

    async dismissLogin() {
      if (!Native.isNative || Native.platform !== 'ios') return;
      try { await Capacitor.Plugins.NativeAuth.dismissLogin(); } catch (_) {}
    },

    async linkApple() {
      const { NativeAuth } = Capacitor.Plugins;
      const result = await NativeAuth.signInWithApple();
      const provider = new firebase.auth.OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: result.idToken, rawNonce: result.nonce });
      await auth.currentUser.linkWithCredential(credential);
      return result;
    },

    async linkGoogle() {
      const { NativeAuth } = Capacitor.Plugins;
      const result = await NativeAuth.signInWithGoogle();
      const credential = firebase.auth.GoogleAuthProvider.credential(result.idToken);
      await auth.currentUser.linkWithCredential(credential);
      return result;
    }
  }
};
