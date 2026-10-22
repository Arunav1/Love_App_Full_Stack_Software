# 💗 Kaveri's Universe

A little universe made with love, for Kaveri: a private home for our photos, videos, letters and dreams.

## Run it

```bash
cd kaveri-app
npm install          # first time only
npm run serve        # builds the app and starts it → http://localhost:4000
```

On the first start, every photo and video in the **My Dhunu** folder is imported automatically
(duplicates are skipped and your original files are never touched).

**On her phone:** connect to the same Wi-Fi and open the "on her phone" address printed in the
terminal (e.g. `http://192.168.x.x:4000`). In Safari/Chrome choose **Add to Home Screen** and it
opens like an app.

While working on the code: `npm run dev` → http://localhost:5173 (hot reload).

## Make it yours ✍️

| What | Where |
|---|---|
| Letters, "Open when…" letters, reasons, daily messages, miss-you replies, starter dreams | `server/content.js` |
| Her name, pet name, your name, **our special day**, **her birthday**, **our song** | ⚙️ Settings inside the app |

## 💘 Cupid – the AI companion

Cupid runs on [Groq](https://console.groq.com). The key lives in `kaveri-app/.env` (`GROQ_API_KEY`).
It is only ever used by the server and is never sent to the browser. Change the model with `GROQ_MODEL`.
Kaveri's chats are stored only in her own browser, not on the server.

## 🎵 Music & Spotify

Without any setup, search plays 30-second previews of almost any song. Songs uploaded to **Our Playlist**
play in full.

To let her connect **her Spotify account**:

1. Go to <https://developer.spotify.com/dashboard> → **Create app** (any name, e.g. "Kaveri's Universe").
   Under *Which API/SDKs*, tick **Web API** and **Web Playback SDK**.
2. Add these **Redirect URIs** (Spotify doesn't accept `localhost`, so use `127.0.0.1`):
   - `http://127.0.0.1:4000/spotify/callback`
   - `http://127.0.0.1:5173/spotify/callback` (only needed for `npm run dev`)
3. Under **User Management**, add the email address of her Spotify account. Apps in development mode only work for listed users.
4. Copy the app's **Client ID** into `.env` → `SPOTIFY_CLIENT_ID=...` and restart the server.
5. In the app: **Music → Connect Spotify**.

How songs play once she's connected:
- **Spotify Premium, on a computer:** full songs play right inside the app.
- **Premium, on a phone:** the app plays the song on her Spotify app. Phone browsers can't play Spotify inside a web page, so the Spotify app needs to be open.
- **Free account:** songs play in Spotify's own small player, which pops up in the app.

> Spotify only allows sign-in from `https://` addresses or `http://127.0.0.1`. To connect from her
> phone, the app needs an https address. You can deploy it somewhere, or use a tunnel such as
> `cloudflared tunnel --url http://localhost:4000`. Then add that `https://…/spotify/callback` URL as a redirect URI.

## 📸 Camera

**Camera** in the nav (or **Take a photo** in Memories) offers:
- 11 live filters with a strength slider
- frames: Polaroid, Hearts, Sparkles, Pink frame and Retro date
- 3s/10s timer and a 4-shot photo booth strip
- one tap to save the photo into Memories

Browsers only allow the **live** camera on `https://` or on the computer itself (`localhost`/`127.0.0.1`).
On her phone over Wi-Fi, the camera button opens her phone's own camera instead. Then she picks filters and frames in the app.
The same button can also add filters to any existing photo.

## Optional: a secret word

To lock the app so that only Kaveri can open it (useful if you put it online):

Set `ACCESS_CODE=dhunu` (and optionally `ACCESS_HINT`) in `.env`, then restart.

The word is not case-sensitive, and after she enters it once her browser remembers it for a year.

## Where things are stored

Everything lives in `server/data/`. That covers uploaded photos and videos, thumbnails, the song, and `db.json` (captions,
favourites, notes, dreams, settings). **Back up this folder** to keep the memories safe.
Deleting it resets the app, and the photos in the My Dhunu folder are imported again on the next start.

## Tech

React 19 + Vite · Three.js via React Three Fiber/Drei (particle heart, 3D memory universe) ·
Framer Motion · Groq (AI chat) · Spotify Web API + Web Playback SDK · Node.js + Express 5 · Multer (uploads) · Sharp (thumbnails) · Web Audio API (music box)
