const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── Helper: send push to a user by UID ───
async function sendToUser(uid, notification, data = {}) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return;
  const userData = userDoc.data();
  const tokens = userData.fcmTokens || [];
  if (tokens.length === 0) return;

  // Check user notification preferences
  const prefs = userData.notificationPrefs || {};
  if (prefs.enabled === false) return;
  const category = data._category;
  if (category && prefs[category] === false) return;

  // Clean internal fields from data
  const cleanData = { ...data };
  delete cleanData._category;

  const messaging = getMessaging();
  const staleTokens = [];

  await Promise.all(tokens.map(async (token) => {
    try {
      await messaging.send({
        token,
        notification,
        data: cleanData,
        apns: {
          payload: {
            aps: { sound: "default", badge: 1 },
          },
        },
      });
    } catch (err) {
      if (
        err.code === "messaging/invalid-registration-token" ||
        err.code === "messaging/registration-token-not-registered"
      ) {
        staleTokens.push(token);
      }
    }
  }));

  // Clean up invalid tokens
  if (staleTokens.length > 0) {
    await db.collection("users").doc(uid).update({
      fcmTokens: FieldValue.arrayRemove(...staleTokens),
    });
  }
}

// ═══════════════════════════════════════════════════════
// 1. Friend Added — fires when a doc is created in friends subcollection
// ═══════════════════════════════════════════════════════
exports.onFriendAdded = onDocumentCreated(
  "users/{userId}/friends/{friendId}",
  async (event) => {
    const friendData = event.data?.data();
    if (!friendData) return;
    const userId = event.params.userId; // the user whose friends list changed
    const friendId = event.params.friendId; // the friend that was added

    // Only notify the target user (friendId receives notification when userId adds them)
    // The friend doc is written on both sides, so we notify userId that friendId added them.
    // Actually both sides get written simultaneously. We send to the userId whose doc was created,
    // meaning they were added by friendId. Use the data in the doc (which is the adder's info).
    await sendToUser(userId, {
      title: "New Friend!",
      body: `${friendData.username || "Someone"} added you as a friend`,
    }, {
      page: "friends",
      _category: "friends",
    });
  }
);

// ═══════════════════════════════════════════════════════
// 2. Recommendation Received
// ═══════════════════════════════════════════════════════
exports.onRecommendation = onDocumentCreated(
  "users/{userId}/recommendations/{recId}",
  async (event) => {
    const rec = event.data?.data();
    if (!rec) return;
    const userId = event.params.userId;

    await sendToUser(userId, {
      title: "New Recommendation",
      body: `${rec.fromName || "A friend"} recommends "${rec.mediaTitle}"${rec.message ? ": " + rec.message : ""}`,
    }, {
      page: "friends",
      _category: "recommendations",
    });
  }
);

// ═══════════════════════════════════════════════════════
// 3. Shamed by Friend
// ═══════════════════════════════════════════════════════
exports.onShamed = onDocumentCreated(
  "users/{userId}/shames/{shameId}",
  async (event) => {
    const shame = event.data?.data();
    if (!shame || shame.status !== "active") return;
    const userId = event.params.userId;
    // Only notify the shamed user (not the shamer)
    if (shame.shamedUid !== userId) return;

    await sendToUser(userId, {
      title: "You've Been Shamed! 😱",
      body: `${shame.shamerName} shamed you for not watching "${shame.mediaTitle}"`,
    }, {
      page: "wall-of-shame",
      _category: "shames",
    });
  }
);

// ═══════════════════════════════════════════════════════
// 4. Shame Status Changed (absolution pending, resolved, denied)
// ═══════════════════════════════════════════════════════
exports.onShameUpdated = onDocumentUpdated(
  "shames/{shameId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    if (after.status === "pendingAbsolution") {
      // Notify the shamer that the shamed user watched it
      await sendToUser(after.shamerUid, {
        title: "Absolution Requested",
        body: `${after.shamedName} watched "${after.mediaTitle}" and wants absolution`,
      }, {
        page: "wall-of-shame",
        _category: "shames",
      });
    } else if (after.status === "resolved") {
      // Notify the shamed user they've been absolved
      await sendToUser(after.shamedUid, {
        title: "Shame Removed! 🎉",
        body: `${after.shamerName} absolved your shame for "${after.mediaTitle}"`,
      }, {
        page: "wall-of-shame",
        _category: "shames",
      });
    } else if (before.status === "pendingAbsolution" && after.status === "active") {
      // Absolution denied
      await sendToUser(after.shamedUid, {
        title: "Absolution Denied 😤",
        body: `${after.shamerName} denied your absolution for "${after.mediaTitle}"`,
      }, {
        page: "wall-of-shame",
        _category: "shames",
      });
    }
  }
);

