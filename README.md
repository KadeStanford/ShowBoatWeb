# ShowBoard Web

A movie and TV show tracker built as a Progressive Web App. Browse trending content from TMDB, search for movies and shows, view full details with genre-based theming, and monitor your Plex server's active sessions.

## Features

- **Trending Carousel** — Auto-rotating showcase of today's trending movies & TV shows
- **Discover** — Search TMDB for movies and TV shows with type filtering
- **Details** — Full media pages with backdrop art, genre-based color theming, cast, seasons/episodes (TV), and box office data (movies)
- **Plex Activity** — View active streaming sessions from your Plex Media Server
- **Settings** — Configure your Plex server connection
- **PWA** — Install on your home screen for an app-like experience
- **Capacitor-Ready** — Hash-based routing and localStorage make it easy to wrap as a native iOS/Android app

## Getting Started

This is a static site — no build step required.

1. Clone the repo
2. Serve it with any static server:
   ```bash
   npx serve .
   ```
3. Open `http://localhost:3000`

## Plex Setup

1. Go to **Settings** in the app
2. Enter your Plex server URL (e.g. `http://192.168.1.50:32400`)
3. Enter your Plex token (find it in Plex Web App network requests as `X-Plex-Token`)
4. Save — the Activity tab will now show active sessions

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES6+)
- TMDB API for movie & TV data
- Plex API for streaming session monitoring  
- PWA with service worker for offline support
- No frameworks, no build tools, no dependencies

## Future: Native App

The app is designed for easy wrapping with [Capacitor](https://capacitorjs.com/):

```bash
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init ShowBoard com.showboard.app --web-dir .
npx cap add ios
npx cap add android
npx cap sync
```

## License

MIT
