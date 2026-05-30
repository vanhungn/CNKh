const { ChatOpenAI } = require("@langchain/openai");
require('dotenv').config();

// Khởi tạo model Llama 3 gánh tải qua hệ thống của OpenRouter
const llm = new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY, // ĐÃ SỬA: Đổi từ openAIApiKey thành apiKey
    configuration: {
        baseURL: "https://openrouter.ai/api/v1", // Trỏ hướng gọi API về OpenRouter
    },
    modelName: "meta-llama/llama-3.3-70b-instruct", // Model mạnh nhất cho RAG và Dịch thuật
    temperature: 0,
    maxRetries: 2
});

async function generateAnswerFromDoc(query, contextText, chatHistory = []) {
    try {
        let historyText = "";
        if (chatHistory && chatHistory.length > 0) {
            historyText = "Lịch sử trò chuyện gần đây:\n" + chatHistory.map(msg => `- ${msg.role}: ${msg.content}`).join("\n") + "\n\n";
        }

        // --- CẬP NHẬT PROMPT TẠI ĐÂY ---
        const prompt = `You are a helpful and professional advisor for Viet - Hung Industrial University (VIU).
Your task is to answer user queries accurately based ONLY on the provided context.

CRITICAL LANGUAGE RULE (LUẬT NGÔN NGỮ BẮT BUỘC):
- You MUST answer in the EXACT SAME LANGUAGE as the user's question.
- If the user asks in English (e.g., "admissions", "hello", "tuition"), you MUST reply ENTIRELY IN ENGLISH. If the provided context is in Vietnamese, you MUST TRANSLATE the relevant facts into English to answer.
- Nếu người dùng hỏi bằng Tiếng Việt, BẮT BUỘC trả lời hoàn toàn bằng Tiếng Việt.

${historyText}
Context / Thông tin tham khảo:
"""
${contextText}
"""

User's question / Câu hỏi của người dùng: "${query}"

REQUIREMENTS / YÊU CẦU:
1. Answer in detail based on the Context. Use bullet points (-) for readability. / Trả lời chi tiết dựa trên Ngữ cảnh, dùng gạch đầu dòng.
2. If the answer is not in the Context, apologize and state clearly that you do not have official information. Do NOT make up facts. / Nếu ngữ cảnh không có thông tin, hãy xin lỗi và nói rõ là chưa có thông tin chính thức.
3. Be polite and helpful. / Luôn lịch sự và sẵn sàng hỗ trợ.

Your Answer / Câu trả lời của bạn:`;

        const response = await llm.invoke(prompt);
        return typeof response === 'string' ? response : response.content;
    } catch (error) {
        console.error("❌ LỖI GỌI OPENROUTER API:", error.message);
        console.error("❌ CHI TIẾT LỖI:", error.response?.data || error);
        return "Hệ thống đang bận, bạn vui lòng thử lại sau vài giây nhé.";
    }
}

async function classifyUserIntent(query, categories) {
    try {
        const prompt = `Phân loại ý định của: "${query}" vào 1 trong các mục: ${categories.join(", ")}. Chỉ trả về tên mục.`;
        const response = await llm.invoke(prompt);
        const res = typeof response === 'string' ? response : response.content;
        return res.trim().replace(/['"]/g, '');
    } catch {
        return categories[0];
    }
}

async function generateFallbackAnswer(query, chatHistory = []) {
    try {
        const response = await llm.invoke(`Trả lời câu hỏi: ${query}`);
        return typeof response === 'string' ? response : response.content;
    } catch {
        return "Xin lỗi, tôi không tìm thấy thông tin này.";
    }
}

module.exports = { generateAnswerFromDoc, classifyUserIntent, generateFallbackAnswer };