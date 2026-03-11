/* ShowBoat — Badge Definitions & Calculator */
const BADGE_TIERS = {
  bronze: { label: 'Bronze', color: '#cd7f32', bg: 'rgba(205,127,50,.15)' },
  silver: { label: 'Silver', color: '#c0c0c0', bg: 'rgba(192,192,192,.15)' },
  gold:   { label: 'Gold',   color: '#ffd700', bg: 'rgba(255,215,0,.15)' }
};

const BADGE_DEFS = [
  // --- TV Watching ---
  { id: 'binge_bronze',    name: 'Binge Watcher',   category: 'Watcher',  icon: '📺', tier: 'bronze', desc: 'Watch 50 episodes',   requirement: 50,  type: 'episodes' },
  { id: 'binge_silver',    name: 'Series Regular',  category: 'Watcher',  icon: '📺', tier: 'silver', desc: 'Watch 200 episodes',  requirement: 200, type: 'episodes' },
  { id: 'binge_gold',      name: 'TV Addict',       category: 'Watcher',  icon: '📺', tier: 'gold',   desc: 'Watch 1000 episodes', requirement: 1000,type: 'episodes' },
  // --- Movie Watching ---
  { id: 'movie_bronze',    name: 'Movie Buff',      category: 'Watcher',  icon: '🎬', tier: 'bronze', desc: 'Watch 20 movies',     requirement: 20,  type: 'movies' },
  { id: 'movie_silver',    name: 'Cinephile',       category: 'Watcher',  icon: '🎬', tier: 'silver', desc: 'Watch 50 movies',     requirement: 50,  type: 'movies' },
  { id: 'movie_gold',      name: 'Film Historian',  category: 'Watcher',  icon: '🎬', tier: 'gold',   desc: 'Watch 100 movies',    requirement: 100, type: 'movies' },
  // --- Completionist ---
  { id: 'finish_bronze',   name: 'Dedicated',       category: 'Watcher',  icon: '🏁', tier: 'bronze', desc: 'Complete 3 TV shows', requirement: 3,   type: 'completed' },
  { id: 'finish_silver',   name: 'Finisher',        category: 'Watcher',  icon: '🏁', tier: 'silver', desc: 'Complete 10 TV shows',requirement: 10,  type: 'completed' },
  { id: 'finish_gold',     name: 'Completionist',   category: 'Watcher',  icon: '🏆', tier: 'gold',   desc: 'Complete 25 TV shows',requirement: 25,  type: 'completed' },
  // --- Ratings/Critic ---
  { id: 'critic_bronze',   name: 'Critic',          category: 'Critic',   icon: '✍️', tier: 'bronze', desc: 'Rate 5 titles',       requirement: 5,   type: 'ratings' },
  { id: 'critic_silver',   name: 'Expert Critic',   category: 'Critic',   icon: '✍️', tier: 'silver', desc: 'Rate 50 titles',      requirement: 50,  type: 'ratings' },
  { id: 'critic_gold',     name: 'The Verdict',     category: 'Critic',   icon: '⚖️', tier: 'gold',   desc: 'Rate 150 titles',     requirement: 150, type: 'ratings' },
  // --- Reviews ---
  { id: 'review_bronze',   name: 'Reviewer',        category: 'Critic',   icon: '📝', tier: 'bronze', desc: 'Write 1 review',      requirement: 1,   type: 'reviews' },
  { id: 'review_silver',   name: 'Opinionated',     category: 'Critic',   icon: '📝', tier: 'silver', desc: 'Write 10 reviews',    requirement: 10,  type: 'reviews' },
  { id: 'review_gold',     name: 'Columnist',       category: 'Critic',   icon: '📰', tier: 'gold',   desc: 'Write 30 reviews',    requirement: 30,  type: 'reviews' },
  // --- Social ---
  { id: 'social_bronze',   name: 'Friendly',        category: 'Social',   icon: '👋', tier: 'bronze', desc: 'Add 1 friend',        requirement: 1,   type: 'friends' },
  { id: 'social_silver',   name: 'Social Butterfly',category: 'Social',   icon: '🦋', tier: 'silver', desc: 'Add 5 friends',       requirement: 5,   type: 'friends' },
  { id: 'social_gold',     name: 'The Connector',   category: 'Social',   icon: '🌐', tier: 'gold',   desc: 'Add 15 friends',      requirement: 15,  type: 'friends' },
  // --- Shamer ---
  { id: 'shame_bronze',    name: 'Tough Love',      category: 'Social',   icon: '👎', tier: 'bronze', desc: 'Shame 1 friend',      requirement: 1,   type: 'shames_sent' },
  { id: 'shame_silver',    name: 'Hall Monitor',    category: 'Social',   icon: '😤', tier: 'silver', desc: 'Shame 5 friends',     requirement: 5,   type: 'shames_sent' },
  { id: 'shame_gold',      name: 'Director of Shame',category:'Social',   icon: '😈', tier: 'gold',   desc: 'Shame 15 friends',    requirement: 15,  type: 'shames_sent' },
  // --- Watchlist ---
  { id: 'wl_bronze',       name: 'Queuer',          category: 'Watcher',  icon: '🔖', tier: 'bronze', desc: '15 items on watchlist',requirement: 15,  type: 'watchlist' },
  { id: 'wl_silver',       name: 'List Builder',    category: 'Watcher',  icon: '📋', tier: 'silver', desc: '50 items on watchlist',requirement: 50,  type: 'watchlist' },
  { id: 'wl_gold',         name: 'The Archivist',   category: 'Watcher',  icon: '📚', tier: 'gold',   desc: '100 items on watchlist',requirement:100, type: 'watchlist' },
  // --- Plex ---
  { id: 'plex_connected',  name: 'Plex Pioneer',    category: 'Plex',     icon: '🟡', tier: 'gold',   desc: 'Connect your Plex account', requirement: 1, type: 'plex' },
  // --- Matcher ---
  { id: 'matcher_bronze',  name: 'Matchmaker',      category: 'Social',   icon: '⚡', tier: 'bronze', desc: 'Use Matcher 1 time',  requirement: 1,   type: 'matcher_sessions' },
  { id: 'matcher_silver',  name: 'Cupid',           category: 'Social',   icon: '💘', tier: 'silver', desc: 'Use Matcher 5 times', requirement: 5,   type: 'matcher_sessions' },
  // --- Episode rating ---
  { id: 'ep_critic_bronze',name: 'Episode Fanatic', category: 'Critic',   icon: '🎯', tier: 'bronze', desc: 'Rate 20 episodes',    requirement: 20,  type: 'episode_ratings' },
  { id: 'ep_critic_silver',name: 'Episode Guru',    category: 'Critic',   icon: '🎯', tier: 'silver', desc: 'Rate 100 episodes',   requirement: 100, type: 'episode_ratings' }
];

