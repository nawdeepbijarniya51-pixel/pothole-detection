import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, CameraOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfigPanel } from "@/components/ConfigPanel";
import { createLiveSocket } from "@/lib/api";

interface LiveCameraTabProps {
  modelReady: boolean;
}

export function LiveCameraTab({ modelReady }: LiveCameraTabProps) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [potholeCount, setPotholeCount] = useState(0);
  const [avgConf, setAvgConf] = useState(0);
  const [confidence, setConfidence] = useState(0.25);
  const [iou, setIou] = useState(0.45);
  const [maxDet, setMaxDet] = useState(50);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const sendingRef = useRef(false);

  const stopStream = useCallback(() => {
    setStreaming(false);
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    if (!modelReady) {
      setError("Please load a model first");
      return;
    }
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const ws = createLiveSocket(confidence, iou, maxDet);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          stopStream();
          return;
        }
        const img = new Image();
        img.onload = () => {
          const canvas = resultCanvasRef.current;
          if (canvas) {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d")?.drawImage(img, 0, 0);
          }
        };
        img.src = `data:image/jpeg;base64,${data.frame}`;
        setPotholeCount(data.pothole_count || 0);
        setAvgConf(data.avg_confidence || 0);

        const now = Date.now();
        frameTimesRef.current.push(now);
        frameTimesRef.current = frameTimesRef.current.filter((t) => now - t < 1000);
        setFps(frameTimesRef.current.length);

        sendingRef.current = false;
      };

      ws.onerror = () => {
        setError("WebSocket connection failed");
        stopStream();
      };

      ws.onopen = () => {
        setStreaming(true);
        const sendFrame = () => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          if (sendingRef.current) {
            requestAnimationFrame(sendFrame);
            return;
          }
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            const base64 = dataUrl.split(",")[1];
            wsRef.current?.send(JSON.stringify({ frame: base64, conf: confidence, iou, max_det: maxDet }));
            sendingRef.current = true;
          }
          requestAnimationFrame(sendFrame);
        };
        requestAnimationFrame(sendFrame);
      };
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Please allow camera access.");
      } else {
        setError(e.message || "Failed to start camera");
      }
    }
  }, [modelReady, confidence, iou, maxDet, stopStream]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-lg font-bold text-primary glow-yellow">
          📷 Live Camera
        </h2>
        <Button
          onClick={streaming ? stopStream : startStream}
          variant={streaming ? "destructive" : "default"}
          className={streaming ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}
        >
          {streaming ? (
            <><CameraOff className="h-4 w-4 mr-2" /> Stop</>
          ) : (
            <><Camera className="h-4 w-4 mr-2" /> Start Live Detection</>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-md border border-border bg-card overflow-hidden aspect-video">
            {!streaming ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-2">
                  <Camera className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Camera feed will appear here</p>
                </div>
              </div>
            ) : (
              <>
                <canvas ref={resultCanvasRef} className="w-full h-full object-contain" />
                {/* Stats overlay */}
                <div className="absolute top-3 left-3 flex gap-2">
                  {[
                    { label: "FPS", value: fps },
                    { label: "Potholes", value: potholeCount },
                    { label: "Conf", value: `${(avgConf * 100).toFixed(0)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-sm bg-background/80 backdrop-blur-sm px-2 py-1">
                      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
                      <p className="font-mono text-xs text-primary font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-sm bg-destructive/80 px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-foreground animate-pulse-glow" />
                  <span className="font-mono text-[10px] text-foreground uppercase">Live</span>
                </div>
              </>
            )}
          </div>

          {/* Hidden elements for capture */}
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="space-y-4">
          <ConfigPanel
            confidence={confidence}
            iou={iou}
            maxDetections={maxDet}
            onConfidenceChange={setConfidence}
            onIouChange={setIou}
            onMaxDetChange={setMaxDet}
          />
        </div>
      </div>
    </div>
  );
}
