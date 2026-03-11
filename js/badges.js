/* ShowBoat — Badge Definitions & Calculator */
const BADGE_DEFS = [
  { id: 'binge_watcher', name: 'Binge Watcher', icon: '📺', desc: 'Watch 50 episodes', requirement: 50, type: 'episodes' },
  { id: 'series_regular', name: 'Series Regular', icon: '🎬', desc: 'Watch 100 episodes', requirement: 100, type: 'episodes' },
  { id: 'tv_addict', name: 'TV Addict', icon: '🤩', desc: 'Watch 500 episodes', requirement: 500, type: 'episodes' },
  { id: 'movie_buff', name: 'Movie Buff', icon: '🎥', desc: 'Watch 20 movies', requirement: 20, type: 'movies' },
  { id: 'cinephile', name: 'Cinephile', icon: '🎞️', desc: 'Watch 50 movies', requirement: 50, type: 'movies' },
  { id: 'film_historian', name: 'Film Historian', icon: '🏛️', desc: 'Watch 100 movies', requirement: 100, type: 'movies' },
  { id: 'dedicated', name: 'Dedicated', icon: '✅', desc: 'Complete 3 TV shows', requirement: 3, type: 'completed' },
  { id: 'finisher', name: 'Finisher', icon: '🏁', desc: 'Complete 10 TV shows', requirement: 10, type: 'completed' },
  { id: 'completionist', name: 'Completionist', icon: '🏆', desc: 'Complete 25 TV shows', requirement: 25, type: 'completed' },
  { id: 'connected', name: 'Connected', icon: '🔗', desc: 'Connect Plex account', requirement: 1, type: 'plex' },
  { id: 'friendly', name: 'Friendly', icon: '👋', desc: 'Add 1 friend', requirement: 1, type: 'friends' },
  { id: 'social_butterfly', name: 'Social Butterfly', icon: '🦋', desc: 'Add 5 friends', requirement: 5, type: 'friends' },
  { id: 'popular', name: 'Popular', icon: '⭐', desc: 'Add 10 friends', requirement: 10, type: 'friends' },
  { id: 'critic', name: 'Critic', icon: '📝', desc: 'Rate 5 titles', requirement: 5, type: 'ratings' },
  { id: 'expert_critic', name: 'Expert Critic', icon: '🎯', desc: 'Rate 20 titles', requirement: 20, type: 'ratings' },
  { id: 'reviewer', name: 'Reviewer', icon: '✍️', desc: 'Write 1 review', requirement: 1, type: 'reviews' },
  { id: 'opinionated', name: 'Opinionated', icon: '💬', desc: 'Write 10 reviews', requirement: 10, type: 'reviews' }
];

function calculateBadges(stats) {
  return BADGE_DEFS.map(badge => {
    let current = 0;
    switch (badge.type) {
      case 'episodes': current = stats.episodes || 0; break;
      case 'movies': current = stats.movies || 0; break;
      case 'completed': current = stats.completed || 0; break;
      case 'plex': current = stats.plex ? 1 : 0; break;
      case 'friends': current = stats.friends || 0; break;
      case 'ratings': current = stats.ratings || 0; break;
      case 'reviews': current = stats.reviews || 0; break;
    }
    return {
      ...badge,
      current,
      earned: current >= badge.requirement,
      progress: Math.min(1, current / badge.requirement)
    };
  });
}
