# Progressive Web App (PWA) Installation Guide

**Project:** Kinteba Guush Family Genealogy (`ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ`)  
**Application Type:** Installable Progressive Web Application (PWA)  
**Supported Platforms:** Android, iOS (iPhone/iPad), Windows, macOS, Linux  

---

## 1. Overview

The **Kinteba Guush Family Genealogy** application is configured as a standalone Progressive Web App (PWA). It can be installed directly from modern web browsers onto mobile home screens and desktop application menus without requiring Google Play or Apple App Store downloads.

### Benefits of Installing:
- **Instant Full-Screen Experience:** Runs without browser navigation bars or URL bars.
- **Offline Reliability:** Pre-cached application shell allows viewing the tree and directory even when offline or traveling with limited connectivity.
- **Fast Startup:** Cached assets launch immediately on mobile devices.
- **Zero Cost:** Free and requires no subscriptions.

---

## 2. Installation on Android (Phones & Tablets)

1. Open **Google Chrome** (or Edge / Samsung Internet) on your Android device.
2. Navigate to the website URL (e.g., `https://kinteba-guush-genealogy.netlify.app` or your local development URL).
3. A banner will appear at the bottom of the screen:  
   **"ኣብ ሞባይልኩም ኣእትዉ (Install App) — ንቕልጡፍ ምጥቃምን ብዘይ ኢንተርኔት ንምርኣይን"**
4. Tap the **"Install"** button on the banner.
5. Alternatively, tap the browser's three-dot menu (**⋮**) in the top right corner and select:  
   **"Install app"** or **"Add to Home screen"**.
6. Confirm by tapping **"Install"**.
7. The golden **ጉ** icon will appear on your phone's home screen and app drawer.

---

## 3. Installation on iPhone & iPad (iOS Safari)

Apple iOS devices require using Safari to install Progressive Web Apps:

1. Open **Safari** on your iPhone or iPad.
2. Navigate to the website URL.
3. Tap the **Share** button at the bottom of the screen (the square icon with an arrow pointing upward).
4. Scroll down in the share sheet and tap:  
   **"Add to Home Screen"** (`ናብ ዋና ገጽ ወስኽ`).
5. In the top right corner, tap **"Add"**.
6. The Kinteba Guush icon will now appear on your iPhone home screen. When launched from this icon, the app opens as a standalone full-screen application.

---

## 4. Installation on Windows & macOS Desktops

1. Open **Google Chrome** or **Microsoft Edge**.
2. Visit the website URL.
3. Look for the **Install App** icon in the browser address bar (an icon resembling a computer monitor with a down arrow, or an install badge).
4. Click **Install**.
5. The application will launch in its own dedicated desktop window and appear in your Windows Start Menu / macOS Launchpad.

---

## 5. Offline Capabilities & Limitations

- **What works offline:**
  - The entire user interface, navigation, family explorer, search, and directory.
  - All genealogical records currently cached in local IndexedDB storage.
- **What requires an active internet connection:**
  - Communicating with the remote Rust backend API (if hosted in cloud mode).
  - Syncing new edits across multiple devices.

