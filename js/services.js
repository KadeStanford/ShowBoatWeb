/* ShowBoat — Firestore Services */
const Services = {
  _user() { return auth.currentUser; },
  _uid() { return this._user()?.uid; },

  // ==================== WATCHLIST ====================
  async getWatchlist() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('watchlist').orderBy('addedAt', 'desc').get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  },

  async isInWatchlist(tmdbId) {
    const uid = this._uid(); if (!uid) return false;
    const snap = await db.collection('users').doc(uid).collection('watchlist').where('id', '==', Number(tmdbId)).get();
    return !snap.empty;
  },

  async addToWatchlist(item) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(uid).collection('watchlist').add({
      id: item.id, name: item.name, posterPath: item.posterPath || null,
      mediaType: item.mediaType || 'tv', addedAt: Date.now(),
      backdropPath: item.backdropPath || null, overview: item.overview || ''
    });
    this._logActivity('added_to_watchlist', item);
  },

  async removeFromWatchlist(tmdbId) {
    const uid = this._uid(); if (!uid) return;
    const snap = await db.collection('users').doc(uid).collection('watchlist').where('id', '==', Number(tmdbId)).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  async toggleWatchlist(item) {
    const inList = await this.isInWatchlist(item.id);
    if (inList) { await this.removeFromWatchlist(item.id); return false; }
    else { await this.addToWatchlist(item); return true; }
  },

  // ==================== WATCHED ====================
  async getWatched() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('watched').orderBy('watchedAt', 'desc').get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  },

  async isWatched(tmdbId, mediaType, season, episode) {
    const uid = this._uid(); if (!uid) return false;
    const ref = db.collection('users').doc(uid).collection('watched');
    if (mediaType === 'movie') {
      const snap = await ref.where('tmdbId', '==', Number(tmdbId)).where('mediaType', '==', 'movie').get();
      return !snap.empty;
    }
    if (season != null && episode != null) {
      const docId = `tv:${tmdbId}:s${season}:e${episode}`;
      const doc = await ref.doc(docId).get();
      return doc.exists;
    }
    const snap = await ref.where('tmdbId', '==', Number(tmdbId)).get();
    return !snap.empty;
  },

  async markWatched(tmdbId, mediaType, season, episode, meta = {}) {
    const uid = this._uid(); if (!uid) return;
    const ref = db.collection('users').doc(uid).collection('watched');
    const docId = mediaType === 'movie' ? `movie:${tmdbId}` :
      (season != null && episode != null) ? `tv:${tmdbId}:s${season}:e${episode}` : `tv:${tmdbId}`;
    await ref.doc(docId).set({
      tmdbId: Number(tmdbId), mediaType, watchedAt: Date.now(),
      ...(season != null && { seasonNumber: season }),
      ...(episode != null && { episodeNumber: episode }),
      name: meta.title || meta.name || '', posterPath: meta.posterPath || null,
      backdropPath: meta.backdropPath || null, overview: meta.overview || ''
    }, { merge: true });
    this._logActivity('watched', { id: tmdbId, name: meta.title || meta.name, mediaType, posterPath: meta.posterPath });
    // Remove active shames for this media
    await this._resolveShames(tmdbId, mediaType);
  },

  async markUnwatched(tmdbId, mediaType, season, episode) {
    const uid = this._uid(); if (!uid) return;
    const ref = db.collection('users').doc(uid).collection('watched');
    const docId = mediaType === 'movie' ? `movie:${tmdbId}` :
      (season != null && episode != null) ? `tv:${tmdbId}:s${season}:e${episode}` : `tv:${tmdbId}`;
    await ref.doc(docId).delete();
  },

  // ==================== RATINGS ====================
  async getRatings() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('ratings').get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  },

  async getRating(tmdbId) {
    const uid = this._uid(); if (!uid) return null;
    const doc = await db.collection('users').doc(uid).collection('ratings').doc(String(tmdbId)).get();
    return doc.exists ? doc.data() : null;
  },

  async rateMedia(tmdbId, rating, meta = {}) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(uid).collection('ratings').doc(String(tmdbId)).set({
      tmdbId: Number(tmdbId), rating, ratedAt: Date.now(),
      name: meta.name || '', posterPath: meta.posterPath || null,
      mediaType: meta.mediaType || 'tv'
    }, { merge: true });
    this._logActivity('rated', { id: tmdbId, name: meta.name, mediaType: meta.mediaType, posterPath: meta.posterPath, rating });
  },

  // ==================== FRIENDS ====================
  async getFriends() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('friends').get();
    return snap.docs.map(d => ({ docId: d.id, uid: d.id, ...d.data() }));
  },

  async searchUsers(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const snap = await db.collection('users')
      .where('username_lowercase', '>=', q)
      .where('username_lowercase', '<=', q + '\uf8ff')
      .limit(20).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== this._uid());
  },

  async addFriend(friendUid, friendData) {
    const uid = this._uid(); if (!uid) return;
    const batch = db.batch();
    const me = this._user();
    batch.set(db.collection('users').doc(uid).collection('friends').doc(friendUid), {
      username: friendData.username || '', photoURL: friendData.photoURL || null,
      addedAt: Date.now()
    });
    batch.set(db.collection('users').doc(friendUid).collection('friends').doc(uid), {
      username: me.displayName || '', photoURL: me.photoURL || null,
      addedAt: Date.now()
    });
    await batch.commit();
  },

  async removeFriend(friendUid) {
    const uid = this._uid(); if (!uid) return;
    const batch = db.batch();
    batch.delete(db.collection('users').doc(uid).collection('friends').doc(friendUid));
    batch.delete(db.collection('users').doc(friendUid).collection('friends').doc(uid));
    await batch.commit();
  },

  async isFriend(friendUid) {
    const uid = this._uid(); if (!uid) return false;
    const doc = await db.collection('users').doc(uid).collection('friends').doc(friendUid).get();
    return doc.exists;
  },

  // ==================== SHAME ====================
  async getActiveShames() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('shames')
      .where('status', '==', 'active').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSentShames() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('shames').where('shamerUid', '==', uid).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async shameFriend(friendUid, friendName, friendPhoto, media) {
    const uid = this._uid(); if (!uid) return;
    const me = this._user();
    const shameData = {
      shamerUid: uid, shamerName: me.displayName || '',
      shamedUid: friendUid, shamedName: friendName, shamedPhotoURL: friendPhoto || null,
      mediaId: media.id, mediaTitle: media.name, mediaType: media.mediaType || 'tv',
      mediaPosterPath: media.posterPath || null,
      status: 'active', createdAt: Date.now()
    };
    // Add to global shames collection
    const ref = await db.collection('shames').add(shameData);
    // Add to shamed user's subcollection
    await db.collection('users').doc(friendUid).collection('shames').doc(ref.id).set(shameData);
  },

  async _resolveShames(tmdbId, mediaType) {
    const uid = this._uid(); if (!uid) return;
    const snap = await db.collection('users').doc(uid).collection('shames')
      .where('mediaId', '==', Number(tmdbId)).where('status', '==', 'active').get();
    const batch = db.batch();
    snap.docs.forEach(d => {
      batch.update(d.ref, { status: 'resolved', resolvedAt: Date.now() });
      batch.update(db.collection('shames').doc(d.id), { status: 'resolved', resolvedAt: Date.now() });
    });
    if (!snap.empty) await batch.commit();
  },

  // ==================== SHARED LISTS ====================
  async getSharedLists() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('sharedLists').where('members', 'array-contains', uid).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async createSharedList(name, friendUids = []) {
    const uid = this._uid(); if (!uid) return;
    const members = [uid, ...friendUids];
    return db.collection('sharedLists').add({
      name, members, createdBy: uid, createdAt: Date.now(), items: []
    });
  },

  async getSharedListDetail(listId) {
    const doc = await db.collection('sharedLists').doc(listId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async addToSharedList(listId, item) {
    const listRef = db.collection('sharedLists').doc(listId);
    await listRef.update({
      items: firebase.firestore.FieldValue.arrayUnion({
        id: item.id, name: item.name, posterPath: item.posterPath || null,
        mediaType: item.mediaType || 'tv', addedBy: this._uid(), addedAt: Date.now()
      })
    });
  },

  async removeFromSharedList(listId, itemId) {
    const list = await this.getSharedListDetail(listId);
    if (!list) return;
    const updated = (list.items || []).filter(i => i.id !== itemId);
    await db.collection('sharedLists').doc(listId).update({ items: updated });
  },

  // ==================== RECOMMENDATIONS ====================
  async sendRecommendation(friendUid, media, message = '') {
    const uid = this._uid(); if (!uid) return;
    const me = this._user();
    await db.collection('users').doc(friendUid).collection('recommendations').add({
      fromUid: uid, fromName: me.displayName || '', fromPhoto: me.photoURL || null,
      mediaId: media.id, mediaTitle: media.name, mediaType: media.mediaType || 'tv',
      mediaPosterPath: media.posterPath || null, message, createdAt: Date.now(), read: false
    });
  },

  async getRecommendations() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('recommendations').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // ==================== MATCHER ====================
  async createMatcherSession(friendUid, mediaType, items) {
    const uid = this._uid(); if (!uid) return null;
    const ref = await db.collection('matcherSessions').add({
      createdBy: uid, participants: [uid, friendUid],
      mediaType, items: items.map(i => ({ id: i.id, name: i.name, posterPath: i.posterPath, overview: i.overview, mediaType: i.mediaType })),
      votes: {}, status: 'active', createdAt: Date.now()
    });
    return ref.id;
  },

  async submitMatcherVote(sessionId, votes) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('matcherSessions').doc(sessionId).update({
      [`votes.${uid}`]: votes
    });
  },

  async getMatcherSession(sessionId) {
    const doc = await db.collection('matcherSessions').doc(sessionId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getMatcherHistory() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('matcherSessions')
      .where('participants', 'array-contains', uid).orderBy('createdAt', 'desc').limit(20).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // ==================== ACTIVITY FEED ====================
  async _logActivity(type, media) {
    const uid = this._uid(); if (!uid) return;
    const me = this._user();
    await db.collection('users').doc(uid).collection('activity').add({
      type, mediaId: media.id, mediaTitle: media.name || media.title,
      mediaType: media.mediaType || 'tv', mediaPosterPath: media.posterPath || null,
      userId: uid, userName: me.displayName || '', userPhoto: me.photoURL || null,
      createdAt: Date.now(), ...(media.rating != null && { rating: media.rating })
    });
  },

  async getActivityFeed(friendUids = []) {
    if (friendUids.length === 0) return [];
    const activities = [];
    // Fetch recent activity from each friend (Firestore doesn't support OR across subcollections easily)
    await Promise.all(friendUids.map(async uid => {
      try {
        const snap = await db.collection('users').doc(uid).collection('activity')
          .orderBy('createdAt', 'desc').limit(10).get();
        snap.docs.forEach(d => activities.push({ id: d.id, ...d.data() }));
      } catch (e) { /* skip */ }
    }));
    activities.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return activities.slice(0, 50);
  },

  // ==================== USER PROFILE ====================
  async getUserProfile(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { uid: doc.id, ...doc.data() } : null;
  },

  async updateProfile(data) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(uid).update(data);
  },

  async getUserStats(uid) {
    const targetUid = uid || this._uid();
    if (!targetUid) return { watched: 0, watchlist: 0, ratings: 0, friends: 0 };
    const [watched, watchlist, ratings, friends] = await Promise.all([
      db.collection('users').doc(targetUid).collection('watched').get(),
      db.collection('users').doc(targetUid).collection('watchlist').get(),
      db.collection('users').doc(targetUid).collection('ratings').get(),
      db.collection('users').doc(targetUid).collection('friends').get()
    ]);
    return {
      watched: watched.size, watchlist: watchlist.size,
      ratings: ratings.size, friends: friends.size
    };
  },

  // ==================== PLEX STATE ====================
  plex: {
    get serverUrl() { return localStorage.getItem('plex_server_url'); },
    get token() { return localStorage.getItem('plex_token'); },
    get isConnected() { return !!(this.serverUrl && this.token); },
    connect(url, token) {
      localStorage.setItem('plex_server_url', url);
      localStorage.setItem('plex_token', token);
    },
    disconnect() {
      localStorage.removeItem('plex_server_url');
      localStorage.removeItem('plex_token');
      localStorage.removeItem('plex_library');
    },
    getLibrary() {
      try { return JSON.parse(localStorage.getItem('plex_library') || '[]'); } catch { return []; }
    },
    setLibrary(lib) { localStorage.setItem('plex_library', JSON.stringify(lib)); }
  }
};
