// src/app/dashboard/_components/editors/ImageEditor.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, RotateCw, Crop, Save, Loader2, RefreshCw } from "lucide-react";
import { requireVaultKey, fetchAndDecrypt, encryptContentForUpdate } from "@/lib/crypto";

interface Props {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileKeyEnc: string;
  onSaved?: () => void;
}

export default function ImageEditor({ fileId, fileName, mimeType, fileKeyEnc, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100, enabled: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Load image blob
  useEffect(() => {
    setLoading(true);
    setRotation(0);
    setGrayscale(false);
    setCrop({ x: 0, y: 0, w: 100, h: 100, enabled: false });
    setMsg(null);
    (async () => {
      try {
        const vk = await requireVaultKey();
        const bytes = await fetchAndDecrypt(fileId, fileKeyEnc, vk);
        const blob = new Blob([bytes as BufferSource], { type: mimeType });
        setOriginalSrc(URL.createObjectURL(blob));
      } catch {
        setOriginalSrc(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (originalSrc) URL.revokeObjectURL(originalSrc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, fileKeyEnc]);

  // Draw to canvas whenever state changes
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalSrc) return;
    const img = new Image();
    img.onload = () => {
      const rad = (rotation * Math.PI) / 180;
      const swap = rotation === 90 || rotation === 270;
      const cw = swap ? img.height : img.width;
      const ch = swap ? img.width : img.height;
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d")!;
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      if (grayscale) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.data.length; i += 4) {
          const avg = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
          data.data[i] = data.data[i + 1] = data.data[i + 2] = avg;
        }
        ctx.putImageData(data, 0, 0);
      }
    };
    img.src = originalSrc;
  }, [originalSrc, rotation, grayscale]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const rotate = (dir: 1 | -1) => setRotation((r) => (r + dir * 90 + 360) % 360);

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const px = (v: number, total: number) => Math.round((v / 100) * total);
    const x = px(crop.x, canvas.width);
    const y = px(crop.y, canvas.height);
    const w = px(crop.w, canvas.width);
    const h = px(crop.h, canvas.height);
    const imgData = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(imgData, 0, 0);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setMsg(null);
    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      const vk = await requireVaultKey();
      const plain = await blob.arrayBuffer();
      const encBlob = await encryptContentForUpdate(plain, fileKeyEnc, vk);
      const fd = new FormData();
      fd.append("file", encBlob, `${fileName}.enc`);
      fd.append("sizeBytes", String(plain.byteLength));
      const res = await fetch(`/api/files/${fileId}/content`, { method: "PUT", body: fd });
      setSaving(false);
      if (res.ok) {
        setMsg({ text: "Image sauvegardée !", ok: true });
        onSaved?.();
      } else {
        setMsg({ text: "Erreur lors de la sauvegarde", ok: false });
      }
    }, mimeType, 0.92);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement...
      </div>
    );
  }

  if (!originalSrc) {
    return <div className="flex items-center justify-center h-full text-muted text-sm">Impossible de charger l&apos;image.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
        <button onClick={() => rotate(-1)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground bg-background border border-border rounded-md transition-all">
          <RotateCcw className="w-3.5 h-3.5" /> -90°
        </button>
        <button onClick={() => rotate(1)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground bg-background border border-border rounded-md transition-all">
          <RotateCw className="w-3.5 h-3.5" /> +90°
        </button>
        <button
          onClick={() => setGrayscale((g) => !g)}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs border rounded-md transition-all ${grayscale ? "bg-primary/10 text-primary border-primary/30" : "text-muted hover:text-foreground bg-background border-border"}`}
        >
          N&amp;B
        </button>
        <button onClick={() => setCrop((c) => ({ ...c, enabled: !c.enabled }))}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs border rounded-md transition-all ${crop.enabled ? "bg-primary/10 text-primary border-primary/30" : "text-muted hover:text-foreground bg-background border-border"}`}>
          <Crop className="w-3.5 h-3.5" /> Recadrer
        </button>
        <button onClick={() => { setRotation(0); setGrayscale(false); setCrop({ x: 0, y: 0, w: 100, h: 100, enabled: false }); }}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground bg-background border border-border rounded-md transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
        <div className="flex-1" />
        {msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-3 py-1.5 rounded-md transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Sauver
        </button>
      </div>

      {/* Crop controls */}
      {crop.enabled && (
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border-b border-primary/20 text-xs text-muted flex-wrap shrink-0">
          <span className="text-primary font-medium">Recadrage (%) :</span>
          {(["x", "y", "w", "h"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1">
              <span className="uppercase font-mono">{k}</span>
              <input type="number" min={0} max={100} value={crop[k]}
                onChange={(e) => setCrop((c) => ({ ...c, [k]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                className="w-14 bg-background border border-border rounded px-1.5 py-0.5 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </label>
          ))}
          <button onClick={applyCrop}
            className="bg-primary text-white px-2 py-0.5 rounded text-xs">
            Appliquer
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-background p-4">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded shadow" />
      </div>
    </div>
  );
}
