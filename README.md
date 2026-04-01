# pothole-detection (PotholeVision)

AI-powered pothole detection and segmentation system using YOLOv8.

## Project Structure
- `backend/`: FastAPI server for YOLOv8 inference.
- `frontend/`: React + Vite + Tailwind CSS frontend.

## Getting Started

### 1. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   python -m uvicorn potholevision_backend:app --host 0.0.0.0 --port 8000 --reload
   ```
   The backend will be available at `http://localhost:8000`.
   API documentation is available at `http://localhost:8000/docs`.
   Health check is available at `http://localhost:8000/health`.

### 2. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the required Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at the URL printed by Vite (this project uses port 8080 by default).

## Deployment

### Frontend (Vercel)
- **Important:** Deploy only the **frontend** on Vercel. The FastAPI + YOLO backend must run on a host that supports Docker or long-running Python (e.g. Render, Railway, Fly.io, a VPS)—not as a typical Vercel serverless app.
- In Vercel: **Import** your Git repo → set **Root Directory** to `frontend`.
- **Framework Preset:** Vite (or Other with Build `npm run build`, Output `dist`).
- **Environment variable (Production + Preview):**
  - `VITE_API_URL` = `https://YOUR_BACKEND_DOMAIN` (no trailing slash)
- On your **backend**, set CORS to your Vercel URL:
  - `POTHOLEVISION_ALLOWED_ORIGINS=https://your-app.vercel.app`
  - If you use a custom domain, add that URL too (comma-separated).
- `frontend/vercel.json` includes SPA rewrites so React Router works on refresh.

### Frontend (Netlify)
- **Build settings**
  - Base directory: `frontend`
  - Build command: `npm run build`
  - Publish directory: `frontend/dist`
- **Environment variables**
  - `VITE_API_URL` = `https://YOUR_BACKEND_DOMAIN` (example: `https://potholevision-api.onrender.com`)

### Backend (Docker host: Render/Fly/Railway/VPS)
- A `backend/Dockerfile` is included.
- Set **CORS** in production:
  - `POTHOLEVISION_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN` (Vercel or Netlify URL)


## Features
- **Model Setup**: Automatically loads `best.pt` if present, or allows manual upload.
- **Image Detection**: Upload images to detect and segment potholes.
- **Video Detection**: Process video files for pothole detection.
- **Live Camera**: Real-time pothole detection using your webcam.
- **Results History**: View and export detection history.

## Technology Stack
- **Backend**: Python, FastAPI, YOLOv8 (Ultralytics), OpenCV.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI.
