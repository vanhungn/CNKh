const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { MongoClient } = require("mongodb");
const { downloadPDFsFromDrive } = require("./googleDriveService");
require('dotenv').config();

// 1. CẤU HÌNH KẾT NỐI MONGODB & API NHÚNG
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("chatbot_rag"); // Bạn có thể đổi tên DB tùy ý

// Tạo 2 collection: 1 lưu Vector văn bản, 1 lưu lịch sử file đã xử lý
const collection = db.collection("documents");
const trackingCollection = db.collection("processed_files");

// Gọi API của Google Gemini để nhúng chữ thành số (Siêu nhẹ, không tốn RAM server)
const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-embedding-001",
    maxConcurrency: 5, // Chỉ gọi tối đa 5 request song song để không làm quá tải API
    maxRetries: 3,
});

// --- CÁC HÀM QUẢN LÝ FILE ĐÃ XỬ LÝ (Lưu thẳng lên DB) ---
async function getProcessedFileIds() {
    const records = await trackingCollection.find({}).toArray();
    return records.map(r => r.fileId);
}

async function saveProcessedFileIds(newIds) {
    if (newIds.length === 0) return;
    const docs = newIds.map(id => ({ fileId: id, processedAt: new Date() }));
    await trackingCollection.insertMany(docs);
}

// --- HÀM 1: ĐỒNG BỘ TỪ GOOGLE DRIVE LÊN MONGODB ---
async function syncDriveToVectorDB() {
    try {
        await client.connect();
        const processedIds = await getProcessedFileIds();

        console.log("Đang tải file mới từ Google Drive...");
        const newDocs = await downloadPDFsFromDrive(processedIds);

        if (!newDocs.length) {
            console.log("Không có file PDF nào mới để cập nhật.");
            return;
        }

        console.log(`Đang băm nhỏ ${newDocs.length} file...`);
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 600, chunkOverlap: 100 });
        const chunks = await splitter.splitDocuments(newDocs);

        console.log("Đang tạo Vector và lưu lên MongoDB Atlas...");
        await MongoDBAtlasVectorSearch.fromDocuments(chunks, embeddings, {
            collection: collection,
            indexName: "vector_index", // Tên index bạn sẽ cấu hình trên MongoDB Atlas
            textKey: "text",
            embeddingKey: "embedding",
        });

        await saveProcessedFileIds(newDocs.map(d => d.metadata.fileId));
        console.log("✅ Cập nhật kiến thức cho AI thành công!");

    } catch (error) {
        console.error("❌ Lỗi khi đồng bộ dữ liệu:", error);
    }
}

// --- HÀM 2: TÌM KIẾM VECTOR (Dành cho Chatbot) ---
async function searchVectorDB(query) {
    try {
        await client.connect();
        const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection: collection,
            indexName: "vector_index",
            textKey: "text",
            embeddingKey: "embedding",
        });

        // Tìm 3 đoạn văn bản có độ tương đồng cao nhất với câu hỏi
        const results = await vectorStore.similaritySearchWithScore(query, 5);
        return results.map(([doc, score]) => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata
        }));
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm:", error);
        return [];
    }
}

module.exports = { searchVectorDB, syncDriveToVectorDB };