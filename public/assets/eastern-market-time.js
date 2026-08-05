(() => {
  const ISO = /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))\b/g;
  const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT", "OPTION"]);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  function friendly(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatter.format(date).replace(/\bEDT\b|\bEST\b/g, "ET");
  }

  function updateText(node) {
    if (!node?.nodeValue) return;
    ISO.lastIndex = 0;
    if (!ISO.test(node.nodeValue)) return;
    ISO.lastIndex = 0;
    node.nodeValue = node.nodeValue.replace(ISO, (_match, value) => friendly(value));
  }

  function updateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) return updateText(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && SKIP.has(root.tagName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement && !SKIP.has(node.parentElement.tagName)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) updateText(walker.currentNode);
  }

  function start() {
    updateTree(document.body);
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") updateText(record.target);
        for (const node of record.addedNodes) updateTree(node);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
