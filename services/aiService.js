const { Ollama } = require("@langchain/ollama");
const { ChatGroq } = require("@langchain/groq");
require('dotenv').config();

const llm = new ChatGroq({ apiKey: process.env.GROQ_API_KEY, model: "llama-3.3-70b-versatile" });
async function generateAnswerFromDoc(query, contextText, chatHistory = []) {
    try {
        const prompt = `Dựa vào ngữ cảnh sau: ${contextText}\nTrả lời câu hỏi: ${query}`;
        const response = await llm.invoke(prompt);
        return typeof response === 'string' ? response : response.content;
    } catch (error) {
        console.error("❌ LỖI GỌI GROQ API:", error.message);
        console.error("❌ CHI TIẾT LỖI:", error.response?.data || error);
        return "Hệ thống đang bận, thử lại sau.";
    }
}

async function classifyUserIntent(query, categories) {
    try {
        const prompt = `Phân loại ý định của: "${query}" vào 1 trong các mục: ${categories.join(", ")}. Chỉ trả về tên mục.`;
        const response = await llm.invoke(prompt);
        const res = typeof response === 'string' ? response : response.content;
        return res.trim().replace(/['"]/g, '');
    } catch { return categories[0]; }
}

async function generateFallbackAnswer(query, chatHistory = []) {
    try {
        const response = await llm.invoke(`Trả lời câu hỏi: ${query}`);
        return typeof response === 'string' ? response : response.content;
    } catch { return "Xin lỗi, tôi không tìm thấy thông tin này."; }
}

module.exports = { generateAnswerFromDoc, classifyUserIntent, generateFallbackAnswer };