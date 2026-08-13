<!-- AbdoBest README -->
<a name="top"></a>

<p align="center">
  <img src="https://github.com/user-attachments/assets/cbc40f5a-cc1f-4e85-9642-04f81dc2b65e" alt="AbdoBest Banner" width="140" style="border-radius:28px">
</p>

<h1 align="center">🎬 AbdoBest – Arabic Streaming App for Android & iOS</h1>

<p align="center">
  <strong>Movies, series, anime, and TV shows — free, bilingual, and built for Arabic audiences.</strong>
</p>

<p align="center">
  <a href="#-what-is-abdobest">About</a> •
  <a href="#-install">Install</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#%EF%B8%8F-tech-stack">Tech Stack</a> •
  <a href="#-support">Support</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/OGKushhh/AbdoBest?label=Latest%20Release&color=FF4500" alt="Release">
  <img src="https://img.shields.io/badge/Platform-Android%207.0%2B%20%7C%20iOS%2013.0%2B-green" alt="Platform">
  <img src="https://img.shields.io/badge/Size-~26%20MB-blue" alt="Size">
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="License">
  <img src="https://img.shields.io/badge/Built%20with-React%20Native-61DAFB?logo=react" alt="React Native">
  <img src="https://img.shields.io/github/downloads/OGKushhh/AbdoBest/total?color=FF4500&label=Downloads" alt="Downloads">
</p>
<p align="center">
<a href="https://ko-fi.com/abdobest"><img src="https://img.shields.io/badge/Ko--fi-Support%20Me-red?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
  
---

## 🔥 What is AbdoBest?

> 📱 **Now available for Android and iOS.**

AbdoBest is a **free Arabic streaming app** built with React Native. It aggregates movies, series, anime, and TV shows into one clean interface — with full Arabic and English support, RTL layout, and a player that actually works.

> **No subscription. No account. No nonsense.**  
> Download the APK, install it, and start watching in under 2 minutes.

### The Problem We Solve

- ❌ Arabic streaming apps are either paid, ad-heavy, or broken on newer devices.
- ❌ Most apps force you to create an account just to browse content.
- ❌ Quality switching and offline downloads are locked behind paywalls elsewhere.

### Our Solution

✅ **Completely free** — no subscription, no login, no paywall.  
✅ **Quality switching** — 1080p down to 360p, pick what your connection handles.  
✅ **Offline downloads** — save episodes and watch without internet.  
✅ **Bilingual** — full Arabic (RTL) and English UI, switch anytime.  
✅ **26 MB APK** — installs fast even on slow connections.

---

## 📥 Install

Get AbdoBest running on your Android device **in under 2 minutes**.

### 1. Download the APK

