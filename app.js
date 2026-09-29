const form = document.querySelector("#form");
const promptEl = document.querySelector("#prompt");
const messages = document.querySelector("#messages");
const frame = document.querySelector("#frame");
const statusEl = document.querySelector("#status");
const publish = document.querySelector("#publish");
const fileBtn = document.querySelector("#fileBtn");
const fileInput = document.querySelector("#fileInput");
const fileList = document.querySelector("#fileList");

let currentHTML = "";
let selectedFiles = [];

function msg(text, type = "ai") {
  const d = document.createElement("div");
  d.className = `msg ${type}`;
  d.innerHTML = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
}

function renderFiles() {
  fileList.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "fileChip";
    item.innerHTML = `
      <span class="fileIcon">${file.type.startsWith("image/") ? "🖼️" : "📄"}</span>
      <span class="fileName" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <button type="button" aria-label="Файлды өшіру" data-index="${index}">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderFiles();
    });
    fileList.appendChild(item);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

fileBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const incoming = Array.from(fileInput.files || []);
  const map = new Map(selectedFiles.map(file => [file.name + file.size, file]));
  incoming.forEach(file => map.set(file.name + file.size, file));
  selectedFiles = Array.from(map.values()).slice(0, 8);
  renderFiles();
  fileInput.value = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptEl.value.trim();
  if (!prompt && selectedFiles.length === 0) return;

  const shownText = prompt || "Жүктеген файлдарымды негізге алып сайт жаса.";
  msg(escapeHtml(shownText) + (selectedFiles.length ? `<br><small>📎 ${selectedFiles.length} файл тіркелді</small>` : ""), "user");

  promptEl.value = "";
  statusEl.textContent = "AI жасап жатыр...";

  const formData = new FormData();
  formData.append("prompt", prompt || "Жүктеген дайын файлдарымды негізге алып сайт жаса.");
  selectedFiles.forEach(file => formData.append("files", file));

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Қате");

    currentHTML = data.html;
    frame.srcdoc = currentHTML;
    statusEl.textContent = "Дайын ✓";

    const fileText = data.attachedFiles?.length
      ? ` Файлдар талданды: ${data.attachedFiles.join(", ")}.`
      : "";

    msg(`Дайын! ✨ Preview жаңартылды.${escapeHtml(fileText)} Енді чатқа жаңа өзгеріс жазуға болады.`, "ai");
    selectedFiles = [];
    renderFiles();
  } catch (error) {
    statusEl.textContent = "Қате";
    msg(escapeHtml(error.message), "ai");
  }
});

publish.addEventListener("click", async () => {
  if (!currentHTML) {
    msg("Алдымен сайт жасаңыз.", "ai");
    return;
  }

  statusEl.textContent = "Жарияланып жатыр...";

  try {
    const response = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: currentHTML, title: "AI сайт" })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Қате");

    const full = new URL(data.url, location.origin).href;
    statusEl.textContent = "Жарияланды ✓";
    msg(`🎉 Сайт жарияланды:<br><a href="${full}" target="_blank" rel="noreferrer">${full}</a>`, "ai");
  } catch (error) {
    statusEl.textContent = "Қате";
    msg(escapeHtml(error.message), "ai");
  }
});
