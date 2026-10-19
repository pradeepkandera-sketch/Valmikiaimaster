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

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, image } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY सेट नहीं है।' });
        }

        // Updated working model for Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });


        let result;
        if (image) {
            const base64Data = image.split(',')[1] || image;
            const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';

            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };

            const userPrompt = prompt || "इस फोटो का ध्यानपूर्वक विश्लेषण करें और विस्तार से बताएं।";
            result = await model.generateContent([userPrompt, imagePart]);
        } else {
            result = await model.generateContent(prompt || "नमस्ते");
        }

        const responseText = result.response.text();
        
        res.json({
            text: responseText,
            generatedImage: null
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: error.message || 'AI प्रतिक्रिया जनरेट करने में त्रुटि आई।' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
