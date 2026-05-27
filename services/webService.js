const axios = require('axios');
const { classifyUserIntent } = require('./aiService');

let newsCache = { data: null, lastFetched: 0 };
let typesCache = { data: null, lastFetched: 0 };
const CACHE_DURATION = 5 * 60 * 1000;

function parseEditorBlocks(blocks) {
    if (!Array.isArray(blocks)) return "";
    return blocks.map(b => b.data?.text?.replace(/<[^>]*>?/gm, '') || "").join("\n");
}

async function getDynamicNewsFromAPI(query) {
    try {
        // --- BƯỚC 1: LẤY DANH SÁCH CATEGORIES TỪ API MỚI ---
        if (!typesCache.data || (Date.now() - typesCache.lastFetched > CACHE_DURATION)) {
            // Thay URL dưới đây bằng endpoint API mới của bạn (ví dụ: /news/types)
            const resTypes = await axios.get('https://cnkh.onrender.com/news/typeof', { timeout: 30000 });

            // Lấy mảng data từ API trả về
            let fetchedTypes = resTypes.data.data;

            // Đảm bảo luôn có 'generalNews' trong mảng để dự phòng
            if (!fetchedTypes.includes('generalNews')) {
                fetchedTypes.push('generalNews');
            }
            typesCache = { data: fetchedTypes, lastFetched: Date.now() };
        }
        const categories = typesCache.data;

        // --- BƯỚC 2: AI PHÂN LOẠI INTENT DỰA TRÊN CATEGORIES VỪA LẤY ---
        const intent = await classifyUserIntent(query, categories);

        // --- BƯỚC 3: LẤY VÀ LỌC BÀI VIẾT TỪ API NEWS ---
        if (!newsCache.data || (Date.now() - newsCache.lastFetched > CACHE_DURATION)) {
            const response = await axios.get('https://cnkh.onrender.com/news', { timeout: 30000 });
            newsCache = { data: response.data.data, lastFetched: Date.now() };
        }
        const articles = newsCache.data;

        // Lọc bài viết theo intent AI vừa trả ra
        const filtered = intent === 'generalNews'
            ? articles.slice(0, 3)
            : articles.filter(a => a.typeOf === intent);

        // Xử lý trường hợp không có bài viết nào
        if (filtered.length === 0) return "[TIN TỨC]: Hiện tại chưa có bài viết nào thuộc chủ đề này.";

        // --- BƯỚC 4: FORMAT KẾT QUẢ TRẢ VỀ ---
        return `[TIN TỨC]:\n` + filtered.slice(0, 3).map(a => `Tiêu đề: ${a.title}\nNội dung: ${parseEditorBlocks(a.content?.blocks)}`).join("\n---\n");

    } catch (error) {
        console.error("Lỗi fetch tin tức:", error);
        return "";
    }
}
module.exports = { getDynamicNewsFromAPI };