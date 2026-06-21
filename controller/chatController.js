const { searchVectorDB } = require('../services/vectorService');
const { getDynamicNewsFromAPI } = require('../services/webService');
const { generateAnswerFromDoc, generateFallbackAnswer } = require('../services/aiService');
const axios = require("axios");
async function handleChat(req, res) {
    try {
        const { query, chatHistory } = req.body;

        const [driveResults, webData] = await Promise.all([
            searchVectorDB(query).catch(() => []),
            getDynamicNewsFromAPI(query).catch(() => "")
        ]);

        let combinedContext = "";
        let sourceNames = [];

        if (driveResults.length > 0) {
            combinedContext += `[TÀI LIỆU]: ${driveResults.map(d => d.pageContent).join("\n")}\n`;
            sourceNames.push("Google Drive");
        }
        if (webData.length > 50) {
            combinedContext += webData + "\n";
            sourceNames.push("Database Trường");
        }

        if (combinedContext.trim() !== "") {
            const answer = await generateAnswerFromDoc(query, combinedContext, chatHistory);
            return res.json({ success: true, source: sourceNames.join(" & "), answer, citations: driveResults.map(d => d.metadata.fileName) });
        } else {
            const fallback = await generateFallbackAnswer(query, chatHistory);
            return res.json({ success: true, source: "fallback", answer: fallback });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
}

const VoidChat = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Không tìm thấy file âm thanh đính kèm." });
        }
        const audioBase64 = req.file.buffer.toString('base64');
        const audioFormat = req.file.originalname?.split('.').pop()?.toLowerCase() || 'webm';

        const whisperRes = await axios.post(
            'https://openrouter.ai/api/v1/audio/transcriptions',
            {
                model: 'openai/whisper-large-v3-turbo',
                input_audio: { data: audioBase64, format: audioFormat }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        const userText = whisperRes.data.text;
        if (!userText?.trim()) {
            return res.status(400).json({ error: "Không nhận diện được nội dung âm thanh." });
        }

        res.json({ success: true, transcript: userText });
    } catch (error) {
        console.error("Lỗi xử lý Voice:", error.response?.data || error.message);
        res.status(500).json({ error: "Hệ thống đang gặp sự cố khi xử lý âm thanh." });
    }
};
module.exports = { VoidChat, handleChat };