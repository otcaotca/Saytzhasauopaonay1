import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import AdmZip from "adm-zip";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const DATA_DIR = path.join(__dirname, "data");
const DATA = path.join(DATA_DIR, "sites.json");

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use(express.static(FRONTEND_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 8,
    fileSize: 8 * 1024 * 1024
  }
});

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const TEXT_EXTENSIONS = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".ts", ".jsx", ".tsx",
  ".json", ".txt", ".md", ".xml", ".svg", ".csv"
]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"
]);

function getExt(name) {
  return path.extname(name || "").toLowerCase();
}

function isTextFile(name) {
  return TEXT_EXTENSIONS.has(getExt(name));
}

function isImageFile(name) {
  return IMAGE_EXTENSIONS.has(getExt(name));
}

function mimeFromName(name) {
  const ext = getExt(name);
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml"
  };
  return map[ext] || "application/octet-stream";
}

function toDataUrl(buffer, name) {
  return `data:${mimeFromName(name)};base64,${buffer.toString("base64")}`;
}

function cleanHtml(html) {
  return String(html || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function safeText(buffer, limit = 120000) {
  return buffer.toString("utf8").slice(0, limit);
}

function addTextContext(items, label, text) {
  if (!text.trim()) return;
  items.push(`\n===== ${label} =====\n${text}`);
}

async function readSites() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    return JSON.parse(await fs.readFile(DATA, "utf8"));
  } catch {
    return {};
  }
}

async function writeSites(sites) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA, JSON.stringify(sites, null, 2), "utf8");
}

async function collectUploadedFiles(files) {
  const textParts = [];
  const images = [];
  let assetIndex = 0;

  const processOne = async (file, virtualName = file.originalname) => {
    const lower = virtualName.toLowerCase();
    const ext = getExt(virtualName);

    if (lower.endsWith(".zip")) {
      const zip = new AdmZip(file.buffer);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName;
        const entryBuffer = entry.getData();
        const assetName = `{{ASSET_${assetIndex}}}`;

        if (isImageFile(entryName)) {
          images.push({
            placeholder: assetName,
            name: `${virtualName}/${entryName}`,
            dataUrl: toDataUrl(entryBuffer, entryName)
          });
          assetIndex += 1;
        } else if (isTextFile(entryName)) {
          addTextContext(textParts, `${virtualName}/${entryName}`, safeText(entryBuffer));
        }
      }
      return;
    }

    if (isImageFile(virtualName)) {
      const assetName = `{{ASSET_${assetIndex}}}`;
      images.push({
        placeholder: assetName,
        name: virtualName,
        dataUrl: toDataUrl(file.buffer, virtualName)
      });
      assetIndex += 1;
      return;
    }

    if (isTextFile(virtualName) || ext === "") {
      addTextContext(textParts, virtualName, safeText(file.buffer));
    } else {
      addTextContext(textParts, `${virtualName} (unsupported type; filename only)`, "");
    }
  };

  for (const file of files || []) {
    await processOne(file);
  }

  return { textParts, images };
}

function injectAssets(html, images) {
  let output = html;
  for (const image of images) {
    output = output.split(image.placeholder).join(image.dataUrl);
  }
  return output;
}

app.post("/api/generate", upload.array("files", 8), async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "Тапсырма бос." });
    }

    if (!client) {
      return res.status(500).json({
        error: "OPENAI_API_KEY Render-ге әлі қосылмаған."
      });
    }

    const uploaded = await collectUploadedFiles(req.files || []);

    const instructions = `
Сен saytzhasauopaonay платформасының AI website builder көмекшісісің.

ПАЙДАЛАНУШЫ ТАПСЫРМАСЫ:
${prompt}

ҚОСЫМША ЖҮКТЕЛГЕН ФАЙЛДАР:
${uploaded.textParts.length ? uploaded.textParts.join("\n") : "Жоқ"}

Сенің міндетің:
- Пайдаланушы сұраған сайтты толық жаса немесе жүктелген дайын сайтты жаңарт.
- Егер HTML/CSS/JS файлдары берілсе, оларды біріктіріп, қажет өзгерістерді жаса.
- Егер суреттер берілсе, оларды сайтқа мағыналы жерлерде қолдан.
- Жүктелген суретті HTML/CSS ішінде қолдану керек болса, оның дәл placeholder-ін қолдан: {{ASSET_0}}, {{ASSET_1}}, т.б.
- Placeholder мәтіндерін өзің ойдан өзгертпе.
- Тек бір толық, өздігінен жұмыс істейтін HTML құжатын қайтар.
- CSS және JavaScript сол HTML ішінде болсын.
- Заманауи, әдемі және кәсіби дизайн жаса.
- Телефонға және компьютерге responsive болсын.
- Қазақша мәтін дұрыс көрсетілсін.
- Батырмалар мен интерактивті элементтер жұмыс істесін.
- Қажет болса жеңіл анимациялар қолдан.
- Markdown code fence қолданба.
`;

    const content = [
      { type: "input_text", text: instructions }
    ];

    for (const image of uploaded.images.slice(0, 6)) {
      content.push({
        type: "input_text",
        text: `Жүктелген сурет: ${image.name}. Оны HTML-де ${image.placeholder} placeholder-імен қолдан.`
      });
      content.push({
        type: "input_image",
        image_url: image.dataUrl
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      input: [
        {
          role: "user",
          content
        }
      ]
    });

    let html = cleanHtml(response.output_text);
    html = injectAssets(html, uploaded.images);

    res.json({
      html,
      attachedFiles: (req.files || []).map(file => file.originalname),
      imageCount: uploaded.images.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Файлды немесе AI генерациясын өңдеу кезінде қате болды."
    });
  }
});

app.post("/api/publish", async (req, res) => {
  try {
    const html = String(req.body?.html || "").trim();
    const title = String(req.body?.title || "AI сайт")
      .trim()
      .slice(0, 100);

    if (!html) {
      return res.status(400).json({ error: "Жариялайтын сайт жоқ." });
    }

    const id = crypto.randomBytes(5).toString("hex");
    const sites = await readSites();

    sites[id] = {
      id,
      title,
      html,
      createdAt: new Date().toISOString()
    };

    await writeSites(sites);

    res.json({ id, url: `/s/${id}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Жариялау кезінде қате болды." });
  }
});

app.get("/api/sites/:id", async (req, res) => {
  const sites = await readSites();
  const site = sites[req.params.id];

  if (!site) {
    return res.status(404).json({ error: "Сайт табылмады." });
  }

  res.json(site);
});

app.get("/s/:id", async (req, res) => {
  const sites = await readSites();
  const site = sites[req.params.id];

  if (!site) {
    return res.status(404).send("<h1>Сайт табылмады</h1>");
  }

  res.type("html").send(site.html);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`saytzhasauopaonay сервері: ${PORT}`);
});
