import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Fallback logic for high demand / temporary server errors
async function generateWithFallback(prompt, image) {
    // क्रम से मॉडल ट्राई करेगा अगर एक व्यस्त हुआ
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            
            if (image) {
                const base64Data = image.split(',')[1] || image;
                const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
                const imagePart = { inlineData: { data: base64Data, mimeType } };
                const userPrompt = prompt || "इस फोटो का ध्यानपूर्वक विश्लेषण करें।";
                
                const result = await model.generateContent([userPrompt, imagePart]);
                return result.response.text();
            } else {
                const result = await model.generateContent(prompt || "नमस्ते");
                return result.response.text();
            }
        } catch (err) {
            console.log(`Model ${modelName} failed, trying next...`, err.message);
            lastError = err;
        }
    }
    throw lastError;
}

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, image } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY सेट नहीं है।' });
        }

        const responseText = await generateWithFallback(prompt, image);
        
        res.json({
            text: responseText,
            generatedImage: null
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'गूगल सर्वर पर अभी अत्यधिक लोड है। कृपया कुछ सेकंड बाद पुनः प्रयास करें।' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
