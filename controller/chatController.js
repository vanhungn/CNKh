const { searchVectorDB, getFileContent } = require('../services/vectorService');
const { getDynamicNewsFromAPI } = require('../services/webService');
const { generateAnswerFromDoc, generateFallbackAnswer } = require('../services/aiService');
const axios = require("axios");
function cleanFormText(raw) {
    return raw
        .replace(/\r/g, "")
        .replace(/[….]{2,}/g, "")               // bỏ dấu chấm chỗ điền
        .replace(/[ \t]+/g, " ")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l && !/^\d{1,2}$/.test(l)) // bỏ dòng trống và số thứ tự rời của bảng
        .join("\n");
}

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

            // ===== Gộp theo file: lấy điểm cao nhất, bỏ trùng, bỏ file khớp lỏng =====
            const byFile = new Map();
            for (const d of driveResults) {
                const m = d.metadata || {};
                if (!m.fileId) continue;
                const cur = byFile.get(m.fileId);
                if (!cur || cur.score < d.score) {
                    byFile.set(m.fileId, { fileId: m.fileId, fileName: m.fileName, score: d.score });
                }
            }
            let ranked = [...byFile.values()].sort((a, b) => b.score - a.score);
            if (ranked.length) {
                const top = ranked[0].score;
                ranked = ranked.filter(f => f.score >= top - 0.05).slice(0, 3); // chỉnh 0.05 theo dữ liệu thật
            }

            const files = ranked.map(f => ({
                fileId: f.fileId,
                fileName: f.fileName,
                viewUrl: `/api/files/${f.fileId}/view`,
                downloadUrl: `/api/files/${f.fileId}/download`
            }));
            const citations = files.map(f => f.fileName);

            // ===== Người dùng hỏi biểu mẫu: trả nội dung thô + nút Xem/Tải =====
            const q = query.normalize("NFC");
            const wantsForm = /(đơn|phiếu|biểu mẫu|mẫu)/i.test(q);

            if (wantsForm && files.length) {
                const best = files[0];

                // Ghép nội dung từ các chunk của chính file này (đã có sẵn trong DB)
                const rawText = driveResults
                    .filter(d => d.metadata?.fileId === best.fileId)
                    .map(d => d.pageContent)
                    .join("\n");

                const text = rawText
                    ? cleanFormText(rawText.replace(/^\[Tài liệu:.*\]\n?/gm, "")).slice(0, 4000)
                    : "";

                return res.json({
                    success: true,
                    source: "Google Drive",
                    answer: text
                        ? `Nội dung biểu mẫu "${best.fileName}":\n\n${text}\n\nBạn bấm Tải xuống bên dưới để lấy file gốc.`
                        : `Mình tìm thấy biểu mẫu "${best.fileName}". Bạn bấm Tải xuống bên dưới nhé.`,
                    citations: [best.fileName],
                    files: [best]
                });
            }

            // ===== Còn lại: hỏi nội dung -> AI trả lời như cũ =====
            const answer = await generateAnswerFromDoc(query, combinedContext, chatHistory);

            return res.json({
                success: true,
                source: sourceNames.join(" & "),
                answer,
                citations,
                files // rỗng nếu không lấy từ Google Drive
            });
        } else {
            const fallback = await generateFallbackAnswer(query, chatHistory);
            return res.json({ success: true, source: "fallback", answer: fallback });
        }
    } catch (error) {
        console.error("Lỗi handleChat:", error);
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