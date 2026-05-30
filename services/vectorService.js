const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { OpenAIEmbeddings } = require("@langchain/openai"); // Thay đổi ở đây
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { MongoClient } = require("mongodb");
const { downloadPDFsFromDrive } = require("./googleDriveService");
require('dotenv').config();

// 1. CẤU HÌNH KẾT NỐI MONGODB & API NHÚNG
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("chatbot_rag");

// Tạo 2 collection: 1 lưu Vector văn bản, 1 lưu lịch sử file đã xử lý
const collection = db.collection("documents");
const trackingCollection = db.collection("processed_files");

// Sử dụng OpenAI Embeddings qua OpenRouter để băm và nhúng không lo giới hạn request
const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000", // OpenRouter đôi khi yêu cầu cái này
            "X-Title": "NCKH_Bot"
        }
    },
    modelName: "openai/text-embedding-3-small",
    batchSize: 50, // QUAN TRỌNG NHẤT: Băm gói dữ liệu ra gửi từ từ để không bị ngợp server
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
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 200 });
        const chunks = await splitter.splitDocuments(newDocs);

        console.log("Đang tạo Vector OpenAI và lưu lên MongoDB Atlas...");
        await MongoDBAtlasVectorSearch.fromDocuments(chunks, embeddings, {
            collection: collection,
            indexName: "vector_index", // Tên index bạn vừa tạo thành công trên web
            textKey: "text",
            embeddingKey: "embedding",
        });

        await saveProcessedFileIds(newDocs.map(d => d.metadata.fileId));
        console.log("✅ Cập nhật kiến thức cho AI thành công bằng OpenAI Embeddings!");

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

        // Tìm 5 đoạn văn bản có độ tương đồng cao nhất với câu hỏi
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