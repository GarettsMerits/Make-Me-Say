# Frontend

React 19 single-page app for Don't Make Me Say, created with Create React App (`react-scripts` 5).

Product and design documentation is in the repository root: [README](../README.md) and [Documentation/](../Documentation/Overview.md).

## Scripts

From this directory:

| Command | Effect |
|---|---|
| `npm start` | Dev server at http://localhost:3000. The API base URL is `REACT_APP_BACKEND_URL`, or `http://localhost:3001` if that variable is unset. |
| `npm test` | Jest in watch mode. `src/App.test.tsx` checks that the passphrase gate renders. |
| `npm run build` | Production build in `build/`. |
| `npm run eject` | One-way escape hatch for Create React App. Not required for this project. |

The dev server does not proxy `/api`. The browser calls the backend origin directly with `credentials: 'include'`, and the backend CORS config must allow `http://localhost:3000`. A Create React App proxy would buffer the chat stream.

## Layout

```
src/
  App.tsx                 Passphrase gate, then MainApplication
  components/             Pages and chat/leaderboard UI
  hooks/useChatLogic.ts   Target word, streaming turns, win rehydration
  hooks/useBottomBar.ts   Composer, victory flow, score submit
  store/                  Zustand: game session and UI preferences
  styles/chatLayout.ts    Shared column widths and bar height
  utils/api/              HTTP and SSE client
  utils/tokenCounter.ts   Client-side token estimate
```

Page changes do not use the URL. `currentPage` in the UI store selects Chat, How To Play, Leaderboard, or About, and Framer Motion slides between them.
