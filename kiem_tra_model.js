// kiem_tra_model.js
require('dotenv').config();

async function checkModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log("❌ Không tìm thấy GEMINI_API_KEY trong file .env");
        return;
    }

    try {
        console.log("Đang kết nối tới máy chủ Google để lấy danh sách Model...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        console.log("\n✅ CÁC MODEL BẠN ĐƯỢC PHÉP SỬ DỤNG LÀ:");
        console.log("---------------------------------------");
        
        data.models.forEach(m => {
            // Chỉ lọc ra những con AI có chức năng chat (generateContent)
            if (m.supportedGenerationMethods.includes("generateContent")) {
                // Cắt bỏ chữ "models/" ở đầu để lấy tên gốc
                console.log("👉", m.name.replace("models/", ""));
            }
        });
        console.log("---------------------------------------");
    } catch (error) {
        console.log("❌ Lỗi kết nối:", error);
    }
}

checkModels();