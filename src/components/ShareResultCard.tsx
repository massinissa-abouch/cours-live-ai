import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";

type Props = {
  title: string;
  score?: string;
  subtitle?: string;
  streakDays?: number;
  filename?: string;
};

export function ShareResultCard({ title, score, subtitle, streakDays, filename = "ostadi-result.png" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = 1080, H = 1350;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // gradient background
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0f172a");
    g.addColorStop(0.5, "#1e293b");
    g.addColorStop(1, "#0ea5e9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // glowing circles
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.arc(150, 250, 220, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a855f7";
    ctx.beginPath(); ctx.arc(950, 1100, 260, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // brand
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px system-ui,-apple-system,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("أ  Ostadi", 80, 130);
    ctx.font = "300 28px system-ui,-apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("Le tuteur IA des élèves algériens", 80, 175);

    // title
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "500 48px system-ui,-apple-system,sans-serif";
    wrapText(ctx, title, W / 2, 380, W - 160, 60);

    // score big
    if (score) {
      ctx.font = "900 220px system-ui,-apple-system,sans-serif";
      const grad = ctx.createLinearGradient(0, 500, 0, 800);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#7dd3fc");
      ctx.fillStyle = grad;
      ctx.fillText(score, W / 2, 780);
    }

    if (subtitle) {
      ctx.font = "400 36px system-ui,-apple-system,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      wrapText(ctx, subtitle, W / 2, 900, W - 160, 48);
    }

    // streak pill
    if (typeof streakDays === "number" && streakDays > 0) {
      const pillW = 460, pillH = 100, x = (W - pillW) / 2, y = 1080;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(ctx, x, y, pillW, pillH, 50);
      ctx.fill();
      ctx.font = "600 52px system-ui,-apple-system,sans-serif";
      ctx.fillStyle = "#fde047";
      ctx.textAlign = "center";
      ctx.fillText(`🔥 ${streakDays} jours de suite`, W / 2, y + 65);
    }

    // footer
    ctx.font = "500 30px system-ui,-apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "center";
    ctx.fillText("ostadi.dz — apprends. progresse. réussis.", W / 2, H - 80);

    setDataUrl(c.toDataURL("image/png"));
  }, [title, score, subtitle, streakDays]);

  async function share() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Mon résultat Ostadi" });
        return;
      }
    } catch { /* fallback below */ }
    download();
  }
  function download() {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mx-auto max-w-xs overflow-hidden rounded-xl">
        <canvas ref={canvasRef} className="h-auto w-full" />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={share} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Share2 className="h-4 w-4" /> Partager
        </button>
        <button onClick={download} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary">
          <Download className="h-4 w-4" /> PNG
        </button>
      </div>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = ""; let yy = y;
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, yy);
      line = w + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}