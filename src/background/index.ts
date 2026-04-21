chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.runtime.openOptionsPage) {
    return;
  }
});
