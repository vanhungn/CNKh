const { MongoClient } = require("mongodb");
require('dotenv').config();

async function resetDatabase() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db("chatbot_rag");
        
        console.log("🔄 Đang tiến hành xóa dữ liệu cũ trên Cloud...");
        
        // Xóa sạch lịch sử file đã xử lý
        await db.collection("processed_files").deleteMany({});
        // Xóa sạch các đoạn vector cũ
        await db.collection("documents").deleteMany({});
        
        console.log("✅ Đã xóa sạch bách! Giờ DB của bạn đã trống trơn như mới.");
    } catch (error) {
        console.error("❌ Lỗi khi xóa dữ liệu:", error);
    } finally {
        await client.close();
    }
}

resetDatabase();