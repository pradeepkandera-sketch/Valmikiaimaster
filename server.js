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

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

// बैकअप सपोर्ट के साथ मॉडल जनरेशन फ़ंक्शन
async function generateResponse(prompt, image) {
    // गूगल के आधिकारिक और स्थिर मॉडल नाम
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            
            if (image) {
                const base64Data = image.split(',')[1] || image;
                const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';
                const imagePart = { inlineData: { data: base64Data, mimeType } };
                const userPrompt = prompt || "इस फोटो का विस्तार से विश्लेषण करें।";
                
                const result = await model.generateContent([userPrompt, imagePart]);
                return result.response.text();
            } else {
                const result = await model.generateContent(prompt || "नमस्ते");
                return result.response.text();
            }
        } catch (err) {
            console.log(`Model ${modelName} failed, trying next... Error: ${err.message}`);
            lastError = err;
        }
    }
    throw lastError;
}

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, image } = req.body;

        if (!apiKey) {
            return res.status(500).json({ 
                error: 'GEMINI_API_KEY सेट नहीं है। कृपया Render Dashboard के Environment Variables में अपनी API Key चेक करें।' 
            });
        }

        const responseText = await generateResponse(prompt, image);
        
        res.json({
            text: responseText,
            generatedImage: null
        });

    } catch (error) {
        console.error('Gemini API Final Error:', error);
        res.status(500).json({ 
            error: 'सर्वर से उत्तर प्राप्त करने में समस्या आई। कृपया अपनी API Key जांचें या कुछ समय बाद प्रयास करें।' 
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
