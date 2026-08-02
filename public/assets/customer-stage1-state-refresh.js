(() => {
  const body = document.body;
  if (!body?.matches('[data-gs-page="customer-portfolio"]')) return;
  const currentKey = () => body.dataset.stage1StateKey || "";
  let checking = false;
  const formActive = () => document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');
  async function check() {
    if (checking || document.hidden || formActive()) return;
    checking = true;
    try {
      const response = await fetch(location.href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "text/html" },
      });
      if (!response.ok) return;
      const html = await response.text();
      const nextBody = new DOMParser().parseFromString(html, "text/html").body;
      const nextKey = nextBody?.dataset?.stage1StateKey || "";
      if (nextKey && nextKey !== currentKey()) location.reload();
    } catch {}
    finally { checking = false; }
  }
  setInterval(check, 3000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
})();
