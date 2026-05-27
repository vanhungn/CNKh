const { searchVectorDB } = require('../services/vectorService');
const { getDynamicNewsFromAPI } = require('../services/webService');
const { generateAnswerFromDoc, generateFallbackAnswer } = require('../services/aiService');

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

module.exports = { handleChat };