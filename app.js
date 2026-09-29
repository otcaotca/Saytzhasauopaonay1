let currentHTML = "";

const form = document.querySelector("#form");
const promptEl = document.querySelector("#prompt");
const messages = document.querySelector("#messages");
const frame = document.querySelector("#frame");
const statusEl = document.querySelector("#status");
const publish = document.querySelector("#publish");

function msg(text, type = "ai") {
  const d = document.createElement("div");
  d.className = `msg ${type}`;
  d.textContent = text;
  messages.appendChild(d);
  messages.scrollTop = messages.scrollHeight;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const prompt = promptEl.value.trim();

  if (!prompt) {
    msg("Сайт туралы тапсырманы жазыңыз.", "ai");
    return;
  }

  msg(prompt, "user");

  promptEl.value = "";
  statusEl.textContent = "AI сайт жасап жатыр...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI генерациясында қате шықты.");
    }

    currentHTML = data.html;

    frame.srcdoc = currentHTML;

    statusEl.textContent = "Дайын ✓";

    msg(
      "Дайын! ✨ Сайтыңыз жасалды. Preview терезесінен көре аласыз.",
      "ai"
    );

  } catch (error) {

    console.error(error);

    statusEl.textContent = "Қате";

    msg(
      "Қате: " + error.message,
      "ai"
    );
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        html: currentHTML,
        title: "Менің сайтым"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Жариялау кезінде қате шықты."
      );
    }

    statusEl.textContent = "Жарияланды ✓";

    msg(
      "🎉 Сайт жарияланды!\n" + data.url,
      "ai"
    );

    window.open(data.url, "_blank");

  } catch (error) {

    console.error(error);

    statusEl.textContent = "Қате";

    msg(
      "Жариялау қатесі: " + error.message,
      "ai"
    );
  }
});
