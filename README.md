# 🛸 Drone Geo Inspector

> A professional web application for visualizing, inspecting, and managing drone survey imagery with GPS metadata — built for geospatial analysis and field inspection workflows.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 📸 Overview

Drone Geo Inspector extracts GPS EXIF metadata from drone photographs, plots each image as an accurate geospatial marker on an interactive satellite map, and synchronizes the map with a file manager sidebar — all in the browser with zero server required.

Designed for drone operators, GIS analysts, and infrastructure inspection teams who need to correlate aerial imagery with precise geographic locations.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📂 **Multi-Folder Upload** | Upload multiple drone flight folders simultaneously; each gets a unique color |
| 🗺 **Interactive Map** | Leaflet map with Google Satellite, Hybrid, Esri Imagery & OpenStreetMap layers |
| 📍 **Accurate Marker Placement** | Golden-angle spiral jitter offset separates GPS-duplicate images at high zoom |
| 🔍 **Smart Clustering** | Dynamic marker clusters with `flyToBounds` animation on cluster click |
| 🗂 **File Manager Sidebar** | Sticky folder headers with expandable image lists — fully synced with map |
| 🔗 **Bidirectional Sync** | Hover/click on map → highlights image in sidebar; click sidebar → flies to marker |
| 🖼 **Image Lightbox** | Full-screen image viewer with EXIF metadata, prev/next navigation, Esc to close |
| 🌡 **Type Filtering** | Filter all images, thermal only, or visual only |
| 📏 **Flight Path** | Toggle drone flight path polyline with total distance calculation |
| 📊 **Live Statistics** | Real-time folder count, point count, total images, and flight distance |
| 🌑 **Dark Theme** | Premium dark UI with glassmorphism cards and micro-animations |
| 💨 **Zero Backend** | 100% client-side — all processing happens in the browser via Web APIs |

---

## 🚀 Demo

```
Upload any folder of drone JPG/JPEG images with GPS EXIF data
→ Markers appear instantly on the satellite map
→ Click any marker to open its info card
→ Click any filename in the File Manager to fly to that location
```

> **Supported cameras:** DJI Phantom, DJI Mavic, DJI Mini, Autel, Parrot, and any camera producing GPS-tagged EXIF JPEGs.

---

## 🛠 Tech Stack

### Frontend
- **[React 18](https://react.dev/)** — Component-based UI with hooks
- **[TypeScript](https://www.typescriptlang.org/)** — Full type safety across the codebase
- **[Vite](https://vitejs.dev/)** — Lightning-fast dev server and production bundler

### Map & Geospatial
- **[Leaflet](https://leafletjs.com/)** — Interactive map rendering
- **[React-Leaflet](https://react-leaflet.js.org/)** — React bindings for Leaflet
- **[react-leaflet-cluster](https://github.com/yunsii/react-leaflet-cluster)** — Marker clustering with spiderfy support

### Data & State
- **[exifr](https://github.com/MikeKovarik/exifr)** — Client-side GPS EXIF extraction from JPEGs
- **[Zustand](https://github.com/pmndrs/zustand)** — Lightweight, scalable state management

### Styling
- **Vanilla CSS** — Custom design system with CSS variables, dark theme, glassmorphism

---

## 📁 Project Structure

```
drone-geo-inspector/
├── src/
│   ├── components/
│   │   ├── TopBar.tsx          # Upload, filter, statistics bar
│   │   ├── FileManager.tsx     # Sticky folder tree sidebar
│   │   ├── MapView.tsx         # Leaflet map with clustering & markers
│   │   ├── HoverCard.tsx       # Floating info card on marker hover
│   │   └── ImageLightbox.tsx   # Full-screen image viewer
│   ├── store/
│   │   └── useStore.ts         # Zustand global state
│   ├── types/
│   │   ├── ImageData.ts        # GPS image data model
│   │   └── FolderData.ts       # Folder collection model
│   ├── utils/
│   │   └── geoUtils.ts         # GPS math, distance, coordinate formatting
│   ├── App.tsx                 # Root layout
│   ├── main.tsx                # Entry point
│   └── index.css               # Full design system (CSS variables, components)
├── public/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repository
git clone https://github.com/Divyang9099/drone-geo-inspector.git
cd drone-geo-inspector

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📖 Usage

1. **Upload Folders** — Click `+ Add Folder` in the top bar and select a folder containing drone JPEGs
2. **Explore the Map** — Images appear as colored markers on the satellite map
3. **Click a Cluster** — Animates (`flyToBounds`) to show all markers in that group
4. **Hover a Marker** — Info card appears with thumbnail, coordinates, altitude, and folder
5. **Click a Marker / Sidebar Image** — Flies to zoom 21 (maximum satellite resolution) with animation; info card opens at the exact marker position
6. **Filter by Type** — Use `All / Thermal / Visual` buttons to filter the displayed images
7. **Toggle Flight Path** — Click `Path` to draw the drone's flight polyline with distance
8. **Full View** — Click `🖼 Full View` in the hover card to open the image in full-screen lightbox

---

## 🧠 Architecture Highlights

### GPS Jitter (Marker Overlap Prevention)
Drone cameras often capture burst images at the same GPS coordinate (meter-level precision). A **golden-angle spiral algorithm** offsets duplicate markers by ~2m per ring, ensuring every point is individually selectable at high zoom.

```ts
// Golden angle spiral: 8 points per ring, ~2m offset per ring
const angle  = i * 2.399963          // 137.5° golden angle
const ring   = Math.ceil(i / 8)
const radius = 0.000018 * ring        // ≈ 2m per ring in degrees
```

### Bidirectional Map ↔ Sidebar Sync
- **Map → Sidebar:** `mouseover` on marker → `setHoveredImage` → row highlighted in sidebar via `scrollIntoView`
- **Sidebar → Map:** Click image name → `setSelectedImage` (triggers `map.flyTo`) + `setPendingCard` → `PendingCardHandler` listens for `moveend` event → computes exact pixel position → opens hover card precisely beside the marker

### Hover Card Non-Blocking Design
The floating info card uses `pointer-events: none` on its container so it **never intercepts mouse events on the map**. Only interactive child elements (`✕` close, `🖼 Full View`) selectively re-enable `pointer-events: auto`.

---

## 🗺 Supported Map Layers

| Layer | Provider | Max Zoom |
|---|---|---|
| 🛰 Satellite | Google Maps | 21 |
| 🌐 Hybrid | Google Maps (with labels) | 21 |
| 🗺 World Imagery | Esri ArcGIS | 19 |
| 🏙 Street | OpenStreetMap | 19 |

---

## 🔒 Privacy

All data processing is **100% client-side**. No images, GPS data, or metadata are ever sent to any server. Files are read via the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) and processed entirely in the browser.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

---

## 📄 License

MIT © [Divyang](https://github.com/Divyang9099)

---

## 👨‍💻 Author

Built with ❤️ as part of a professional software engineering portfolio.

> *Demonstrating: React architecture, TypeScript, Geospatial data processing, State management (Zustand), Leaflet mapping, Client-side file APIs, and professional UI/UX design.*
