const { google } = require("googleapis");
const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
const Tesseract = require("tesseract.js");
const canvasPkg = require("@napi-rs/canvas");
const { createCanvas } = canvasPkg;
const fs = require("fs");
const path = require("path");
const os = require("os");

// ================= POLYFILL & PDFJS =================
global.Image = canvasPkg.Image;
global.Canvas = canvasPkg.Canvas;

let _pdfjs = null;
const getPdfjsLib = async () => {
    if (!_pdfjs) _pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    return _pdfjs;
};

// ================= HÀM XỬ LÝ TEXT & OCR =================
const extractTextFromPdf = async (filePath) => {
    const pdfjs = await getPdfjsLib();
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjs.getDocument({ data }).promise;
    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText;
};

const ocrPdfWithCanvas = async (filePath) => {
    const pdfjs = await getPdfjsLib();
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjs.getDocument({ data }).promise;
    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = createCanvas(viewport.width, viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const result = await Tesseract.recognize(canvas.toBuffer("image/png"), "vie");
        fullText += result.data.text + "\n";
    }
    return fullText;
};

// ================= GOOGLE DRIVE SERVICE =================
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "../credentials.json"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"]
});
const drive = google.drive({ version: "v3", auth });

async function downloadPDFsFromDrive(processedFileIds = []) {
    const FOLDER_ID = "1A4nU8hvFCz9Yf3ggbAGf-Zsk1rUGlEEb";
    try {
        const mimeTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        let q = `'${FOLDER_ID}' in parents and trashed = false and (${mimeTypes.map(m => `mimeType='${m}'`).join(" or ")})`;

        const response = await drive.files.list({ q, fields: "files(id,name,mimeType)" });
        const files = (response.data.files || []).filter(f => !processedFileIds.includes(f.id));

        if (!files.length) return [];

        const tempDir = path.join(os.tmpdir(), "nckh_temp_docs");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const allLoadedDocs = [];
        for (const file of files) {
            const ext = file.mimeType.includes("pdf") ? "pdf" : "docx";
            const tempPath = path.join(tempDir, `dl_${file.id}.${ext}`);

            const fileStream = await drive.files.get({ fileId: file.id, alt: "media" }, { responseType: "stream" });
            await new Promise((resolve, reject) => {
                const writer = fs.createWriteStream(tempPath);
                fileStream.data.pipe(writer).on("finish", resolve).on("error", reject);
            });

            let content = "";
            if (ext === "pdf") {
                let text = await extractTextFromPdf(tempPath);
                content = (text.replace(/\s/g, "").length >= 50) ? text : await ocrPdfWithCanvas(tempPath);
            } else {
                const loader = new DocxLoader(tempPath);
                content = (await loader.load()).map(d => d.pageContent).join("\n");
            }

            if (content.trim()) {
                allLoadedDocs.push({ pageContent: content, metadata: { fileName: file.name, fileId: file.id } });
            }
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
        return allLoadedDocs;
    } catch (err) {
        console.error("❌ Lỗi Google Drive:", err);
        return [];
    }
}

module.exports = { downloadPDFsFromDrive };