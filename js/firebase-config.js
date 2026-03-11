/* ShowBoat Firebase Configuration */
const firebaseConfig = {
  apiKey: 'AIzaSyCT4oD1M3e08RIxjUBzxC7iruohptIfHfQ',
  authDomain: 'showboat-f0980.firebaseapp.com',
  projectId: 'showboat-f0980',
  storageBucket: 'showboat-f0980.firebasestorage.app',
  messagingSenderId: '83507639188',
  appId: '1:83507639188:web:fee4d2f70b9e160c301581',
  measurementId: 'G-D1NZY7XQMY'
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable persistence for offline support
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
