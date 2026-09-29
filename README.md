# saytzhasauopaonay — AI Website Builder v2

This version adds file attachments to the AI website builder.

## Supported attachments
- HTML / HTM
- CSS
- JS / MJS / TS / JSX / TSX
- JSON / TXT / MD / XML / CSV / SVG
- ZIP (text files and images inside are inspected)
- PNG / JPG / JPEG / WEBP / GIF / BMP

## What happens when a user uploads a file?
1. The browser sends the prompt plus attached files to `/api/generate`.
2. Text/code files are read by the server and included in the AI context.
3. Images are passed to the model as image inputs and are assigned placeholders such as `{{ASSET_0}}`.
4. The generated HTML is returned to the browser and image placeholders are replaced with embedded data URLs, so the preview keeps the uploaded images.

## Run

```bash
cd backend
npm install
cp .env.example .env
```

Put your OpenAI API key into `.env`:

```text
OPENAI_API_KEY=your_key_here
```

Start:

```bash
npm start
```

Open `http://localhost:3000`.

## Render

Keep the repository structure with `frontend/` and `backend/`. The Render service should point to the `backend` directory and use:

- Build Command: `npm install`
- Start Command: `npm start`

For a production multi-user version, move published-site persistence from `backend/data/sites.json` to a managed database/object storage. Render instances should not be treated as durable file storage.
