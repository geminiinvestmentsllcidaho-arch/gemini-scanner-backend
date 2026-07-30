(() => {
  const container = document.getElementById("owned-position-rows");
  const add = document.getElementById("add-position-row");
  const form = document.getElementById("owned-position-form");
  if (!container || !add || !form) return;

  const removeRow = (button) => {
    const row = button.closest(".position-row");
    if (!row) return;
    const rows = container.querySelectorAll(".position-row");
    if (rows.length > 1) {
      row.remove();
    } else {
      row.querySelectorAll("input").forEach((input) => { input.value = ""; });
    }
  };

  container.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-row");
    if (!button || !container.contains(button)) return;
    event.preventDefault();
    removeRow(button);
  });

  add.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "position-row";
    row.innerHTML = '<label>Symbol<input name="symbol" placeholder="AAPL" autocomplete="off"></label><label>Quantity<input name="qty" placeholder="10" inputmode="decimal"></label><label>Average purchase price<input name="averageEntryPrice" placeholder="185.40" inputmode="decimal"></label><label>Broker or source<input name="brokerLabel" placeholder="Other broker"></label><span class="source-badge manual-source">Added manually</span><button class="remove-row" type="button" aria-label="Remove position">Remove</button>';
    container.appendChild(row);
    row.querySelector("input")?.focus();
  });
})();
