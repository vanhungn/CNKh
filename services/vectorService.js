const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { MongoClient } = require("mongodb");
const { downloadPDFsFromDrive } = require("./googleDriveService");
require('dotenv').config();

// 1. CẤU HÌNH KẾT NỐI MONGODB & API NHÚNG
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("chatbot_rag");

const collection = db.collection("documents");               // vector các đoạn văn bản
const trackingCollection = db.collection("processed_files"); // file đã xử lý
const contentsCollection = db.collection("drive_contents");  // toàn văn từng file (để trả nội dung biểu mẫu)

const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "NCKH_Bot"
        }
    },
    modelName: "openai/text-embedding-3-small",
    batchSize: 50,
    maxRetries: 3,
});

// --- QUẢN LÝ FILE ĐÃ XỬ LÝ ---
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
            console.log("Không có file PDF/DOCX nào mới để cập nhật.");
            return;
        }

        // Lưu TOÀN VĂN từng file (trước khi băm nhỏ)
        await contentsCollection.bulkWrite(newDocs.map(d => ({
            updateOne: {
                filter: { fileId: d.metadata.fileId },
                update: {
                    $set: {
                        fileId: d.metadata.fileId,
                        fileName: d.metadata.fileName,
                        content: d.pageContent,
                        updatedAt: new Date(),
                    },
                },
                upsert: true,
            },
        })));

        console.log(`Đang băm nhỏ ${newDocs.length} file...`);
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 200 });
        const chunks = await splitter.splitDocuments(newDocs);

        // Gắn tên file vào nội dung chunk để tìm theo nội dung cũng nhận ra đúng tài liệu
        chunks.forEach(c => {
            c.pageContent = `[Tài liệu: ${c.metadata.fileName}]\n${c.pageContent}`;
        });

        console.log("Đang tạo Vector OpenAI và lưu lên MongoDB Atlas...");
        await MongoDBAtlasVectorSearch.fromDocuments(chunks, embeddings, {
            collection: collection,
            indexName: "vector_index",
            textKey: "text",
            embeddingKey: "embedding",
        });

        const doneIds = [...new Set(newDocs.map(d => d.metadata.fileId))];
        await saveProcessedFileIds(doneIds);
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

        const results = await vectorStore.similaritySearchWithScore(query, 8);
        return results.map(([doc, score]) => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
            score, // giữ điểm để lọc bớt file khớp lỏng
        }));
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm:", error);
        return [];
    }
}

// --- HÀM 3: LẤY TOÀN VĂN 1 FILE ---
async function getFileContent(fileId) {
    try {
        await client.connect();
        return await contentsCollection.findOne({ fileId });
    } catch (error) {
        console.error("❌ Lỗi khi lấy nội dung file:", error);
        return null;
    }
}

module.exports = { searchVectorDB, syncDriveToVectorDB, getFileContent };