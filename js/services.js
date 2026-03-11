/* ShowBoat — Firestore Services */
const Services = {
  _user() { return auth.currentUser; },
  _uid() { return this._user()?.uid; },

  // ==================== WATCHLIST ====================
  async getWatchlist(userId) {
    const uid = userId || this._uid(); if (!uid) return [];
    try {
      const snap = await db.collection('users').doc(uid).collection('watchlist').orderBy('addedAt', 'desc').get();
      if (snap.docs.length) return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    } catch (_) {}
    // Fallback: fetch without ordering (handles missing addedAt or missing index)
    const snap = await db.collection('users').doc(uid).collection('watchlist').get();
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
  async getWatched(userId) {
    const uid = userId || this._uid(); if (!uid) return [];
    try {
      const snap = await db.collection('users').doc(uid).collection('watched').orderBy('watchedAt', 'desc').get();
      if (snap.docs.length) return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    } catch (_) {}
    const snap = await db.collection('users').doc(uid).collection('watched').get();
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
    const actType = (season != null && episode != null) ? 'watched_episode' : 'watched';
    this._logActivity(actType, {
      id: tmdbId, name: meta.title || meta.name, mediaType, posterPath: meta.posterPath,
      ...(season != null && { seasonNumber: season }),
      ...(episode != null && { episodeNumber: episode }),
      episodeName: meta.episodeName || ''
    });
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

  // Batch-mark all episodes in a series as watched (uses episode_count per season, no extra API calls)
  async markAllEpisodesWatched(tmdbId, meta, seasons) {
    const uid = this._uid(); if (!uid) return;
    const ref = db.collection('users').doc(uid).collection('watched');
    const now = Date.now();
    const BATCH_LIMIT = 499;
    let batch = db.batch();
    let count = 0;
    for (const season of (seasons || [])) {
      const sNum = season.season_number;
      if (sNum < 1) continue; // skip specials/season 0
      const epCount = season.episode_count || 0;
      for (let e = 1; e <= epCount; e++) {
        const docId = `tv:${tmdbId}:s${sNum}:e${e}`;
        batch.set(ref.doc(docId), {
          tmdbId: Number(tmdbId), mediaType: 'tv',
          seasonNumber: sNum, episodeNumber: e, watchedAt: now,
          name: meta.name || '', posterPath: meta.posterPath || null,
        }, { merge: true });
        count++;
        if (count >= BATCH_LIMIT) { await batch.commit(); batch = db.batch(); count = 0; }
      }
    }
    if (count > 0) await batch.commit();
  },

  // ==================== RATINGS ====================
  async getRatings(userId) {
    const uid = userId || this._uid(); if (!uid) return [];
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
    if (!rating || rating <= 0) { await this.removeRating(tmdbId); return; }
    await db.collection('users').doc(uid).collection('ratings').doc(String(tmdbId)).set({
      tmdbId: Number(tmdbId), rating, ratedAt: Date.now(),
      name: meta.name || '', posterPath: meta.posterPath || null,
      mediaType: meta.mediaType || 'tv',
      review: meta.review || ''
    }, { merge: true });
    this._logActivity('rated', { id: tmdbId, name: meta.name, mediaType: meta.mediaType, posterPath: meta.posterPath, rating, comment: meta.review });
  },

  async removeRating(tmdbId) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(uid).collection('ratings').doc(String(tmdbId)).delete().catch(() => {});
  },

  async removeEpisodeRating(tmdbId, season, episode) {
    const uid = this._uid(); if (!uid) return;
    const docId = `${tmdbId}_s${season}_e${episode}`;
    await db.collection('users').doc(uid).collection('episodeRatings').doc(docId).delete().catch(() => {});
  },

  // ==================== EPISODE RATINGS ====================
  async rateEpisode(tmdbId, season, episode, rating, comment, meta = {}) {
    const uid = this._uid(); if (!uid) return;
    const docId = `${tmdbId}_s${season}_e${episode}`;
    await db.collection('users').doc(uid).collection('episodeRatings').doc(docId).set({
      tmdbId: Number(tmdbId), seasonNumber: season, episodeNumber: episode,
      rating, comment: comment || '', ratedAt: Date.now(),
      showName: meta.showName || '', posterPath: meta.posterPath || null,
      episodeName: meta.episodeName || ''
    }, { merge: true });
    this._logActivity('rated_episode', {
      id: tmdbId, name: meta.showName, mediaType: 'tv', posterPath: meta.posterPath,
      rating, comment, seasonNumber: season, episodeNumber: episode, episodeName: meta.episodeName
    });
  },

  async getEpisodeRating(tmdbId, season, episode, userId) {
    const uid = userId || this._uid(); if (!uid) return null;
    // Try new format first
    const docId = `${tmdbId}_s${season}_e${episode}`;
    const doc = await db.collection('users').doc(uid).collection('episodeRatings').doc(docId).get();
    if (doc.exists) return doc.data();
    // Try old React Native format: episodeReviews collection
    try {
      const oldDoc = await db.collection('users').doc(uid).collection('episodeReviews').doc(docId).get();
      if (oldDoc.exists) return oldDoc.data();
    } catch (_) {}
    // Try old format with different doc ID patterns
    try {
      const altId = `${tmdbId}:s${season}:e${episode}`;
      const altDoc = await db.collection('users').doc(uid).collection('episodeRatings').doc(altId).get();
      if (altDoc.exists) return altDoc.data();
      const altDoc2 = await db.collection('users').doc(uid).collection('episodeReviews').doc(altId).get();
      if (altDoc2.exists) return altDoc2.data();
    } catch (_) {}
    // Try ratings collection with episode key
    try {
      const rDoc = await db.collection('users').doc(uid).collection('ratings').doc(`${tmdbId}_s${season}_e${episode}`).get();
      if (rDoc.exists) return rDoc.data();
    } catch (_) {}
    return null;
  },

  async getAllEpisodeRatingsForShow(tmdbId, userId) {
    const uid = userId || this._uid(); if (!uid) return [];
    const results = [];
    // Try episodeRatings collection
    try {
      const snap = await db.collection('users').doc(uid).collection('episodeRatings')
        .where('tmdbId', '==', Number(tmdbId)).get();
      snap.docs.forEach(d => results.push({ docId: d.id, ...d.data() }));
    } catch (_) {}
    // Try old episodeReviews collection
    try {
      const snap = await db.collection('users').doc(uid).collection('episodeReviews')
        .where('tmdbId', '==', Number(tmdbId)).get();
      snap.docs.forEach(d => {
        if (!results.some(r => r.seasonNumber === d.data().seasonNumber && r.episodeNumber === d.data().episodeNumber)) {
          results.push({ docId: d.id, ...d.data() });
        }
      });
    } catch (_) {}
    return results;
  },

  // ==================== REACTIONS ====================
  async addReaction(targetUserId, ratingDocId, emoji) {
    const uid = this._uid(); if (!uid) return;
    const me = this._user();
    const reactionRef = db.collection('users').doc(targetUserId)
      .collection('episodeRatings').doc(ratingDocId)
      .collection('reactions').doc(uid);
    await reactionRef.set({
      emoji, userId: uid, userName: me.displayName || '',
      createdAt: Date.now()
    });
  },

  async removeReaction(targetUserId, ratingDocId) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(targetUserId)
      .collection('episodeRatings').doc(ratingDocId)
      .collection('reactions').doc(uid).delete();
  },

  async getReactions(targetUserId, ratingDocId) {
    try {
      const snap = await db.collection('users').doc(targetUserId)
        .collection('episodeRatings').doc(ratingDocId)
        .collection('reactions').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (_) { return []; }
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

  async resolveShame(shameId) {
    const uid = this._uid(); if (!uid) return;
    const userRef = db.collection('users').doc(uid).collection('shames').doc(shameId);
    const globalRef = db.collection('shames').doc(shameId);
    const batch = db.batch();
    batch.update(userRef, { status: 'resolved', resolvedAt: Date.now() });
    batch.update(globalRef, { status: 'resolved', resolvedAt: Date.now() });
    await batch.commit();
  },

  async getAllShames() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('users').doc(uid).collection('shames')
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

  async getAllMyEpisodeRatings() {
    const uid = this._uid(); if (!uid) return [];
    try {
      const snap = await db.collection('users').doc(uid).collection('episodeRatings').get();
      return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    } catch (_) { return []; }
  },

  async uploadProfilePhoto(file) {
    const uid = this._uid(); if (!uid) throw new Error('Not signed in');
    const ref = storage.ref(`profilePhotos/${uid}/avatar`);
    const snapshot = await ref.put(file);
    const url = await snapshot.ref.getDownloadURL();
    await db.collection('users').doc(uid).update({ photoURL: url });
    await auth.currentUser.updateProfile({ photoURL: url }).catch(() => {});
    return url;
  },

  // ==================== ACTIVITY FEED ====================
  async _logActivity(type, media) {
    const uid = this._uid(); if (!uid) return;
    const me = this._user();
    const data = {
      type, mediaId: media.id, mediaTitle: media.name || media.title,
      mediaType: media.mediaType || 'tv', mediaPosterPath: media.posterPath || null,
      userId: uid, userName: me.displayName || '', userPhoto: me.photoURL || null,
      createdAt: Date.now()
    };
    if (media.rating != null) data.rating = media.rating;
    if (media.comment) data.comment = media.comment;
    if (media.seasonNumber != null) data.seasonNumber = media.seasonNumber;
    if (media.episodeNumber != null) data.episodeNumber = media.episodeNumber;
    if (media.episodeName) data.episodeName = media.episodeName;
    await db.collection('users').doc(uid).collection('activity').add(data);
  },

  async getActivityFeed(friendUids = []) {
    if (friendUids.length === 0) return [];
    const activities = [];
    await Promise.all(friendUids.map(async uid => {
      try {
        const snap = await db.collection('users').doc(uid).collection('activity')
          .orderBy('createdAt', 'desc').limit(50).get();
        snap.docs.forEach(d => activities.push({ id: d.id, ...d.data() }));
      } catch (_) {
        // Fallback without ordering
        try {
          const snap = await db.collection('users').doc(uid).collection('activity').limit(50).get();
          snap.docs.forEach(d => activities.push({ id: d.id, ...d.data() }));
        } catch (_2) {}
      }
    }));
    activities.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return activities;
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
  },

  // ==================== PLEX HISTORY (Firestore) ====================
  async savePlexHistory(items) {
    const uid = this._uid(); if (!uid) return;
    const batch = db.batch();
    const ref = db.collection('users').doc(uid).collection('plexHistory');
    for (const item of items) {
      const docId = item.type === 'show'
        ? `show_${(item.title || '').replace(/\W+/g, '_')}_s${item.season || 0}e${item.episode || 0}`
        : `movie_${(item.title || '').replace(/\W+/g, '_')}`;
      batch.set(ref.doc(docId), { ...item, savedAt: Date.now() }, { merge: true });
    }
    await batch.commit();
  },

  async getPlexHistory() {
    const uid = this._uid(); if (!uid) return [];
    try {
      const snap = await db.collection('users').doc(uid).collection('plexHistory').orderBy('lastViewedAt', 'desc').get();
      if (snap.docs.length) return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    } catch (_) {}
    const snap = await db.collection('users').doc(uid).collection('plexHistory').get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  },

  // Backport Plex-synced items into the user's activity log.
  // Creates one "watched" entry per unique TMDB ID (most recent play date).
  // Uses a stable doc ID so re-syncing is idempotent.
  async backportPlexActivity(items) {
    const uid = this._uid(); if (!uid) return;
    const me = this._user();

    // Deduplicate: keep only the most-recent entry per tmdbId
    const byTmdb = new Map();
    items.forEach(item => {
      if (!item.tmdbId) return;
      const key = `${item.type}:${item.tmdbId}`;
      const existing = byTmdb.get(key);
      if (!existing || (item.lastViewedAt || 0) > (existing.lastViewedAt || 0)) {
        byTmdb.set(key, item);
      }
    });

    if (!byTmdb.size) return;

    const activityRef = db.collection('users').doc(uid).collection('activity');
    const BATCH_LIMIT = 499;
    let batch = db.batch();
    let count = 0;

    const flush = async () => { if (count > 0) { await batch.commit(); batch = db.batch(); count = 0; } };

    // Show/movie-level watched entries (deduplicated)
    for (const item of byTmdb.values()) {
      const docId = `plex_watched_${item.tmdbId}`;
      batch.set(activityRef.doc(docId), {
        type: 'watched', source: 'plex',
        mediaId: item.tmdbId, mediaTitle: item.tmdbTitle || item.title,
        mediaType: item.type === 'movie' ? 'movie' : 'tv',
        mediaPosterPath: item.posterPath || null,
        userId: uid, userName: me?.displayName || '', userPhoto: me?.photoURL || null,
        createdAt: item.lastViewedAt ? item.lastViewedAt * 1000 : Date.now()
      });
      count++;
      if (count >= BATCH_LIMIT) await flush();
    }

    // Episode-level watched entries for recent episodes (last 90 days)
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const episodeItems = items.filter(item =>
      item.type === 'show' && item.tmdbId && item.season != null && item.episode != null &&
      (item.lastViewedAt ? item.lastViewedAt * 1000 : 0) >= cutoff
    ).slice(0, 150); // cap to avoid spamming

    for (const item of episodeItems) {
      const docId = `plex_ep_${item.tmdbId}_s${item.season}e${item.episode}`;
      batch.set(activityRef.doc(docId), {
        type: 'watched_episode', source: 'plex',
        mediaId: item.tmdbId, mediaTitle: item.tmdbTitle || item.title,
        mediaType: 'tv', mediaPosterPath: item.posterPath || null,
        seasonNumber: item.season, episodeNumber: item.episode,
        episodeName: item.episodeTitle || '',
        userId: uid, userName: me?.displayName || '', userPhoto: me?.photoURL || null,
        createdAt: item.lastViewedAt ? item.lastViewedAt * 1000 : Date.now()
      });
      count++;
      if (count >= BATCH_LIMIT) await flush();
    }

    if (count > 0) await batch.commit();
  }
};
