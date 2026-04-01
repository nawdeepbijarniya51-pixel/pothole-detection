import { useState, useEffect } from "react";
import { Wrench, Image, Camera, BarChart3, Circle } from "lucide-react";
import { SetupTab } from "@/components/SetupTab";
import { DetectionTab } from "@/components/DetectionTab";
import { LiveCameraTab } from "@/components/LiveCameraTab";
import { ResultsTab } from "@/components/ResultsTab";
import { getModelInfo, type ModelInfo } from "@/lib/api";

const tabs = [
  { id: "setup", label: "Setup", icon: Wrench },
  { id: "detect", label: "Detection", icon: Image },
  { id: "live", label: "Live Camera", icon: Camera },
  { id: "results", label: "Results", icon: BarChart3 },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  useEffect(() => {
    // Check if a model is already loaded in the backend
    getModelInfo()
      .then((info) => {
        if (info) {
          setModelInfo(info);
          // If model is already loaded, we can switch to detection tab
          // but maybe better to stay on setup to show it's loaded
        }
      })
      .catch((err) => console.error("Failed to fetch model info:", err));
  }, []);

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <Circle className="h-5 w-5 text-primary-foreground" fill="currentColor" />
            </div>
            <div>
              <h1 className="font-mono text-base font-bold text-foreground tracking-tight">
                POTHOLE<span className="text-primary">VISION</span>
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                AI Segmentation System
              </p>
            </div>
          </div>
          {modelInfo && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-sm border border-neon-green/30 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse-glow" />
              <span className="font-mono text-[10px] text-neon-green uppercase tracking-wider">
                {modelInfo.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-border bg-card/50">
        <div className="container flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="container py-6">
        {activeTab === "setup" && (
          <SetupTab modelInfo={modelInfo} onModelLoaded={setModelInfo} />
        )}
        {activeTab === "detect" && (
          <DetectionTab modelReady={!!modelInfo} />
        )}
        {activeTab === "live" && (
          <LiveCameraTab modelReady={!!modelInfo} />
        )}
        {activeTab === "results" && <ResultsTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="container text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            PotholeVision • YOLOv8 Segmentation • v1.0
          </p>
        </div>
      </footer>
    </div>
  );
}
