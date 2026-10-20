
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));

const limitAI = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, file.mimetype.startsWith("image/"));
  }
});

function getAI() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error(
      "Render में GEMINI_API_KEY Environment Variable सेट करें।"
    );
    error.status = 503;
    throw error;
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "VALMIKI KANDERA MASTER AI",
    apiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.post("/api/chat", limitAI, async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "अपना सवाल लिखें।" });
    }

    if (message.length > 12000) {
      return res.status(400).json({ error: "सवाल बहुत लंबा है।" });
    }

    const ai = getAI();
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction:
          "You are VALMIKI KANDERA MASTER AI. Reply helpfully and clearly in the user's language. If the user writes Hindi, reply in Hindi."
      }
    });

    res.json({
      reply: result.text || "इस बार AI जवाब नहीं दे पाया।"
    });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "AI चैट में समस्या है। Render Logs और API मॉडल जाँचें।"
    });
  }
});

app.post(
  "/api/image",
  limitAI,
  upload.single("image"),
  async (req, res) => {
    try {
      const prompt = String(req.body?.prompt || "").trim();

      if (!prompt) {
        return res.status(400).json({
          error: "इमेज बनाने या एडिट करने का निर्देश लिखें।"
        });
      }

      const parts = [{ text: prompt }];

      if (req.file) {
        parts.push({
          inlineData: {
            mimeType: req.file.mimetype,
            data: req.file.buffer.toString("base64")
          }
        });
      }

      const ai = getAI();
      const result = await ai.models.generateContent({
        model:
          process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["TEXT", "IMAGE"] }
      });

      let image = "";
      let note = "";

      for (const candidate of result.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (
            part.inlineData?.data &&
            part.inlineData?.mimeType?.startsWith("image/")
          ) {
            image =
              "data:" +
              part.inlineData.mimeType +
              ";base64," +
              part.inlineData.data;
          }
          if (part.text) note += part.text;
        }
      }

      if (!image) {
        return res.status(502).json({
          error:
            "मॉडल ने इमेज नहीं लौटाई। GEMINI_IMAGE_MODEL और API में image generation की उपलब्धता जाँचें।",
          detail: note.slice(0, 300)
        });
      }

      res.json({ image, note: note || "इमेज तैयार है।" });
    } catch (error) {
      console.error("Image error:", error.message);
      res.status(error.status || 500).json({
        error: error.status
          ? error.message
          : "इमेज बनाने में समस्या हुई। API मॉडल और Render Logs जाँचें।"
      });
    }
  }
);

app.use((error, req, res, next) => {
  console.error("Request error:", error.message);
  res.status(error.status || 400).json({
    error: error.message || "अनुरोध पूरा नहीं हो पाया।"
  });
});

app.listen(PORT, () => {
  console.log("VALMIKI KANDERA MASTER AI started on port " + PORT);
});
