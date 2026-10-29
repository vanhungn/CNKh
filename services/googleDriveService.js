const { google } = require("googleapis");
const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
const Tesseract = require("tesseract.js");
const canvasPkg = require("@napi-rs/canvas");
const { createCanvas } = canvasPkg;
const fs = require("fs");
const path = require("path");
const os = require("os");
const mammoth = require("mammoth");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIMES = [DOCX_MIME, "application/msword"]; // .docx và .doc

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
const FOLDER_ID = "1A4nU8hvFCz9Yf3ggbAGf-Zsk1rUGlEEb";

// Cần quyền đầy đủ để tạo bản sao tạm khi đổi Word -> PDF
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "../credentials.json"),
    scopes: ["https://www.googleapis.com/auth/drive"]
});
const drive = google.drive({ version: "v3", auth });

async function downloadPDFsFromDrive(processedFileIds = []) {
    try {
        const mimeTypes = ["application/pdf", DOCX_MIME];
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

// ================= XEM WORD: chuyển sang PDF qua Google Docs =================
async function streamWordAsPdf(fileId, name, res) {
    let copyId;
    try {
        const copy = await drive.files.copy({
            fileId,
            requestBody: { name: `tmp_${fileId}`, mimeType: "application/vnd.google-apps.document" },
            fields: "id",
        });
        copyId = copy.data.id;

        const pdf = await drive.files.export(
            { fileId: copyId, mimeType: "application/pdf" },
            { responseType: "arraybuffer" }
        );

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename*=UTF-8''${encodeURIComponent(name.replace(/\.docx?$/i, "") + ".pdf")}`
        );
        res.send(Buffer.from(pdf.data));
    } finally {
        if (copyId) await drive.files.delete({ fileId: copyId }).catch(() => { });
    }
}

// Dự phòng: docx -> HTML bằng mammoth
async function streamDocxAsHtml(fileId, name, res) {
    const resp = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(resp.data) });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>${name}</title>
<style>
  body { background:#e9e9e9; margin:0; padding:24px; }
  .page { background:#fff; width:210mm; max-width:100%; margin:0 auto; padding:20mm; box-sizing:border-box;
          font:13pt/1.5 "Times New Roman",serif; box-shadow:0 0 6px rgba(0,0,0,.25); }
  p { margin:6px 0; }
  table { border-collapse:collapse; width:100%; }
  td, th { border:1px solid #000; padding:6px; vertical-align:top; }
</style></head><body><div class="page">${html}</div></body></html>`);
}

// ================= STREAM FILE CHO NGƯỜI DÙNG XEM / TẢI =================
async function streamDriveFile(fileId, res, { download = false } = {}) {
    // 1. Lấy thông tin file và kiểm tra thư mục
    const meta = await drive.files.get({ fileId, fields: "name,mimeType,parents" });
    const { name, mimeType, parents } = meta.data;

    if (!parents || !parents.includes(FOLDER_ID)) {
        const err = new Error("FORBIDDEN");
        err.code = 403;
        throw err;
    }

    // 2. XEM file Word: đổi sang PDF; lỗi thì dự phòng bằng HTML
    if (!download && DOC_MIMES.includes(mimeType)) {
        try {
            return await streamWordAsPdf(fileId, name, res);
        } catch (e) {
            console.error("⚠️ Không đổi được sang PDF:", e.code, e.message);
            if (mimeType === DOCX_MIME && !res.headersSent) {
                return streamDocxAsHtml(fileId, name, res);
            }
            throw e;
        }
    }

    // 3. TẢI về, hoặc XEM các loại khác (PDF, ảnh...)
    const isGoogleDoc = mimeType.startsWith("application/vnd.google-apps.");
    const stream = isGoogleDoc
        ? await drive.files.export({ fileId, mimeType: "application/pdf" }, { responseType: "stream" })
        : await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });

    const outName = isGoogleDoc ? `${name}.pdf` : name;
    res.setHeader("Content-Type", isGoogleDoc ? "application/pdf" : mimeType);
    res.setHeader(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(outName)}`
    );

    stream.data.on("error", () => res.end());
    stream.data.pipe(res);
}

module.exports = { downloadPDFsFromDrive, streamDriveFile };