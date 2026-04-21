import type { DetectionResult } from "@/types/app";

const BADGE_ID = "dms-companion-debug-badge";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export class DebugBadge {
  private element: HTMLDivElement | null = null;

  mount(): void {
    if (this.element?.isConnected) {
      return;
    }

    this.element = document.createElement("div");
    this.element.id = BADGE_ID;
    this.element.style.position = "fixed";
    this.element.style.top = "12px";
    this.element.style.left = "12px";
    this.element.style.zIndex = "2147483647";
    this.element.style.maxWidth = "360px";
    this.element.style.padding = "10px 12px";
    this.element.style.borderRadius = "12px";
    this.element.style.background = "rgba(11, 38, 60, 0.96)";
    this.element.style.color = "#ffffff";
    this.element.style.fontFamily = "Segoe UI, Tahoma, sans-serif";
    this.element.style.fontSize = "12px";
    this.element.style.lineHeight = "1.4";
    this.element.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.28)";
    this.element.style.border = "1px solid rgba(255, 255, 255, 0.16)";
    this.element.style.whiteSpace = "normal";
    this.element.style.pointerEvents = "auto";
    this.element.style.cursor = "pointer";
    this.element.title = "Click to hide this temporary debug badge";
    this.element.addEventListener("click", () => {
      this.element?.remove();
    });

    document.documentElement.append(this.element);
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
  }

  update(detection: DetectionResult, panelMounted: boolean): void {
    this.mount();
    if (!this.element) {
      return;
    }

    const tone = detection.matched
      ? "#1f9d62"
      : detection.confidence >= 0.3
        ? "#b7791f"
        : "#c53030";

    this.element.style.borderColor = tone;
    this.element.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <strong style="font-size:13px;">DMS Companion Debug</strong>
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${tone};font-size:11px;">
          ${detection.matched ? "MATCHED" : "NO MATCH"}
        </span>
      </div>
      <div><strong>Injected:</strong> yes</div>
      <div><strong>Panel mounted:</strong> ${panelMounted ? "yes" : "no"}</div>
      <div><strong>URL:</strong> ${escapeHtml(window.location.pathname)}</div>
      <div><strong>Confidence:</strong> ${detection.confidence.toFixed(2)}</div>
      <div style="margin-top:6px;"><strong>Reasons:</strong></div>
      <div>${escapeHtml(
        detection.reasons.length > 0
          ? detection.reasons.join(" | ")
          : "No detection signals were found.",
      )}</div>
    `;
  }
}
