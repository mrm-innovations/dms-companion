let debugEnabled = false;

export const setDebugLogging = (enabled: boolean): void => {
  debugEnabled = enabled;
};

const canLog = (): boolean =>
  debugEnabled;

export const logger = {
  debug: (...args: unknown[]) => {
    if (canLog()) {
      console.debug("[DMS Companion]", ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (canLog()) {
      console.info("[DMS Companion]", ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (canLog()) {
      console.warn("[DMS Companion]", ...args);
    }
  },
};
