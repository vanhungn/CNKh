// ingest.js
const { syncDriveToVectorDB } = require('./services/vectorService');

async function run() {
    try {
        console.log("🚀 KHỞI ĐỘNG TIẾN TRÌNH CẬP NHẬT DỮ LIỆU...");
        // Gọi hàm băm vector lũy tiến mà chúng ta đã viết
        await syncDriveToVectorDB();

        console.log("🎉 HOÀN TẤT! Đóng tiến trình.");
        process.exit(0); // Lệnh này giúp tự động tắt Terminal sau khi chạy xong
    } catch (error) {
        console.error("❌ Lỗi:", error);
        process.exit(1);
    }
}

run();