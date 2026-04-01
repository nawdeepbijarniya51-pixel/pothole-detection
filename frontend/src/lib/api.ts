const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface ModelInfo {
  name: string;
  num_classes: number;
  input_size: number;
  classes: string[];
}

export interface Detection {
  confidence: number;
  area_pct: number;
  severity: "small" | "medium" | "large";
}

export interface DetectionResult {
  annotated_image: string; // base64
  detections: Detection[];
  pothole_count: number;
  avg_confidence: number;
  total_mask_area_pct: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  mode: "image" | "video" | "live";
  potholes_found: number;
  avg_confidence: number;
  severity: string;
}

export async function uploadModel(file: File): Promise<ModelInfo> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload-model`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getModelInfo(): Promise<ModelInfo | null> {
  const res = await fetch(`${API_BASE}/model-info`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function detectImage(
  file: File,
  conf: number,
  iou: number,
  maxDet: number
): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("conf", conf.toString());
  formData.append("iou", iou.toString());
  formData.append("max_det", maxDet.toString());
  const res = await fetch(`${API_BASE}/detect/image`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function detectVideo(
  file: File,
  conf: number,
  iou: number,
  maxDet: number
): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("conf", conf.toString());
  formData.append("iou", iou.toString());
  formData.append("max_det", maxDet.toString());
  const res = await fetch(`${API_BASE}/detect/video/start`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getVideoStatus(jobId: string): Promise<{
  status: "processing" | "done" | "error";
  progress: number;
  processed_frames: number;
  total_frames: number;
  error?: string;
  summary?: { potholes_found: number; avg_confidence: number; severity: string };
}> {
  const res = await fetch(`${API_BASE}/detect/video/status/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getVideoStats(jobId: string): Promise<{
  stats: Detection[][];
  summary?: { potholes_found: number; avg_confidence: number; severity: string };
}> {
  const res = await fetch(`${API_BASE}/detect/video/stats/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getVideoResultBlob(jobId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/detect/video/result/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

export function createLiveSocket(conf: number, iou: number, maxDet: number): WebSocket {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/detect/live?conf=${conf}&iou=${iou}&max_det=${maxDet}`);
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_BASE}/history`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function exportHistoryCSV(entries: HistoryEntry[]): string {
  const header = "Timestamp,Mode,Potholes Found,Avg Confidence,Severity\n";
  const rows = entries.map(
    (e) => `${e.timestamp},${e.mode},${e.potholes_found},${e.avg_confidence.toFixed(2)},${e.severity}`
  );
  return header + rows.join("\n");
}
