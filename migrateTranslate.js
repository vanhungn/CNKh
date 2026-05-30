const mongoose = require('mongoose');
const { ChatOpenAI } = require("@langchain/openai");
require('dotenv').config();

// 1. CẤU HÌNH KẾT NỐI MONGODB & LLM
const MONGODB_URI = process.env.MONGODB_URI;

const llm = new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    modelName: "openai/gpt-4o-mini",
    temperature: 0,
    maxRetries: 3
});

const newsSchema = new mongoose.Schema({
    typeOf: String,
    title: String,
    titleEN: String,
    note: String,
    noteEN: String,
    img: { etag: String, url: String },
    content: mongoose.Schema.Types.Mixed,
    contentEN: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const News = mongoose.model('News', newsSchema, 'news');

// =====================================================================
// HÀM 1: CHỈ DỊCH TITLE VÀ NOTE (TÍCH HỢP AUTO-RETRY VÀ CHỐNG AI "LƯỜI")
// =====================================================================
async function translateTitleAndNote(title, note) {
    if (!title && !note) return { titleEN: "", noteEN: "" };

    try {
        const payload = {};
        // Tự đổi tên Key trước luôn bằng code để AI chỉ tập trung dịch chữ
        if (title && typeof title === 'string' && title.trim().length > 0) payload.titleEN = title.trim();
        if (note && typeof note === 'string' && note.trim().length > 0) payload.noteEN = note.trim();

        if (Object.keys(payload).length === 0) return { titleEN: "", noteEN: "" };

        let translatedObj = null;
        let retryCount = 0;

        while (retryCount <= 2 && !translatedObj) {
            try {
                // Dùng Prompt Tiếng Anh để ép AI dịch chuẩn xác, không chép lại bản gốc
                const prompt = `Translate the values of the following JSON object from Vietnamese to English.
                STRICT REQUIREMENTS:
                1. The translated values MUST be in English. Do not keep Vietnamese words.
                2. Return ONLY a valid JSON object. No markdown, no explanations.
                3. Escape all double quotes inside the string values using \\".
                JSON to translate:
                ${JSON.stringify(payload)}`;

                const response = await llm.invoke(prompt);
                const resText = typeof response === 'string' ? response : response.content;

                const jsonMatch = resText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Không tìm thấy JSON Object");

                let cleanJsonString = jsonMatch[0];
                cleanJsonString = cleanJsonString.replace(/,\s*([\]}])/g, '$1');
                cleanJsonString = cleanJsonString.replace(/[\u0000-\u001F]+/g, " ");

                translatedObj = JSON.parse(cleanJsonString);

                // Chốt chặn chống lười: Nếu AI trả về tiếng Việt y hệt bản gốc, ép lỗi để dịch lại
                if (translatedObj.titleEN && translatedObj.titleEN === payload.titleEN) {
                    throw new Error("AI lười biếng không chịu dịch Title sang tiếng Anh!");
                }

            } catch (err) {
                retryCount++;
                console.log(`      ⚠️ Lỗi dịch Title/Note: ${err.message}. Đang thử lại lần ${retryCount}...`);
                if (retryCount > 2) throw err;
                await sleep(1000);
            }
        }

        return {
            titleEN: translatedObj?.titleEN || "",
            noteEN: translatedObj?.noteEN || ""
        };
    } catch (error) {
        console.error("❌ Lỗi cứng khi dịch Title/Note:", error.message);
        return null;
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================================
// HÀM 2: CHẠY QUÉT DATABASE (TỐI ƯU CHỈ LỌC BÀI LỖI/THIẾU ĐỂ TIẾT KIỆM TOKEN)
// =====================================================================
async function runTranslationMigration() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Đã kết nối MongoDB. Bắt đầu quét Title và Note...");

        // CHỈ TÌM NHỮNG BÀI: Thiếu titleEN, thiếu noteEN, hoặc titleEN bị AI dịch lỗi (giống hệt title)
        const cursor = News.find({
            $or: [
                { titleEN: { $exists: false } },
                { titleEN: null },
                { titleEN: "" },
                { noteEN: { $exists: false } },
                { noteEN: null },
                { noteEN: "" },
                { $expr: { $eq: ["$title", "$titleEN"] } } // Bắt lỗi AI chép nguyên tiếng Việt
            ]
        }).cursor();

        let count = 0;

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            console.log(`\n⏳ Đang xử lý Title/Note cho ID: ${doc._id} | Tiêu đề gốc: ${doc.title}`);
            let isUpdated = false;

            // Bỏ phần xử lý content đi, chỉ xử lý Title và Note
            if (doc.title || doc.note) {
                const translatedTitleNote = await translateTitleAndNote(doc.title, doc.note);
                if (translatedTitleNote) {
                    if (translatedTitleNote.titleEN && translatedTitleNote.titleEN !== doc.title) {
                        doc.titleEN = translatedTitleNote.titleEN;
                        isUpdated = true;
                    }
                    if (translatedTitleNote.noteEN) {
                        doc.noteEN = translatedTitleNote.noteEN;
                        isUpdated = true;
                    }
                }
            }

            if (isUpdated) {
                await doc.save();
                console.log(`✅ Cập nhật Title/Note thành công: ${doc.titleEN}`);
                count++;
            } else {
                console.log(`⏩ Bỏ qua bài này (Không thể dịch hoặc đã dịch chuẩn).`);
            }

            await sleep(1500); // Tối ưu tốc độ, lách Rate Limit mượt mà
        }

        console.log(`\n🎉 HOÀN TẤT! Đã quét và fix thành công Title/Note cho ${count} bài viết.`);
        process.exit(0); // Chủ động đóng tiến trình Node khi xong việc

    } catch (error) {
        console.error("❌ Lỗi hệ thống:", error);
        process.exit(1);
    }
}

runTranslationMigration();