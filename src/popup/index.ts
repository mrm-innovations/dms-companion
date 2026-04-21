import "@/styles/popup.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (root) {
  root.innerHTML = `
    <main class="popup-shell">
      <h1>DMS Companion</h1>
      <p>Open the DMS Internal Routing page to use the routing preset panel.</p>
      <button type="button" data-action="open-options">Open Settings</button>
    </main>
  `;

  root.querySelector<HTMLButtonElement>("[data-action='open-options']")?.addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
    window.close();
  });
}
