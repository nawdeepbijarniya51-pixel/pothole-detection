"""
PotholeVision - FastAPI Backend
================================
Run: pip install fastapi uvicorn ultralytics python-multipart opencv-python-headless numpy
Then: uvicorn potholevision_backend:app --host 0.0.0.0 --port 8000 --reload
"""

import io
import uuid
import base64
import tempfile
import time
from datetime import datetime
from typing import Optional, Dict, Any
import asyncio
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import os
import logging
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("potholevision")

app = FastAPI(title="PotholeVision API", version="1.0.0")

def _parse_allowed_origins() -> list[str]:
    """
    Comma-separated list of allowed origins for CORS.
    Example:
      POTHOLEVISION_ALLOWED_ORIGINS=https://your-site.netlify.app,https://your-custom-domain.com
    """
    raw = os.getenv("POTHOLEVISION_ALLOWED_ORIGINS", "").strip()
    if not raw:
        # Dev-friendly default; set env var in production.
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
model = None
model_info = None
detection_history = []
video_jobs: Dict[str, Dict[str, Any]] = {}
executor = ThreadPoolExecutor(max_workers=1)

VIDEO_JOB_TTL_S = 60 * 30  # 30 minutes


def load_model(path: str, filename: str):
    global model, model_info
    try:
        from ultralytics import YOLO
        logger.info(f"Loading model from {path}...")
        model = YOLO(path)
        names = model.names if hasattr(model, "names") else {}
        model_info = {
            "name": filename,
            "num_classes": len(names),
            "input_size": 640,
            "classes": list(names.values()) if isinstance(names, dict) else list(names),
        }
        logger.info(f"Successfully loaded model: {filename}")
    except Exception as e:
        logger.error(f"Failed to load model {filename}: {str(e)}")
        raise e


# Load default model if exists
DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")
if os.path.exists(DEFAULT_MODEL_PATH):
    try:
        load_model(DEFAULT_MODEL_PATH, "best.pt")
    except Exception as e:
        logger.warning(f"Default model loading skipped: {e}")


def classify_severity(area_pct: float) -> str:
    if area_pct < 5:
        return "small"
    elif area_pct < 15:
        return "medium"
    return "large"

def _severity_rank(s: str) -> int:
    return {"small": 0, "medium": 1, "large": 2}.get(s, 0)


def run_segmentation(frame_bgr, conf=0.25, iou=0.45, max_det=50):
    if model is None:
        raise RuntimeError("No model loaded")
    results = model(frame_bgr, conf=conf, iou=iou, max_det=max_det, task="segment")[0]
    annotated = results.plot()
    detections = []
    if results.masks is not None:
        for i, mask in enumerate(results.masks.data):
            c = float(results.boxes.conf[i])
            area = float(mask.sum()) / (mask.shape[0] * mask.shape[1]) * 100
            detections.append({
                "confidence": c,
                "area_pct": area,
                "severity": classify_severity(area),
            })
    return annotated, detections


def _cleanup_expired_video_jobs():
    now = time.time()
    expired = []
    for job_id, job in video_jobs.items():
        updated_at = job.get("updated_at", now)
        if now - updated_at > VIDEO_JOB_TTL_S:
            expired.append(job_id)
    for job_id in expired:
        job = video_jobs.pop(job_id, None)
        if not job:
            continue
        for p in [job.get("input_path"), job.get("output_path")]:
            try:
                if p and os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass


@app.post("/upload-model")
async def upload_model(file: UploadFile = File(...)):
    if not file.filename.endswith(".pt"):
        raise HTTPException(400, "Only .pt files are supported")
    
    try:
        with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        load_model(tmp_path, file.filename)
        return model_info
    except Exception as e:
        logger.error(f"Error in upload-model: {str(e)}")
        raise HTTPException(500, f"Failed to load model: {str(e)}")


@app.get("/model-info")
async def get_model_info():
    if model_info is None:
        raise HTTPException(404, "No model loaded")
    return model_info


@app.post("/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(50),
):
    if model is None:
        raise HTTPException(400, "No model loaded")
    
    content = await file.read()
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image")
    
    annotated, detections = run_segmentation(img, conf, iou, max_det)
    
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])
    b64 = base64.b64encode(buffer).decode()
    
    avg_conf = sum(d["confidence"] for d in detections) / len(detections) if detections else 0
    total_area = sum(d["area_pct"] for d in detections)
    max_sev = max((d["severity"] for d in detections), default="small",
                  key=lambda s: {"small": 0, "medium": 1, "large": 2}[s])
    
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "mode": "image",
        "potholes_found": len(detections),
        "avg_confidence": avg_conf,
        "severity": max_sev,
    }
    detection_history.append(entry)
    
    return {
        "annotated_image": b64,
        "detections": detections,
        "pothole_count": len(detections),
        "avg_confidence": avg_conf,
        "total_mask_area_pct": total_area,
    }


