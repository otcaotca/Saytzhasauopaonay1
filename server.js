import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

app.use(
  express.json({
    limit: "20mb"
  })
);

// Негізгі папка
const ROOT = __dirname;

const INDEX_FILE = path.join(
  ROOT,
  "index.html"
);

const SITES_FILE = path.join(
  ROOT,
  "sites.json"
);

// Статикалық файлдар
app.use(express.static(ROOT));

// OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;


// ================================
// sites.json
// ================================

function readSites() {
  try {
    if (!fs.existsSync(SITES_FILE)) {
      fs.writeFileSync(
        SITES_FILE,
        "{}",
        "utf8"
      );
    }

    const data = fs.readFileSync(
      SITES_FILE,
      "utf8"
    );

    return JSON.parse(data || "{}");

  } catch (error) {
    console.error(
      "sites.json қатесі:",
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


// ================================
// Басты бет
// ================================

app.get("/", (req, res) => {

  if (!fs.existsSync(INDEX_FILE)) {

    return res.status(500).send(`
      <h1>index.html табылмады</h1>
      <p>index.html GitHub репозиторийінің негізгі папкасында болуы керек.</p>
    `);
  }

  res.sendFile(INDEX_FILE);
});


// ================================
// AI САЙТ ЖАСАУ
// ================================

app.post(
  "/api/generate",
  async (req, res) => {

    try {

      const prompt = String(
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
            "OPENAI_API_KEY қосылмаған."
        });
      }


      const response =
        await openai.responses.create({

          model: "gpt-5.6-luna",

          input: `
Сен saytzhasauopaonay платформасының AI website builder көмекшісісің.

Пайдаланушының тапсырмасы:

${prompt}

Толық дайын веб-сайт жаса.

Талаптар:

- Толық HTML құжатын жаса.
- CSS кодын HTML ішіндегі style тегіне жаз.
- JavaScript кодын HTML ішіндегі script тегіне жаз.
- Бір HTML файл ретінде жұмыс істесін.
- Заманауи дизайн қолдан.
- Телефонға және компьютерге бейімделсін.
- Қазақша мәтіндерді дұрыс көрсет.
- Батырмалар жұмыс істесін.
- Анимациялар қолдан.
- Пайдаланушы сұраған бөлімдердің барлығын жаса.
- Әдемі интерфейс жаса.
- Тек HTML кодын қайтар.
- Markdown қолданба.
- Кодты triple backticks ішіне салма.
`
        });


      let html =
        response.output_text || "";


      html = html
        .replace(
          /^```html\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();


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


// ================================
// САЙТТЫ ЖАРИЯЛАУ
// ================================

app.post(
  "/api/publish",
  async (req, res) => {

    try {

      const html = String(
        req.body?.html || ""
      ).trim();

      const title = String(
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


// ================================
// ЖАРИЯЛАНҒАН САЙТ
// ================================

app.get(
  "/s/:id",
  (req, res) => {

    const sites =
      readSites();

    const site =
      sites[req.params.id];


    if (!site) {

      return res.status(404).send(`
        <h1>Сайт табылмады</h1>
      `);
    }


    res.type("html").send(
      site.html
    );
  }
);


// ================================
// API HEALTH
// ================================

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


// ================================
// 404
// ================================

app.use(
  (req, res) => {

    res.status(404).json({

      error:
        "Бұл адрес табылмады."

    });
  }
);


// ================================
// SERVER
// ================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================"
    );

    console.log(
      "saytzhasauopaonay іске қосылды"
    );

    console.log(
      `PORT: ${PORT}`
    );

    console.log(
      `ROOT: ${ROOT}`
    );

    console.log(
      "================================"
    );
  }
);
