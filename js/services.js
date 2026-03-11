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
  async getFriends(targetUid) {
    const uid = targetUid || this._uid(); if (!uid) return [];
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
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => {
      // Notify the shamer rather than auto-resolving — they must do the absolving
      batch.update(d.ref, { status: 'pendingAbsolution', watchedAt: Date.now() });
      batch.update(db.collection('shames').doc(d.id), { status: 'pendingAbsolution', watchedAt: Date.now() });
      // Write a notification so the shamer sees it
      const shamerUid = d.data().shamerUid;
      if (shamerUid) {
        db.collection('users').doc(shamerUid).collection('notifications').add({
          type: 'shame_watched',
          shameId: d.id,
          shamedName: d.data().shamedName || '',
          mediaTitle: d.data().mediaTitle || '',
          createdAt: Date.now(),
          read: false
        }).catch(() => {});
      }
    });
    await batch.commit();
  },

  async resolveShame(shameId) {
    const uid = this._uid(); if (!uid) return;
    // Fetch the shame to verify the caller is the shamer
    const globalRef = db.collection('shames').doc(shameId);
    const doc = await globalRef.get();
    if (!doc.exists) throw new Error('Shame not found');
    const shame = doc.data();
    if (shame.shamerUid !== uid) throw new Error('Only the person who gave the shame can remove it');
    const shamedUid = shame.shamedUid;
    const batch = db.batch();
    batch.update(globalRef, { status: 'resolved', resolvedAt: Date.now() });
    batch.update(db.collection('users').doc(shamedUid).collection('shames').doc(shameId), { status: 'resolved', resolvedAt: Date.now() });
    await batch.commit();
  },

  async denyAbsolution(shameId) {
    const uid = this._uid(); if (!uid) return;
    const globalRef = db.collection('shames').doc(shameId);
    const doc = await globalRef.get();
    if (!doc.exists) throw new Error('Shame not found');
    const shame = doc.data();
    if (shame.shamerUid !== uid) throw new Error('Only the shamer can act on this');
    const batch = db.batch();
    batch.update(globalRef, { status: 'active' });
    batch.update(db.collection('users').doc(shame.shamedUid).collection('shames').doc(shameId), { status: 'active' });
    await batch.commit();
  },

  async getPendingAbsolutions() {
    const uid = this._uid(); if (!uid) return [];
    const snap = await db.collection('shames')
      .where('shamerUid', '==', uid).where('status', '==', 'pendingAbsolution').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const updated = (list.items || []).filter(i => String(i.id) !== String(itemId));
    await db.collection('sharedLists').doc(listId).update({ items: updated });
  },

  async inviteToSharedList(listId, friendUid) {
    await db.collection('sharedLists').doc(listId).update({
      members: firebase.firestore.FieldValue.arrayUnion(friendUid)
    });
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

  // Fetch a page of activity from one or more users.
  // cursors is a map of uid → last Firestore DocumentSnapshot (for pagination).
  // Returns { items, cursors } where the new cursors map can be passed back for the next page.
  async getActivityFeed(friendUids = [], cursors = {}, pageSize = 20) {
    if (friendUids.length === 0) return { items: [], cursors: {} };
    const perUser = Math.max(1, Math.ceil(pageSize / friendUids.length));
    const nextCursors = { ...cursors };
    const activities = [];
    await Promise.all(friendUids.map(async uid => {
      try {
        let q = db.collection('users').doc(uid).collection('activity')
          .orderBy('createdAt', 'desc').limit(perUser);
        if (cursors[uid]) q = q.startAfter(cursors[uid]);
        const snap = await q.get();
        if (!snap.empty) {
          snap.docs.forEach(d => activities.push({ id: d.id, ...d.data() }));
          nextCursors[uid] = snap.docs[snap.docs.length - 1];
        }
      } catch (_) {
        // Fallback without ordering (no cursor support in this path)
        try {
          const snap = await db.collection('users').doc(uid).collection('activity').limit(perUser).get();
          snap.docs.forEach(d => activities.push({ id: d.id, ...d.data() }));
        } catch (_2) {}
      }
    }));
    activities.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { items: activities, cursors: nextCursors };
  },

  // Get ALL plex history for a user formatted as activity items (for activity feed display).
  async getPlexHistoryAsActivity(uid) {
    const targetUid = uid || this._uid();
    if (!targetUid) return [];
    try {
      const snap = await db.collection('users').doc(targetUid).collection('plexHistory')
        .orderBy('lastViewedAt', 'desc').get();
      const profile = this._user();
      return snap.docs.map(d => {
        const item = d.data();
        return {
          id: d.id,
          type: item.type === 'movie' ? 'watched' : (item.season != null ? 'watched_episode' : 'watched'),
          source: 'plex',
          mediaId: item.tmdbId || null,
          mediaTitle: item.tmdbTitle || item.title || '',
          mediaType: item.type === 'movie' ? 'movie' : 'tv',
          mediaPosterPath: item.posterPath || null,
          seasonNumber: item.season || null,
          episodeNumber: item.episode || null,
          userId: targetUid,
          userName: profile?.displayName || '',
          userPhoto: profile?.photoURL || null,
          createdAt: item.lastViewedAt ? item.lastViewedAt * 1000 : (item.savedAt || Date.now()),
          _plexOnly: true
        };
      });
    } catch (_) {
      try {
        const snap = await db.collection('users').doc(targetUid).collection('plexHistory').get();
        const profile = this._user();
        return snap.docs.map(d => {
          const item = d.data();
          return {
            id: d.id,
            type: item.type === 'movie' ? 'watched' : (item.season != null ? 'watched_episode' : 'watched'),
            source: 'plex',
            mediaId: item.tmdbId || null,
            mediaTitle: item.tmdbTitle || item.title || '',
            mediaType: item.type === 'movie' ? 'movie' : 'tv',
            mediaPosterPath: item.posterPath || null,
            seasonNumber: item.season || null,
            episodeNumber: item.episode || null,
            userId: targetUid,
            userName: profile?.displayName || '',
            userPhoto: profile?.photoURL || null,
            createdAt: item.lastViewedAt ? item.lastViewedAt * 1000 : (item.savedAt || Date.now()),
            _plexOnly: true
          };
        });
      } catch (_2) { return []; }
    }
  },

  // Ensure plex history has been backported to the activity collection (idempotent).
  async ensurePlexActivityBackfill() {
    const uid = this._uid(); if (!uid) return;
    // Only run once per session
    if (this._plexBackfillDone) return;
    this._plexBackfillDone = true;
    try {
      const items = await this.getPlexHistory();
      if (items.length) await this.backportPlexActivity(items);
    } catch (_) {}
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
    const empty = { episodes: 0, movies: 0, completed: 0, plex: false, friends: 0, friendsCount: 0, ratings: 0, ratingsCount: 0, watchlist: 0, watchlistCount: 0, watched: 0, reviews: 0, shamesSent: 0, matcherSessions: 0, episodeRatings: 0 };
    if (!targetUid) return empty;

    const epPattern = /^tv:\d+:s\d+:e\d+$/;
    const isCurrentUser = !uid || uid === this._uid();

    const [watchedSnap, watchlistSnap, ratingsSnap, friendsSnap, plexSnap] = await Promise.all([
      db.collection('users').doc(targetUid).collection('watched').get(),
      db.collection('users').doc(targetUid).collection('watchlist').get(),
      db.collection('users').doc(targetUid).collection('ratings').get(),
      db.collection('users').doc(targetUid).collection('friends').get(),
      db.collection('users').doc(targetUid).collection('plexHistory').get()
    ]);

    // Count episodes & movies from manually-tracked watched collection
    const watchedEpisodes = watchedSnap.docs.filter(d => epPattern.test(d.id)).length;
    const watchedMovies   = watchedSnap.docs.filter(d => d.id.startsWith('movie:')).length;

    // Count from Plex history (avoid double-counting by taking max)
    const plexEpisodes = plexSnap.docs.filter(d => d.data().type === 'show').length;
    const plexMovies   = plexSnap.docs.filter(d => d.data().type === 'movie').length;

    const episodes = Math.max(watchedEpisodes, plexEpisodes);
    const movies   = Math.max(watchedMovies,   plexMovies);

    // Unique TV shows that have at least one watched episode
    const showIds = new Set();
    watchedSnap.docs.forEach(d => { if (epPattern.test(d.id)) showIds.add(d.id.split(':')[1]); });
    const completed = showIds.size;

    // Plex connection status
    const plex = isCurrentUser ? this.plex.isConnected : plexSnap.size > 0;

    // Ratings breakdown
    const ratingDocs = ratingsSnap.docs.map(d => d.data());
    const episodeRatings = ratingDocs.filter(d => d.mediaType === 'episode').length;
    const reviews        = ratingDocs.filter(d => d.review && d.review.trim().length > 0).length;

    // Shames & matcher (graceful fallbacks)
    let shamesSent = 0, matcherSessions = 0;
    try { const s = await db.collection('shames').where('fromUid', '==', targetUid).get(); shamesSent = s.size; } catch (_) {}
    try { const m = await db.collection('matcherSessions').where('createdBy', '==', targetUid).get(); matcherSessions = m.size; } catch (_) {}

    return {
      episodes, movies, completed, plex,
      friends: friendsSnap.size, friendsCount: friendsSnap.size,
      ratings: ratingsSnap.size, ratingsCount: ratingsSnap.size,
      watchlist: watchlistSnap.size, watchlistCount: watchlistSnap.size,
      watched: watchedSnap.size,
      reviews, shamesSent, matcherSessions, episodeRatings
    };
  },

  // ==================== PLEX STATE ====================
  plex: {
    get serverUrl() { return localStorage.getItem('plex_server_url'); },
    get token() { return localStorage.getItem('plex_token'); },
    get machineId() { return localStorage.getItem('plex_machine_id'); },
    get isConnected() { return !!(this.serverUrl && this.token); },
    connect(url, token) {
      localStorage.setItem('plex_server_url', url);
      localStorage.setItem('plex_token', token);
    },
    setMachineId(id) { if (id) localStorage.setItem('plex_machine_id', id); },
    disconnect() {
      localStorage.removeItem('plex_server_url');
      localStorage.removeItem('plex_token');
      localStorage.removeItem('plex_library');
      localStorage.removeItem('plex_machine_id');
    },
    getLibrary() {
      try { return JSON.parse(localStorage.getItem('plex_library') || '[]'); } catch { return []; }
    },
    setLibrary(lib) { localStorage.setItem('plex_library', JSON.stringify(lib)); }
  },

  findInPlexLibrary(tmdbId) {
    const lib = this.plex.getLibrary();
    const id = Number(tmdbId);
    return lib.find(item => item.tmdbId === id) || null;
  },

  // ==================== PLEX CREDENTIALS (Firestore) ====================
  async savePlexCredentials(serverName, token) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(uid).set(
      { plexCredentials: { serverName: serverName || '', token, savedAt: Date.now() } },
      { merge: true }
    );
  },

  async restorePlexOnLogin() {
    const uid = this._uid(); if (!uid) return;
    // Already connected (localStorage still has credentials) — just ensure library cache is warm
    if (this.plex.isConnected) {
      if (!this.plex.getLibrary().length) await this._restorePlexLibraryCache(uid);
      return;
    }
    try {
      const snap = await db.collection('users').doc(uid).get();
      const creds = snap.data()?.plexCredentials;
      if (creds?.token) {
        this.plex.connect(creds.serverName || '', creds.token);
        await this._restorePlexLibraryCache(uid);
      }
    } catch (_) {}
  },

  async _restorePlexLibraryCache(uid) {
    try {
      const snap = await db.collection('users').doc(uid).collection('plexHistory').get();
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data());
        this.plex.setLibrary(items);
      }
    } catch (_) {}
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

  async findInPlexHistory(tmdbId) {
    const uid = this._uid(); if (!uid) return null;
    try {
      const id = Number(tmdbId);
      const snap = await db.collection('users').doc(uid).collection('plexHistory')
        .where('tmdbId', '==', id).limit(1).get();
      if (!snap.empty) return { docId: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (_) {}
    return null;
  },

  async updatePlexHistoryMatch(docId, tmdbId, posterPath, mediaType) {
    const uid = this._uid(); if (!uid) return;
    await db.collection('users').doc(uid).collection('plexHistory').doc(docId).update({
      tmdbId: Number(tmdbId),
      posterPath: posterPath || null,
      type: mediaType || 'show',
    });
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

    // Episode-level watched entries — ALL episodes, no date/count limit
    const episodeItems = items.filter(item =>
      item.type === 'show' && item.tmdbId && item.season != null && item.episode != null
    );

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
  },

  // Mark all Plex-synced episodes as watched in the main watched collection.
  // Only processes items that have a tmdbId match. Idempotent (uses stable docIds).
  async markWatchedFromPlexHistory(onProgress) {
    const uid = this._uid(); if (!uid) return { total: 0, marked: 0 };
    const items = await this.getPlexHistory();
    const withTmdb = items.filter(i => i.tmdbId);
    if (!withTmdb.length) return { total: 0, marked: 0 };

    const watchedRef = db.collection('users').doc(uid).collection('watched');
    const BATCH_LIMIT = 499;
    let batch = db.batch();
    let count = 0;
    let marked = 0;

    const flush = async () => { if (count > 0) { await batch.commit(); batch = db.batch(); count = 0; } };

    for (let i = 0; i < withTmdb.length; i++) {
      const item = withTmdb[i];
      if (onProgress) onProgress(i + 1, withTmdb.length);

      if (item.type === 'movie') {
        const docId = `movie:${item.tmdbId}`;
        batch.set(watchedRef.doc(docId), {
          tmdbId: Number(item.tmdbId),
          mediaType: 'movie',
          watchedAt: item.lastViewedAt ? item.lastViewedAt * 1000 : Date.now(),
          name: item.tmdbTitle || item.title || '',
          posterPath: item.posterPath || null
        }, { merge: true });
        count++; marked++;
      } else if (item.type === 'show' && item.season != null && item.episode != null) {
        const docId = `tv:${item.tmdbId}:s${item.season}:e${item.episode}`;
        batch.set(watchedRef.doc(docId), {
          tmdbId: Number(item.tmdbId),
          mediaType: 'tv',
          watchedAt: item.lastViewedAt ? item.lastViewedAt * 1000 : Date.now(),
          seasonNumber: item.season,
          episodeNumber: item.episode,
          name: item.tmdbTitle || item.title || '',
          posterPath: item.posterPath || null
        }, { merge: true });
        count++; marked++;
      } else if (item.type === 'show') {
        // Show-level (no episode info)
        const docId = `tv:${item.tmdbId}`;
        batch.set(watchedRef.doc(docId), {
          tmdbId: Number(item.tmdbId),
          mediaType: 'tv',
          watchedAt: item.lastViewedAt ? item.lastViewedAt * 1000 : Date.now(),
          name: item.tmdbTitle || item.title || '',
          posterPath: item.posterPath || null
        }, { merge: true });
        count++; marked++;
      }

      if (count >= BATCH_LIMIT) await flush();
    }

    await flush();
    return { total: withTmdb.length, marked };
  },

  // ==================== INVITE CODES ====================
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },

  async validateInviteCode(code) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    const doc = await db.collection('inviteCodes').doc(clean).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data.active || data.usedBy) return null;
    return { code: clean, ...data };
  },

  async useInviteCode(code, newUserUid) {
    const clean = code.trim().toUpperCase();
    await db.collection('inviteCodes').doc(clean).update({
      usedBy: newUserUid,
      usedAt: Date.now(),
      active: false
    });
  },

  async generateUserInviteCodes(uid, count = 3) {
    const batch = db.batch();
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = this._generateCode();
      codes.push(code);
      batch.set(db.collection('inviteCodes').doc(code), {
        code,
        createdBy: uid,
        usedBy: null,
        usedAt: null,
        active: true,
        createdAt: Date.now()
      });
    }
    await batch.commit();
    await db.collection('users').doc(uid).update({ inviteCodes: codes });
    return codes;
  },

  async getUserInviteCodes() {
    const uid = this._uid(); if (!uid) return [];
    const doc = await db.collection('users').doc(uid).get();
    return doc.data()?.inviteCodes || [];
  },

  // ==================== TICKET REQUESTS ====================
  async submitTicketRequest(postUrl, message) {
    const uid = this._uid(); if (!uid) return;
    const user = this._user();
    await db.collection('ticketRequests').add({
      uid,
      username: user?.displayName || '',
      postUrl: postUrl.trim(),
      message: message.trim(),
      status: 'pending',
      createdAt: Date.now()
    });
  },

  async getMyTickets() {
    const uid = this._uid(); if (!uid) return 0;
    const doc = await db.collection('users').doc(uid).get();
    return doc.data()?.tickets || 0;
  },

  // ==================== USER REPORTS / FLAGGING ====================
  async reportUser(targetUid, reason, message) {
    const uid = this._uid(); if (!uid) throw new Error('Not signed in');
    const user = this._user();
    await db.collection('userReports').add({
      reporterUid: uid,
      reporterName: user?.displayName || '',
      targetUid,
      reason,
      message: (message || '').trim(),
      status: 'pending',
      createdAt: Date.now()
    });
  },

  async getUserReports(status) {
    let q = db.collection('userReports').orderBy('createdAt', 'desc');
    if (status) q = q.where('status', '==', status);
    const snap = await q.limit(100).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async updateReportStatus(reportId, status) {
    await db.collection('userReports').doc(reportId).update({ status, reviewedAt: Date.now() });
  },

  // ==================== BUG REPORTS ====================
  async submitBugReport(category, description, screenshotUrl) {
    const uid = this._uid();
    const user = this._user();
    await db.collection('bugReports').add({
      uid: uid || null,
      username: user?.displayName || 'Anonymous',
      category,
      description: description.trim(),
      screenshotUrl: (screenshotUrl || '').trim() || null,
      status: 'open',
      createdAt: Date.now()
    });
  },

  async getBugReports(status) {
    let q = db.collection('bugReports').orderBy('createdAt', 'desc');
    if (status) q = q.where('status', '==', status);
    const snap = await q.limit(100).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async updateBugStatus(bugId, status) {
    await db.collection('bugReports').doc(bugId).update({ status, updatedAt: Date.now() });
  },

  // ==================== KEEP WATCHING ====================
  // Returns shows with episode-level tracking, most recently watched first.
  async getKeepWatching(limit = 8) {
    const uid = this._uid(); if (!uid) return [];
    try {
      const snap = await db.collection('users').doc(uid).collection('watched').get();
      const docs = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      // Find episode-level docs: tv:ID:s#:e#
      const epPattern = /^tv:(\d+):s(\d+):e(\d+)$/;
      const showMap = new Map();
      docs.forEach(doc => {
        const m = doc.docId?.match(epPattern);
        if (!m) return;
        const showId = Number(m[1]);
        const s = Number(m[2]), ep = Number(m[3]);
        const existing = showMap.get(showId);
        const ts = doc.watchedAt || 0;
        if (!existing || ts > (existing.latestAt || 0)) {
          showMap.set(showId, {
            tmdbId: showId,
            name: doc.name || '',
            posterPath: doc.posterPath || null,
            latestSeason: s,
            latestEpisode: ep,
            latestAt: ts,
            episodeCount: (existing?.episodeCount || 0) + 1
          });
        } else {
          existing.episodeCount = (existing.episodeCount || 0) + 1;
        }
      });
      // Sort by most recently watched
      return [...showMap.values()]
        .sort((a, b) => b.latestAt - a.latestAt)
        .slice(0, limit);
    } catch (_) { return []; }
  },

  // ==================== ANNOUNCEMENTS ====================
  async createAnnouncement(title, body) {
    const user = this._user();
    await db.collection('announcements').add({
      title: title.trim(),
      body: body.trim(),
      createdBy: user?.displayName || '',
      createdAt: Date.now(),
      active: true
    });
  },

  async getAnnouncements(activeOnly) {
    let q = db.collection('announcements').orderBy('createdAt', 'desc');
    if (activeOnly) q = q.where('active', '==', true);
    const snap = await q.limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async deleteAnnouncement(id) {
    await db.collection('announcements').doc(id).delete();
  }
};