function calculateBadges(stats) {
  return BADGE_DEFS.map(badge => {
    let current = 0;
    switch (badge.type) {
      case 'episodes':         current = stats.episodes || stats.watchedCount || 0; break;
      case 'movies':           current = stats.movies || 0; break;
      case 'completed':        current = stats.completed || 0; break;
      case 'plex':             current = stats.plex ? 1 : 0; break;
      case 'friends':          current = stats.friends || stats.friendsCount || 0; break;
      case 'ratings':          current = stats.ratings || stats.ratingsCount || 0; break;
      case 'reviews':          current = stats.reviews || 0; break;
      case 'shames_sent':      current = stats.shamesSent || 0; break;
      case 'watchlist':        current = stats.watchlist || stats.watchlistCount || 0; break;
      case 'matcher_sessions': current = stats.matcherSessions || 0; break;
      case 'episode_ratings':  current = stats.episodeRatings || 0; break;
    }
    const earned = current >= badge.requirement;
    const progress = badge.requirement > 0 ? Math.min(100, (current / badge.requirement) * 100) : 0;
    return { ...badge, current, earned, progress };
  });
}

async function checkAndNotifyNewBadges() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const [stats, userDoc] = await Promise.all([
      Services.getUserStats(),
      db.collection('users').doc(uid).get()
    ]);
    const allBadges = calculateBadges(stats);
    const earned = allBadges.filter(b => b.earned);
    const storedIds = new Set(userDoc.data()?.earnedBadgeIds || []);
    const newlyEarned = earned.filter(b => !storedIds.has(b.id));
    if (newlyEarned.length) {
      newlyEarned.forEach((b, i) => setTimeout(() => UI.badgeToast(b), i * 900));
      const allIds = [...new Set([...storedIds, ...earned.map(b => b.id)])];
      await db.collection('users').doc(uid).update({ earnedBadgeIds: allIds });
    }
  } catch (_) {}
}
