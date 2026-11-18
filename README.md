# 3D Model Viewer

A real-time WebGL 3D model and topographic relief viewer built with **React 19**, **Three.js**, **TypeScript**, **Tailwind CSS**, and **Vite**. Designed for inspecting `.glb` and `.gltf` 3D models with interactive orbit controls, dynamic Z-axis elevation exaggeration, real-time water level / flood simulation, and geospatial coordinate inspection.

---

## Features

### 1. Real-Time 3D Model Loading (`.glb` & `.gltf`)
- **File Upload & Drag-and-Drop**: Open binary (`.glb`) or ASCII (`.gltf`) 3D models via the toolbar button or by dragging and dropping files directly onto the 3D viewport.
- **Default Procedural Topographic Model**: Boots with a detailed procedural 3D relief model of Haryana featuring 8 discrete hypsometric elevation color bands (from 180 m to 1,467 m ASL).
- **Automatic Camera Framing**: Dynamically computes bounding box dimensions and fits any loaded 3D model smoothly inside the camera frustum.
- **Loading Progress & Validation**: Displays real-time loading progress and clear error alerts for unsupported file extensions or corrupted assets.

### 2. Interactive Orbit, Pan & Zoom Controls
- **Orbit Camera**: Left-click + drag to rotate around the target model.
- **Pan Camera**: Right-click + drag (or Shift + drag) to pan across the scene.
- **Smooth Damped Zoom**: Scroll wheel or pinch-to-zoom with damping enabled for precision inspection.
- **Quick Reset Actions**: Dedicated toolbar buttons to **Reset Camera** orientation or **Reset Model** back to default settings.

### 3. Real-Time Z-Axis Scale (Vertical Exaggeration)
- **Interactive Slider & Direct Numeric Input**: Adjust vertical relief scaling in real time while preserving horizontal X and Y proportions.
- **Customizable Min / Max Bounds**: Edit minimum and maximum slider bounds dynamically with built-in range validation (`Min < Max`, `> 0`) and automatic range expansion when typing custom scale values.
- **One-Click Scale Reset**: Instantly restore Z-axis scale to `1.0x`.

### 4. Water Level & Flood Simulation
- **Toggleable 3D Water Plane**: Enable or disable a semi-transparent 3D water surface plane across the terrain.
- **Elevation-Calibrated Level Control**: Adjust water height in meters Above Sea Level (`m ASL`) via slider or direct numeric input, synchronized 1:1 with the terrain's elevation datum and active Z-axis scale.
- **Configurable Min, Max & Step**: Customize minimum water level, maximum water level, and slider step increments with live validation.

### 5. Geospatial & Coordinate Inspection (Hover & Pin)
- **Live Raycast Inspection**: Hover over any point on the 3D model to view real-time coordinates and elevation in the **Information** panel.
- **Click-to-Pin Marker**: Click any location on the 3D terrain to drop a 3D marker pin and lock its telemetry in the control panel until cleared.
- **Detailed Point Readout**:
  - **Geo Coord**: Latitude and Longitude (`° N, ° E`).
  - **X, Y Coord**: Model-space horizontal coordinates.
  - **Elevation**: Unscaled elevation in meters Above Sea Level (`m`).

### 6. High-Resolution Screenshot Export
- **Capture PNG**: Export the current 3D WebGL viewport as a crisp PNG image (`Capture PNG` button in the top toolbar).

---

## Tech Stack

- **Frontend Framework**: React 19 + TypeScript
- **3D Rendering**: Three.js (`GLTFLoader`, `OrbitControls`, WebGLRenderer)
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Build Tool**: Vite

---

## Getting Started

### Prerequisites
- **Node.js** v20 or later
- **npm**

### Installation

```bash
npm install --legacy-peer-deps
```

### Run Development Server

```bash
npm run dev
```

The development server starts on `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

Production assets are output to the `./dist` directory with relative asset paths (`base: './'`) for compatibility with GitHub Pages.

---

## Deployment to GitHub Pages

This project includes a pre-configured GitHub Actions workflow at `.github/workflows/deploy.yml`:

1. Push your repository to GitHub with your default branch named `main`.
2. In your GitHub repository, navigate to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Any push to `main` (or manual trigger from the **Actions** tab) will automatically install dependencies with `npm install --legacy-peer-deps`, build the Vite bundle, and deploy `./dist` using `actions/deploy-pages@v4`.
