# ShowBoat Web

A web port of the ShowBoat React Native app — your personal media tracker.

## Features

- **Discover** — Search and browse trending movies & TV shows via TMDB
- **Watchlist** — Save shows/movies to watch later
- **Watch Tracking** — Mark shows/movies as watched with episode-level granularity
- **Ratings** — Rate what you've watched on a 0-10 scale
- **Friends** — Find and add friends, see their activity
- **Wall of Shame** — Shame friends for not watching your recommendations
- **Movie Night Matcher** — Swipe-based matching to find what both you and a friend want to watch
- **Shared Lists** — Create collaborative watch lists
- **Analytics** — View your watching stats, genre breakdown, and monthly activity
- **Badges** — Earn 17 achievement badges for your watching habits
- **Plex Integration** — Connect your Plex server to sync watch history
- **PWA** — Installable as a Progressive Web App on any device

## Tech Stack

- **Vanilla JavaScript** SPA with hash-based routing
- **Firebase** (Auth + Firestore + Storage) via CDN compat SDK
- **TMDB API** for media data
- **Plex API** for server integration
- **Service Worker** for offline support and caching

## Setup

1. Serve via any static file server (e.g., VS Code Live Server, `npx serve`, GitHub Pages)
2. Open in browser
3. Sign up or log in

## Firebase

Uses the same Firestore backend as the mobile app — any data entered here is shared with the React Native version.

## Compatibility

Designed as a web-first SPA that shares the same Firebase backend, making it compatible with the existing iOS/Android React Native app. Future native wrappers (Capacitor, etc.) can wrap this web app for App Store deployment.
