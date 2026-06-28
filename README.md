<!-- AbdoBest README -->
<a name="top"></a>

<p align="center">
  <img src="https://github.com/user-attachments/assets/cbc40f5a-cc1f-4e85-9642-04f81dc2b65e" alt="AbdoBest Banner" width="140" style="border-radius:28px">
</p>

<h1 align="center">🎬 AbdoBest – Arabic Streaming App for Android</h1>

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
  <img src="https://img.shields.io/badge/Platform-Android%207.0%2B-green" alt="Platform">
  <img src="https://img.shields.io/badge/Size-~24%20MB-blue" alt="Size">
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="License">
  <img src="https://img.shields.io/badge/Built%20with-React%20Native-61DAFB?logo=react" alt="React Native">
</p>

---

## 🔥 What is AbdoBest?

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
✅ **24 MB APK** — installs fast even on slow connections.

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

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎬 **Content Library** | Movies, series, anime, TV shows — all on demand, constantly updated. |
| 📺 **Episode Indexer** | Full season and episode browser with duration and episode counts. |
| 🎛️ **Smart Player** | Quality switching (1080p → 360p), full playback controls, resume support. |
| 📥 **Offline Downloads** | Download individual episodes or bulk-download full series. |
| 🔍 **Advanced Search** | Filter by title, genre, year, country, or quality. |
| 🌓 **Dark & Light Theme** | Full theme switching with RTL layout support. |
| 🌐 **Bilingual** | Arabic and English UI — switch in Settings. |
| ⭐ **MAL Ratings** | Anime entries show MyAnimeList ratings. |
| 🔄 **Auto-Update** | The app notifies you when a new version is available. |
| 📦 **Tiny APK** | Only 24 MB — fast to download on any connection. |

---

## 📱 Screenshots

<div align="center">
  <img src="https://github.com/user-attachments/assets/cbc40f5a-cc1f-4e85-9642-04f81dc2b65e" width="200" alt="Home"/>
  &nbsp;
  <!-- <img src="SCREENSHOT_URL" width="200" alt="Details"/> -->
  <!-- <img src="SCREENSHOT_URL" width="200" alt="Player"/> -->
  <!-- <img src="SCREENSHOT_URL" width="200" alt="Search"/> -->
</div>

---

## 🧠 How It Works

AbdoBest is built on **React Native** and communicates with a backend API that indexes and serves content metadata.

- **Content loading** — the app fetches category data and caches it locally so subsequent loads are instant (no re-downloading 13,000+ items on every launch).
- **Streaming** — video URLs are resolved at play time, with quality options extracted from the source before playback begins.
- **Downloads** — powered by `react-native-background-downloader`, queued per episode, with pause/resume/retry support and group tracking for series.
- **Updates** — on launch the app silently checks the GitHub Releases API. If a newer version exists, a non-blocking modal appears with the changelog.
- **Bilingual** — handled by `i18next` with full RTL layout switching via React Native's built-in RTL APIs.

---

## ⚙️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React Native** + TypeScript | Cross-platform core |
| **React Navigation** | Tab & stack routing |
| **AsyncStorage** | Settings & local cache |
| **react-native-fast-image** | Performant image loading |
| **react-native-background-downloader** | Queued episode downloads |
| **i18next** | Arabic / English i18n + RTL |
| **Axios** | API requests |

---

## 📈 Roadmap

**Current version:** `v1.1.9`

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
- **EEA/UK users** — a GDPR-compliant consent banner appears on first launch (IAB TCF v2). Change preferences anytime in Settings.
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
