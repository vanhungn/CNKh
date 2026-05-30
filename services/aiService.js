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
        // 1. Xử lý lịch sử chat (nếu có) để AI nhớ câu chuyện
        let historyText = "";
        if (chatHistory && chatHistory.length > 0) {
            historyText = "Lịch sử trò chuyện gần đây:\n" + chatHistory.map(msg => `- ${msg.role}: ${msg.content}`).join("\n") + "\n\n";
        }

        // 2. Nâng cấp Prompt (Ép AI đóng vai và trả lời chi tiết)
        const prompt = `Bạn là một chuyên viên tư vấn nhiệt tình, chuyên nghiệp của Trường Đại học Công nghiệp Việt - Hung (VIU).
Nhiệm vụ của bạn là giải đáp thắc mắc cho sinh viên/thí sinh một cách chi tiết, đầy đủ và lịch sự nhất.

${historyText}Thông tin tham khảo (Ngữ cảnh):
"""
${contextText}
"""

Câu hỏi của người dùng: "${query}"

YÊU CẦU BẮT BUỘC:
1. Hãy trả lời thật chi tiết, cặn kẽ dựa trên Thông tin tham khảo bên trên.
2. Trình bày rõ ràng, xuống dòng, dùng gạch đầu dòng (-) cho các ý chính để người dùng dễ đọc.
3. Nếu Thông tin tham khảo không có đáp án, hãy xin lỗi và nói rõ là bạn chưa có thông tin chính thức, tuyệt đối KHÔNG tự bịa đặt dữ liệu.
4. Giữ thái độ thân thiện, luôn sẵn sàng hỗ trợ.

Câu trả lời của bạn:`;

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