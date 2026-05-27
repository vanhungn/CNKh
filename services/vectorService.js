const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { downloadPDFsFromDrive } = require("./googleDriveService");
const { pipeline } = require("@xenova/transformers");
const path = require("path");
const fs = require("fs");
require('dotenv').config();

class LocalOfflineEmbeddings {
    constructor() {
        this.extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    async embedDocuments(texts) {
        const extractor = await this.extractorPromise;
        const output = await extractor(texts, { pooling: "mean", normalize: true });
        return output.tolist();
    }
    async embedQuery(text) {
        const extractor = await this.extractorPromise;
        const output = await extractor(text, { pooling: "mean", normalize: true });
        const list = output.tolist();
        return list[0];
    }
}

const embeddings = new LocalOfflineEmbeddings();
const VECTOR_STORE_PATH = path.join(__dirname, "../vector_store");
const TRACKING_FILE_PATH = path.join(VECTOR_STORE_PATH, "processed_files.json");

function getProcessedFileIds() {
    if (!fs.existsSync(TRACKING_FILE_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(TRACKING_FILE_PATH, 'utf8')); } catch { return []; }
}

function saveProcessedFileIds(newIds) {
    const existingIds = getProcessedFileIds();
    const updatedIds = [...new Set([...existingIds, ...newIds])];
    if (!fs.existsSync(VECTOR_STORE_PATH)) fs.mkdirSync(VECTOR_STORE_PATH, { recursive: true });
    fs.writeFileSync(TRACKING_FILE_PATH, JSON.stringify(updatedIds, null, 2), 'utf8');
}

async function searchVectorDB(query) {
    if (!fs.existsSync(path.join(VECTOR_STORE_PATH, "hnswlib.index"))) return [];
    const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    const results = await vectorStore.similaritySearchWithScore(query, 3);
    return results.map(([doc, score]) => ({ pageContent: doc.pageContent, metadata: doc.metadata }));
}

async function syncDriveToVectorDB() {
    const processedIds = getProcessedFileIds();
    const newDocs = await downloadPDFsFromDrive(processedIds);
    if (!newDocs.length) return;

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 600, chunkOverlap: 100 });
    const chunks = await splitter.splitDocuments(newDocs);

    let vectorStore = fs.existsSync(path.join(VECTOR_STORE_PATH, "hnswlib.index")) 
        ? await HNSWLib.load(VECTOR_STORE_PATH, embeddings) 
        : await HNSWLib.fromDocuments(chunks, embeddings);

    if (vectorStore.index) await vectorStore.addDocuments(chunks);
    await vectorStore.save(VECTOR_STORE_PATH);
    saveProcessedFileIds(newDocs.map(d => d.metadata.fileId));
}

module.exports = { searchVectorDB, syncDriveToVectorDB };