// ═══════════════════════════════════════════════════════
// 5. Reaction on Episode Rating
// ═══════════════════════════════════════════════════════
exports.onReaction = onDocumentCreated(
  "users/{userId}/episodeRatings/{ratingId}/reactions/{reactorId}",
  async (event) => {
    const reaction = event.data?.data();
    if (!reaction) return;
    const userId = event.params.userId;
    // Don't notify yourself
    if (reaction.userId === userId) return;

    await sendToUser(userId, {
      title: "New Reaction",
      body: `${reaction.userName || "Someone"} reacted ${reaction.emoji} to your review`,
    }, {
      page: "activity",
      _category: "reactions",
    });
  }
);

// ═══════════════════════════════════════════════════════
// 6. Matcher Session Invite
// ═══════════════════════════════════════════════════════
exports.onMatcherCreated = onDocumentCreated(
  "matcherSessions/{sessionId}",
  async (event) => {
    const session = event.data?.data();
    if (!session) return;
    const creator = session.createdBy;
    const participants = session.participants || [];

    // Get creator's name
    const creatorDoc = await db.collection("users").doc(creator).get();
    const creatorName = creatorDoc.exists ? (creatorDoc.data().username || "A friend") : "A friend";

    // Notify other participants
    for (const uid of participants) {
      if (uid === creator) continue;
      await sendToUser(uid, {
        title: "Matcher Invite! 🎬",
        body: `${creatorName} wants to find something to watch with you`,
      }, {
        page: "matcher-history",
        _category: "matcher",
      });
    }
  }
);

// ═══════════════════════════════════════════════════════
// 7. Matcher Votes Complete
// ═══════════════════════════════════════════════════════
exports.onMatcherVote = onDocumentUpdated(
  "matcherSessions/{sessionId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const participants = after.participants || [];
    const votesBefore = Object.keys(before.votes || {}).length;
    const votesAfter = Object.keys(after.votes || {}).length;

    // Check if all participants have voted now (but not before)
    if (votesAfter === participants.length && votesBefore < participants.length) {
      for (const uid of participants) {
        await sendToUser(uid, {
          title: "Matcher Results Ready! 🍿",
          body: "Your match results are in — see what you both want to watch",
        }, {
          page: "matcher-history",
          _category: "matcher",
        });
      }
    }
  }
);

// ═══════════════════════════════════════════════════════
// 8. Shared List Invite (member added)
// ═══════════════════════════════════════════════════════
exports.onSharedListUpdated = onDocumentUpdated(
  "sharedLists/{listId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const oldMembers = before.members || [];
    const newMembers = after.members || [];
    const addedMembers = newMembers.filter((m) => !oldMembers.includes(m));

    if (addedMembers.length > 0) {
      // Get who invited (the member who was already in the list)
      const creatorDoc = await db.collection("users").doc(after.createdBy).get();
      const creatorName = creatorDoc.exists ? (creatorDoc.data().username || "Someone") : "Someone";

      for (const uid of addedMembers) {
        await sendToUser(uid, {
          title: "Shared List Invite",
          body: `${creatorName} added you to "${after.name}"`,
        }, {
          page: "shared-lists",
          _category: "sharedLists",
        });
      }
    }

    // Check for new items added
    const oldItems = before.items || [];
    const newItems = after.items || [];
    if (newItems.length > oldItems.length) {
      const latest = newItems[newItems.length - 1];
      if (latest && latest.addedBy) {
        const adderDoc = await db.collection("users").doc(latest.addedBy).get();
        const adderName = adderDoc.exists ? (adderDoc.data().username || "Someone") : "Someone";

        // Notify all members except the person who added the item
        for (const uid of newMembers) {
          if (uid === latest.addedBy) continue;
          await sendToUser(uid, {
            title: `New in "${after.name}"`,
            body: `${adderName} added "${latest.name}"`,
          }, {
            page: "shared-lists",
            _category: "sharedLists",
          });
        }
      }
    }
  }
);

// ═══════════════════════════════════════════════════════
// 9. Friend Activity — notify when a friend rates something
// ═══════════════════════════════════════════════════════
exports.onActivity = onDocumentCreated(
  "users/{userId}/activity/{activityId}",
  async (event) => {
    const activity = event.data?.data();
    if (!activity) return;
    const userId = event.params.userId;

    // Only notify for ratings (not watchlist adds or watched marks to avoid spam)
    if (activity.type !== "rated" && activity.type !== "rated_episode") return;

    // Get this user's friends
    const friendsSnap = await db.collection("users").doc(userId).collection("friends").get();
    if (friendsSnap.empty) return;

    const userName = activity.userName || "A friend";
    const title = activity.type === "rated_episode"
      ? `${userName} rated an episode`
      : `${userName} rated "${activity.mediaTitle}"`;
    const body = activity.rating != null
      ? `${activity.rating}/10${activity.comment ? " — " + activity.comment.slice(0, 80) : ""}`
      : `Check out what ${userName} thinks`;

    // Send to all friends (up to 50 to avoid excessive writes)
    const friendIds = friendsSnap.docs.map((d) => d.id).slice(0, 50);
    for (const friendUid of friendIds) {
      await sendToUser(friendUid, { title, body }, {
        page: "activity",
        _category: "activity",
      });
    }
  }
);
