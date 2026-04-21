import { DebugBadge } from "@/content/debugBadge";
import { DmsCompanionPanel } from "@/content/uiPanel";
import { logger, setDebugLogging } from "@/lib/logger";
import { detectRoutingPage } from "@/lib/pageDetector";
import { capturePriorityFromDetailsPage } from "@/lib/priorityCarryover";
import { loadSettings } from "@/lib/settingsManager";

let panel: DmsCompanionPanel | null = null;
let observer: MutationObserver | null = null;
let detectionTimer = 0;
const debugBadge = new DebugBadge();
let lastCapturedPriorityKey: string | null = null;

const evaluatePage = async (): Promise<void> => {
  const settings = await loadSettings();
  setDebugLogging(settings.debug);
  const carriedPriority = await capturePriorityFromDetailsPage(document, settings);
  if (carriedPriority) {
    const captureKey = `${carriedPriority.sourceUrl}:${carriedPriority.priority}`;
    if (captureKey !== lastCapturedPriorityKey) {
      logger.debug("Captured carried priority", carriedPriority);
      lastCapturedPriorityKey = captureKey;
    }
  }

  const detection = detectRoutingPage(document, settings);

  logger.debug("Page detection", detection);
  if (settings.debug) {
    debugBadge.update(detection, Boolean(panel));
  } else {
    debugBadge.destroy();
  }

  if (detection.matched) {
    if (!panel) {
      panel = new DmsCompanionPanel();
      await panel.mount();
      if (settings.debug) {
        debugBadge.update(detection, true);
      }
      return;
    }

    await panel.refresh();
    if (settings.debug) {
      debugBadge.update(detection, true);
    }
    return;
  }

  panel?.destroy();
  panel = null;
  if (settings.debug) {
    debugBadge.update(detection, false);
  } else {
    debugBadge.destroy();
  }
};

const scheduleEvaluate = (): void => {
  window.clearTimeout(detectionTimer);
  detectionTimer = window.setTimeout(() => {
    void evaluatePage();
  }, 250);
};

const bootstrap = async (): Promise<void> => {
  await evaluatePage();

  observer?.disconnect();
  observer = new MutationObserver(() => {
    scheduleEvaluate();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(() => {
      scheduleEvaluate();
    });
  }

  window.addEventListener("focus", () => {
    scheduleEvaluate();
  });
};

void bootstrap();
