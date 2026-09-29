const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// --------------------------------
// Негізгі баптаулар
// --------------------------------

app.use(cors());

app.use(
  express.json({
    limit: "20mb"
  })
);

// --------------------------------
// Файл жолдары
// --------------------------------

const ROOT = process.cwd();

const INDEX_FILE = path.join(
  ROOT,
  "index.html"
);

const SITES_FILE = path.join(
  ROOT,
  "sites.json"
);

// --------------------------------
// Статикалық файлдар
// --------------------------------

app.use(
  express.static(ROOT)
);

// --------------------------------
// OpenAI
// --------------------------------

let openai = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// --------------------------------
// Sites JSON дайындау
// --------------------------------

function ensureSitesFile() {
  if (!fs.existsSync(SITES_FILE)) {
    fs.writeFileSync(
      SITES_FILE,
      "{}",
      "utf8"
    );
  }
}

function readSites() {
  ensureSitesFile();

  try {
    const data = fs.readFileSync(
      SITES_FILE,
      "utf8"
    );

    return JSON.parse(data || "{}");
  } catch (error) {
    console.error(
      "sites.json оқу қатесі:",
      error
    );

    return {};
  }
}

function saveSites(sites) {
  fs.writeFileSync(
    SITES_FILE,
    JSON.stringify(
      sites,
      null,
      2
    ),
    "utf8"
  );
}

// --------------------------------
// AI кодын тазалау
// --------------------------------

function cleanAIHtml(html) {
  if (!html) {
    return "";
  }

  let result = String(html).trim();

  result = result.replace(
    /^```html\s*/i,
    ""
  );

  result = result.replace(
    /^```\s*/i,
    ""
  );

  result = result.replace(
    /\s*```$/i,
    ""
  );

  return result.trim();
}

// --------------------------------
// Негізгі бет
// --------------------------------

app.get("/", (req, res) => {
  if (!fs.existsSync(INDEX_FILE)) {
    return res.status(500).send(`
      <h1>index.html табылмады</h1>
      <p>GitHub репозиторийінің негізгі папкасына index.html файлын салыңыз.</p>
    `);
  }

  res.sendFile(INDEX_FILE);
});

// --------------------------------
// AI сайт жасау
// --------------------------------

app.post(
  "/api/generate",
  async (req, res) => {

    try {

      const prompt =
        String(
          req.body?.prompt || ""
        ).trim();

      if (!prompt) {
        return res.status(400).json({
          error:
            "Сайт туралы тапсырма жазыңыз."
        });
      }

      if (!openai) {
        return res.status(500).json({
          error:
            "OPENAI_API_KEY қосылмаған. Render → Environment бөлімінен API Key қосу керек."
        });
      }

      const systemPrompt = `
Сен — saytzhasauopaonay платформасының AI website builder көмекшісісің.

Пайдаланушының тапсырмасынан толық дайын веб-сайт жаса.

Міндетті талаптар:

1. Толық HTML құжатын жаса.
2. CSS кодын HTML ішіндегі <style> тегіне жаз.
3. JavaScript кодын HTML ішіндегі <script> тегіне жаз.
4. Сайт бір HTML файлмен толық жұмыс істеуі керек.
5. Заманауи және әдемі дизайн жаса.
6. Компьютерге де, телефонға да responsive болсын.
7. Қазақша мәтінді дұрыс көрсет.
8. Батырмалардың әрекеттері жұмыс істесін.
9. Жеңіл анимациялар қолдан.
10. Пайдаланушы сұраған бөлімдердің бәрін жаса.
11. Сурет керек болса, сыртқы HTTPS сурет URL-дерін қолдануға болады.
12. HTML ішінде дайын placeholder суреттерді қолдануға болады.
13. Кодты markdown блоктың ішіне салма.
14. Жауапта тек дайын HTML кодын қайтар.
`;

      const response =
        await openai.responses.create({
          model:
            "gpt-5.6-luna",

          input: [
            {
              role: "system",
              content:
                systemPrompt
            },
            {
              role: "user",
              content:
                prompt
            }
          ]
        });

      const html =
        cleanAIHtml(
          response.output_text
        );

      if (!html) {
        return res.status(500).json({
          error:
            "AI бос жауап қайтарды."
        });
      }

      res.json({
        success: true,
        html
      });

    } catch (error) {

      console.error(
        "AI ERROR:",
        error
      );

      res.status(500).json({
        error:
          error?.message ||
          "AI сайт жасау кезінде қате шықты."
      });
    }
  }
);

// --------------------------------
// Сайт жариялау
// --------------------------------

app.post(
  "/api/publish",
  async (req, res) => {

    try {

      const html =
        String(
          req.body?.html || ""
        ).trim();

      const title =
        String(
          req.body?.title ||
          "saytzhasauopaonay сайты"
        ).trim();

      if (!html) {
        return res.status(400).json({
          error:
            "Жариялайтын сайт жоқ."
        });
      }

      const id =
        crypto
          .randomBytes(6)
          .toString("hex");

      const sites =
        readSites();

      sites[id] = {
        id,
        title,
        html,
        createdAt:
          new Date().toISOString()
      };

      saveSites(sites);

      const host =
        `${req.protocol}://${req.get("host")}`;

      res.json({
        success: true,
        id,
        url:
          `${host}/s/${id}`
      });

    } catch (error) {

      console.error(
        "PUBLISH ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Сайтты жариялау кезінде қате шықты."
      });
    }
  }
);

// --------------------------------
// Жарияланған сайтты көрсету
// --------------------------------

app.get(
  "/s/:id",
  (req, res) => {

    try {

      const sites =
        readSites();

      const site =
        sites[req.params.id];

      if (!site) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="kk">
          <head>
            <meta charset="UTF-8">
            <title>Сайт табылмады</title>
          </head>
          <body>
            <h1>Сайт табылмады</h1>
            <p>Бұл сайттың сілтемесі дұрыс емес немесе сайт өшірілген.</p>
          </body>
          </html>
        `);
      }

      res
        .type("html")
        .send(site.html);

    } catch (error) {

      console.error(
        "SITE ERROR:",
        error
      );

      res.status(500).send(
        "Сайтты ашу кезінде қате шықты."
      );
    }
  }
);

// --------------------------------
// Сайт туралы ақпарат
// --------------------------------

app.get(
  "/api/sites/:id",
  (req, res) => {

    const sites =
      readSites();

    const site =
      sites[req.params.id];

    if (!site) {
      return res.status(404).json({
        error:
          "Сайт табылмады."
      });
    }

    res.json({
      id: site.id,
      title: site.title,
      createdAt:
        site.createdAt
    });
  }
);

// --------------------------------
// Health check
// --------------------------------

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",
      service:
        "saytzhasauopaonay",
      time:
        new Date().toISOString()
    });
  }
);

// --------------------------------
// 404
// --------------------------------

app.use(
  (req, res) => {

    res.status(404).json({
      error:
        "Бұл адрес табылмады."
    });

  }
);

// --------------------------------
// Серверді іске қосу
// --------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================="
    );

    console.log(
      "saytzhasauopaonay сервері іске қосылды"
    );

    console.log(
      `PORT: ${PORT}`
    );

    console.log(
      `ROOT: ${ROOT}`
    );

    console.log(
      "================================="
    );
  }
);