@app.post("/detect/video")
async def detect_video(
    file: UploadFile = File(...),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
):
    if model is None:
        raise HTTPException(400, "No model loaded")
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        input_path = tmp.name
    
    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    output_path = tempfile.mktemp(suffix=".mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))
    
    all_stats = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        annotated, detections = run_segmentation(frame, conf)
        out.write(annotated)
        all_stats.append(detections)
    
    cap.release()
    out.release()
    
    with open(output_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode()
    
    total_potholes = sum(len(s) for s in all_stats)
    avg_conf = 0
    all_dets = [d for frame in all_stats for d in frame]
    if all_dets:
        avg_conf = sum(d["confidence"] for d in all_dets) / len(all_dets)
    
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "mode": "video",
        "potholes_found": total_potholes,
        "avg_confidence": avg_conf,
        "severity": "medium",
    }
    detection_history.append(entry)
    
    return {"video_url": f"data:video/mp4;base64,{video_b64}", "stats": all_stats}


def _process_video_job(job_id: str, input_path: str, conf: float, iou: float, max_det: int):
    try:
        cap = cv2.VideoCapture(input_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        output_path = tempfile.mktemp(suffix=".mp4")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

        all_stats = []
        processed = 0
        max_sev = "small"
        conf_sum = 0.0
        det_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            annotated, detections = run_segmentation(frame, conf, iou, max_det)
            out.write(annotated)
            all_stats.append(detections)
            processed += 1

            for d in detections:
                conf_sum += float(d["confidence"])
                det_count += 1
                if _severity_rank(d["severity"]) > _severity_rank(max_sev):
                    max_sev = d["severity"]

            pct = int((processed / total_frames) * 100) if total_frames > 0 else 0
            video_jobs[job_id].update(
                {
                    "progress": min(99, pct),
                    "processed_frames": processed,
                    "total_frames": total_frames,
                    "updated_at": time.time(),
                }
            )

        cap.release()
        out.release()

        avg_conf = (conf_sum / det_count) if det_count else 0.0
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "mode": "video",
            "potholes_found": det_count,
            "avg_confidence": avg_conf,
            "severity": max_sev,
        }
        detection_history.append(entry)

        video_jobs[job_id].update(
            {
                "status": "done",
                "progress": 100,
                "output_path": output_path,
                "stats": all_stats,
                "summary": {
                    "potholes_found": det_count,
                    "avg_confidence": avg_conf,
                    "severity": max_sev,
                },
                "updated_at": time.time(),
            }
        )
    except Exception as e:
        logger.exception("Video job failed")
        video_jobs[job_id].update(
            {
                "status": "error",
                "error": str(e),
                "updated_at": time.time(),
            }
        )


@app.post("/detect/video/start")
async def start_detect_video(
    file: UploadFile = File(...),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
    max_det: int = Form(50),
):
    if model is None:
        raise HTTPException(400, "No model loaded")

    _cleanup_expired_video_jobs()

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        input_path = tmp.name

    job_id = str(uuid.uuid4())
    video_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "created_at": time.time(),
        "updated_at": time.time(),
        "input_path": input_path,
    }

    loop = asyncio.get_running_loop()
    loop.run_in_executor(executor, _process_video_job, job_id, input_path, conf, iou, max_det)

    return {"job_id": job_id}


@app.get("/detect/video/status/{job_id}")
async def get_video_status(job_id: str):
    job = video_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job_id")
    if job.get("status") == "error":
        return {"status": "error", "progress": job.get("progress", 0), "error": job.get("error")}
    return {
        "status": job.get("status", "processing"),
        "progress": int(job.get("progress", 0)),
        "processed_frames": int(job.get("processed_frames", 0)),
        "total_frames": int(job.get("total_frames", 0)),
        "summary": job.get("summary"),
    }


@app.get("/detect/video/result/{job_id}")
async def get_video_result(job_id: str):
    job = video_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job_id")
    if job.get("status") != "done":
        raise HTTPException(409, "Job not complete")
    output_path = job.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(404, "Output missing")
    return FileResponse(output_path, media_type="video/mp4", filename="potholevision_annotated.mp4")


@app.get("/detect/video/stats/{job_id}")
async def get_video_stats(job_id: str):
    job = video_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job_id")
    if job.get("status") != "done":
        raise HTTPException(409, "Job not complete")
    return {"stats": job.get("stats", []), "summary": job.get("summary")}


@app.websocket("/detect/live")
async def detect_live(websocket: WebSocket, conf: float = 0.25, iou: float = 0.45):
    await websocket.accept()
    if model is None:
        await websocket.send_json({"error": "No model loaded"})
        await websocket.close()
        return
    
    live_frames = 0
    live_det_sum = 0
    live_conf_sum = 0.0
    live_conf_count = 0
    live_max_sev = "small"

    try:
        while True:
            data = await websocket.receive_json()
            frame_b64 = data.get("frame", "")
            conf_ = float(data.get("conf", conf))
            iou_ = float(data.get("iou", iou))
            max_det_ = int(data.get("max_det", 50))
            
            img_bytes = base64.b64decode(frame_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                continue
            
            annotated, detections = run_segmentation(frame, conf_, iou_, max_det_)
            _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
            result_b64 = base64.b64encode(buffer).decode()
            
            avg_conf = sum(d["confidence"] for d in detections) / len(detections) if detections else 0

            live_frames += 1
            live_det_sum += len(detections)
            for d in detections:
                live_conf_sum += float(d["confidence"])
                live_conf_count += 1
                if _severity_rank(d["severity"]) > _severity_rank(live_max_sev):
                    live_max_sev = d["severity"]
            
            await websocket.send_json({
                "frame": result_b64,
                "pothole_count": len(detections),
                "avg_confidence": avg_conf,
                "detections": detections,
            })
    except WebSocketDisconnect:
        avg_conf_all = (live_conf_sum / live_conf_count) if live_conf_count else 0.0
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "mode": "live",
            "potholes_found": live_det_sum,
            "avg_confidence": avg_conf_all,
            "severity": live_max_sev,
        }
        detection_history.append(entry)


@app.get("/history")
async def get_history():
    return detection_history


@app.get("/health")
async def health():
    return {
        "ok": True,
        "model_loaded": model_info is not None,
        "model_name": (model_info or {}).get("name"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