Grab the latest `.apk` from the [Releases](https://github.com/OGKushhh/AbdoBest/releases/latest) page.

### 2. Allow installation from unknown sources

Go to **Settings → Security** (or **Settings → Apps → Special app access**) and enable **"Install unknown apps"** for your browser or file manager.

> ⚠️ This is a standard Android requirement for any app installed outside the Play Store. You can disable it again after installation.

### 3. Install and launch

Open the downloaded `.apk`, tap **Install**, then open AbdoBest and start watching.

### 📱 iOS

AbdoBest also supports **iOS 13.0 and later**. Check the [Releases](https://github.com/OGKushhh/AbdoBest/releases/latest) page for the current iOS build/distribution method.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎬 **Content Library** | Movies, series, anime, TV shows — all on demand, constantly updated. |
| 📺 **Episode Indexer** | Full season and episode browser with duration and episode counts. |
| 🎛️ **Smart Player** | Quality switching (1080p → 360p), full playback controls, resume support. |
| 📥 **Offline Downloads** | Download individual episodes or bulk-download full series. |
| 🔍 **Advanced Search** | Filter by title, genre, year, country, or quality. |
| 🌐 **Bilingual** | Arabic and English UI with full RTL layout — switch in Settings. |
| ⭐ **MAL Ratings** | Anime entries show MyAnimeList ratings. |
| 🔄 **Auto-Update** | The app notifies you when a new version is available. |
| 📦 **Tiny APK** | Only 26 MB — fast to download on any connection. |

---

## 📱 Screenshots

<div align="center">
  <img height="400" alt="Home" src="https://github.com/user-attachments/assets/a7963db5-741b-45f7-9cba-01abb9597e46" />
  <img height="400" alt="Search" src="https://github.com/user-attachments/assets/3ef7de9a-7f20-4de4-8a7b-439dce577056" />
  <img height="400" alt="Details" src="https://github.com/user-attachments/assets/44fe88eb-1b62-43b8-86a5-44f4e723d8d3" />
  <img height="400" alt="Episodes" src="https://github.com/user-attachments/assets/bcfc9289-a0ac-4c97-8bb9-c3fa9606018b" />
  <img height="400" alt="Player" src="https://github.com/user-attachments/assets/18c94899-05c3-4436-9411-ac4565fb0f71" />
</div>

---

## 🧠 How It Works

AbdoBest is built on **React Native** and communicates with a backend API that indexes and serves content metadata.

- **Content loading** — the app fetches category data and caches it locally so subsequent loads are instant (no re-downloading 20,000+ items on every launch).
- **Streaming** — video URLs are resolved at play time, with quality options extracted from the source before playback begins.
- **Downloads** — powered by `react-native-background-downloader`, queued per episode, with pause/resume/retry support and group tracking for series.
- **Updates** — on launch the app silently checks the GitHub Releases API. If a newer version exists, a non-blocking modal appears with the changelog.
- **Bilingual** — handled by `i18next` with full RTL layout switching via React Native's built-in RTL APIs.

---

## ⚙️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React Native** + TypeScript | Cross-platform core (Android & iOS) |
| **React Navigation** (bottom-tabs, native-stack) | Tab & stack routing |
| **AsyncStorage** | Settings & local cache |
| **react-native-fast-image** | Performant image loading |
| **react-native-background-downloader** | Queued episode downloads |
| **react-native-video** | Video playback |
| **react-native-webview** | Embedded web content & source resolution |
| **react-native-blob-util** | File system & binary data handling |
| **i18next** + **react-i18next** | Arabic / English i18n + RTL |
| **Axios** | API requests |
| **Firebase** (App, Auth, Messaging) | Authentication & push notifications |
| **Google Sign-In** | Google account authentication |
| **react-native-linear-gradient** | Gradient UI elements |
| **react-native-orientation-locker** | Screen orientation control |
| **react-native-immersive-mode** | Fullscreen/immersive playback |
| **react-native-send-intent** | Native intent handling (Android) |
| **react-native-vector-icons** | Icon sets |

---

## 📈 Roadmap

**Current version:** <img src="https://img.shields.io/github/v/release/OGKushhh/AbdoBest?label=Latest%20Release&color=FF4500" alt="Release">

- [x] Offline download support
- [x] Performance overhaul
- [x] MAL ratings for anime
- [x] Season filter
- [x] Bulk episode downloads
- [ ] Backend optimizations (ongoing)
- [ ] More features based on user feedback

---

## 💰 Ads & Privacy

AbdoBest is **free**. To keep development going, the app shows non-intrusive ads.

- **Ad placements** — standard formats that don't interrupt playback.
- **No personal data** collected or stored by us. Our ad partner may use anonymized signals — see their privacy policy.
- **No account required** — ever.

→ [Privacy Policy](https://abdobest.netlify.app/Privacy.html)

---

## ☕ Support

AbdoBest is free, but not free to build. Server costs, API maintenance, and development time all take real effort.

If the app saves you a streaming subscription, consider buying us a coffee:

<p align="center">
  <a href="https://ko-fi.com/abdobest">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" width="220"/>
  </a>
</p>

Your support helps with:
- 🖥️ Server & API costs
- 🚀 New features and faster updates
- 🌍 Keeping the app free for everyone

---

## 💬 Contact & Links

- 🐛 **Bug reports / Feature requests** → [GitHub Issues](https://github.com/OGKushhh/AbdoBest/issues)
- 🌐 **Official website** → [abdobest.netlify.app](https://abdobest.netlify.app/)
- ☕ **Support the project** → [ko-fi.com/abdobest](https://ko-fi.com/abdobest)

---

## ⚖️ License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>AbdoBest</strong> – استمتع بأفضل تجربة مشاهدة عربية<br/>
  <sub>© 2026 AbdoBest. All rights reserved.</sub>
</p>

<p align="center">
  <a href="#top">⬆️ Back to top</a>
</p>
