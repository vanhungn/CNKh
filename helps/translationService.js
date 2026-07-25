const { ChatOpenAI } = require("@langchain/openai");
require('dotenv').config();

// 1. Cấu hình AI (Dùng gpt-4o-mini siêu chuẩn JSON và hiệu năng ổn định)
const llm = new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: "https://openrouter.ai/api/v1" },
    modelName: "openai/gpt-4o-mini", // Model chuyên trị cấu trúc JSON
    temperature: 0,
    maxRetries: 3
});

// Hàm tiện ích để tạm dừng (Dùng cho quá trình Retry)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// =====================================================================
// HÀM 1: THUẬT TOÁN QUÉT SÂU + AUTO-RETRY DỊCH NỘI DUNG EDITOR.JS
// =====================================================================
async function translateEditorContent(originalEditorData) {
    if (!originalEditorData || !originalEditorData.blocks) return originalEditorData;

    try {
        let translatedData = JSON.parse(JSON.stringify(originalEditorData));
        let textsToTranslate = [];

        const addText = (blockId, path, text) => {
            if (typeof text === 'string') {
                const cleanText = text.trim();
                if (cleanText.length > 0 && cleanText !== '&nbsp;' && cleanText !== '<br>') {
                    textsToTranslate.push({ id: `${blockId}__${path}`, text: text });
                }
            }
        };

        // Bóc tách sâu
        translatedData.blocks.forEach(block => {
            const data = block.data;
            if (!data) return;

            if (block.type === 'paragraph' || block.type === 'header' || block.type === 'quote') {
                addText(block.id, 'text', data.text);
                addText(block.id, 'caption', data.caption);
            }
            if (block.type === 'image' || block.type === 'embed' || block.type === 'video') {
                addText(block.id, 'caption', data.caption);
            }
            if (block.type === 'table' && Array.isArray(data.content)) {
                data.content.forEach((row, rowIndex) => {
                    if (Array.isArray(row)) row.forEach((cell, cellIndex) => addText(block.id, `content_${rowIndex}_${cellIndex}`, cell));
                });
            }
            if (block.type === 'list' && Array.isArray(data.items)) {
                const extractList = (items, prefix) => {
                    items.forEach((item, index) => {
                        if (typeof item === 'string') {
                            addText(block.id, `${prefix}_${index}`, item);
                        } else if (item && typeof item === 'object') {
                            addText(block.id, `${prefix}_${index}_content`, item.content);
                            if (Array.isArray(item.items)) extractList(item.items, `${prefix}_${index}_items`);
                        }
                    });
                };
                extractList(data.items, 'items');
            }
        });

        if (textsToTranslate.length === 0) return translatedData;

        let allTranslatedItems = [];
        // HẠ BATCH_SIZE XUỐNG 12: Đảm bảo AI không bị hụt hơi
        const BATCH_SIZE = 12;

        for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
            const batch = textsToTranslate.slice(i, i + BATCH_SIZE);
            const partNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalParts = Math.ceil(textsToTranslate.length / BATCH_SIZE);

            console.log(`   -> [Dịch ngầm Content] Đang xử lý phần ${partNum}/${totalParts}...`);

            let batchTranslatedArray = null;
            let retryCount = 0;
            const MAX_RETRIES = 2; // AI được phép sai và làm lại tối đa 2 lần

            while (retryCount <= MAX_RETRIES && !batchTranslatedArray) {
                try {
                    const prompt = `Dịch trường "text" trong mảng JSON sau sang Tiếng Anh. Giữ nguyên "id".
                    YÊU CẦU BẮT BUỘC ĐỂ HỆ THỐNG KHÔNG BỊ SẬP: 
                    1. CHỈ TRẢ VỀ MẢNG JSON, KHÔNG BỌC TRONG MARKDOWN.
                    2. TẤT CẢ dấu ngoặc kép (") và dấu gạch chéo (\\) bên trong giá trị chuỗi phải được escape đúng chuẩn JSON (VD: dùng \\" thay vì ").
                    3. Ký tự xuống dòng thay bằng khoảng trắng hoặc \\n.
                    Dữ liệu:
                    ${JSON.stringify(batch)}`;

                    const response = await llm.invoke(prompt);
                    const resText = typeof response === 'string' ? response : response.content;

                    const jsonMatch = resText.match(/\[[\s\S]*\]/);
                    if (!jsonMatch) throw new Error("Không tìm thấy mảng JSON");

                    let cleanJsonString = jsonMatch[0];

                    // Lớp khiên bảo vệ
                    cleanJsonString = cleanJsonString.replace(/,\s*([\]}])/g, '$1');
                    cleanJsonString = cleanJsonString.replace(/[\u0000-\u001F]+/g, " ");

                    batchTranslatedArray = JSON.parse(cleanJsonString);

                } catch (parseError) {
                    retryCount++;
                    console.log(`      ⚠️ [Dịch ngầm] Lỗi Parse JSON phần ${partNum}. Thử lại (Lần ${retryCount}/${MAX_RETRIES})...`);
                    if (retryCount > MAX_RETRIES) throw new Error(`Hủy phần ${partNum} do lỗi AI: ${parseError.message}`);
                    await sleep(1500);
                }
            }

            if (batchTranslatedArray) {
                allTranslatedItems = allTranslatedItems.concat(batchTranslatedArray);
            }
        }

        const getTrans = (blockId, path) => {
            const found = allTranslatedItems.find(i => i.id === `${blockId}__${path}`);
            return found ? found.text : null;
        };

        // Ráp dữ liệu
        translatedData.blocks.forEach(block => {
            const data = block.data;
            if (!data) return;

            if (block.type === 'paragraph' || block.type === 'header' || block.type === 'quote') {
                let t = getTrans(block.id, 'text'); if (t) data.text = t;
                let c = getTrans(block.id, 'caption'); if (c) data.caption = c;
            }
            if (block.type === 'image' || block.type === 'embed' || block.type === 'video') {
                let c = getTrans(block.id, 'caption'); if (c) data.caption = c;
            }
            if (block.type === 'table' && Array.isArray(data.content)) {
                data.content.forEach((row, rowIndex) => {
                    if (Array.isArray(row)) row.forEach((cell, cellIndex) => {
                        let t = getTrans(block.id, `content_${rowIndex}_${cellIndex}`);
                        if (t) data.content[rowIndex][cellIndex] = t;
                    });
                });
            }
            if (block.type === 'list' && Array.isArray(data.items)) {
                const applyList = (items, prefix) => {
                    items.forEach((item, index) => {
                        if (typeof item === 'string') {
                            let t = getTrans(block.id, `${prefix}_${index}`);
                            if (t) items[index] = t;
                        } else if (item && typeof item === 'object') {
                            let t = getTrans(block.id, `${prefix}_${index}_content`);
                            if (t) item.content = t;
                            if (Array.isArray(item.items)) applyList(item.items, `${prefix}_${index}_items`);
                        }
                    });
                };
                applyList(data.items, 'items');
            }
        });

        return translatedData;
    } catch (error) {
        console.error("❌ Lỗi cấu trúc dịch Content:", error.message);
        return null;
    }
}

// =====================================================================
// HÀM 2: DỊCH TITLE VÀ NOTE (CHỐNG AI LƯỜI BIẾNG & AUTO-RETRY)
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

        // Vòng lặp bảo vệ JSON và chống AI copy y nguyên
        while (retryCount <= 2 && !translatedObj) {
            try {
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

                // CHỐT CHẶN CHỐNG LƯỜI: Nếu AI nhả về tiếng Việt y hệt bản gốc, báo lỗi để dịch lại
                if (translatedObj.titleEN && translatedObj.titleEN === payload.titleEN) {
                    throw new Error("AI lười biếng trả về tiếng Việt!");
                }

            } catch (err) {
                retryCount++;
                console.log(`      ⚠️ [Dịch ngầm Title/Note] Lỗi: ${err.message}. Đang thử lại (${retryCount}/2)...`);
                if (retryCount > 2) throw err;
                await sleep(1000);
            }
        }

        return {
            titleEN: translatedObj?.titleEN || "",
            noteEN: translatedObj?.noteEN || ""
        };
    } catch (error) {
        console.error("❌ Lỗi dịch Title/Note (translationService):", error.message);
        return null;
    }
}
async function translateMenuContentDiff(oldMenu, newMenu) {
    if (!newMenu || !Array.isArray(newMenu)) return newMenu;

    try {
        let mergedMenu = JSON.parse(JSON.stringify(newMenu));
        const safeOldMenu = Array.isArray(oldMenu) ? oldMenu : [];
        let textsToTranslate = [];

        const same = (a, b) =>
            typeof a === 'string' && typeof b === 'string' && a.trim() === b.trim();

        // Tìm theo _id thay vì index -> chính xác dù có thêm/xoá/đảo vị trí
        const findById = (arr, id) => (arr || []).find(x => String(x._id) === String(id));

        mergedMenu.forEach((m) => {
            // Tính key MỘT LẦN và lưu tạm vào item -> dùng lại y hệt lúc lấy kết quả về,
            // tránh trường hợp Math.random() sinh ra 2 giá trị khác nhau ở 2 bước.
            const mKey = m._id ? `m_${m._id}` : `m_r_${Math.random()}`;
            m.__transKey = mKey;

            const old = m._id ? findById(safeOldMenu, m._id) : null;
            if (old && same(old.title, m.title) && old.titleEN) {
                m.titleEN = old.titleEN;
            } else if (m.title && m.title.trim()) {
                textsToTranslate.push({ id: mKey, text: m.title });
            }

            (m.menu1 || []).forEach((m1) => {
                const m1Key = m1._id ? `m1_${m1._id}` : `m1_r_${Math.random()}`;
                m1.__transKey = m1Key;

                const old1 = m1._id ? findById(old?.menu1, m1._id) : null;
                if (old1 && same(old1.titleMenu, m1.titleMenu) && old1.titleMenuEN) {
                    m1.titleMenuEN = old1.titleMenuEN;
                } else if (m1.titleMenu && m1.titleMenu.trim()) {
                    textsToTranslate.push({ id: m1Key, text: m1.titleMenu });
                }

                (m1.menu2 || []).forEach((m2) => {
                    const m2Key = m2._id ? `m2_${m2._id}` : `m2_r_${Math.random()}`;
                    m2.__transKey = m2Key;

                    const old2 = m2._id ? findById(old1?.menu2, m2._id) : null;
                    if (old2 && same(old2.titleChildrenMenu, m2.titleChildrenMenu) && old2.titleChildrenMenuEN) {
                        m2.titleChildrenMenuEN = old2.titleChildrenMenuEN;
                    } else if (m2.titleChildrenMenu && m2.titleChildrenMenu.trim()) {
                        textsToTranslate.push({ id: m2Key, text: m2.titleChildrenMenu });
                    }
                });
            });
        });

        if (textsToTranslate.length === 0) {
            console.log("✅ [Dịch ngầm Menu] Không có title nào thay đổi. Bỏ qua dịch, tiết kiệm token.");
            cleanupTransKeys(mergedMenu);
            return mergedMenu;
        }

        console.log(`   -> [Dịch ngầm Menu] Phát hiện ${textsToTranslate.length} title mới/thay đổi, cần dịch.`);

        let allTranslatedItems = [];
        const BATCH_SIZE = 12;

        for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
            const batch = textsToTranslate.slice(i, i + BATCH_SIZE);
            const partNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalParts = Math.ceil(textsToTranslate.length / BATCH_SIZE);

            console.log(`   -> [Dịch ngầm Menu] Đang xử lý phần ${partNum}/${totalParts}...`);

            let batchTranslatedArray = null;
            let retryCount = 0;
            const MAX_RETRIES = 2;

            while (retryCount <= MAX_RETRIES && !batchTranslatedArray) {
                try {
                    const prompt = `Dịch trường "text" trong mảng JSON sau sang Tiếng Anh. Giữ nguyên "id".
                    YÊU CẦU BẮT BUỘC ĐỂ HỆ THỐNG KHÔNG BỊ SẬP:
                    1. CHỈ TRẢ VỀ MẢNG JSON, KHÔNG BỌC TRONG MARKDOWN.
                    2. TẤT CẢ dấu ngoặc kép (") và dấu gạch chéo (\\) bên trong giá trị chuỗi phải được escape đúng chuẩn JSON.
                    3. Ký tự xuống dòng thay bằng khoảng trắng hoặc \\n.
                    4. Đây là tiêu đề menu điều hướng website, dịch ngắn gọn, đúng văn phong menu.
                    Dữ liệu:
                    ${JSON.stringify(batch)}`;

                    const response = await llm.invoke(prompt);
                    const resText = typeof response === 'string' ? response : response.content;

                    const jsonMatch = resText.match(/\[[\s\S]*\]/);
                    if (!jsonMatch) throw new Error("Không tìm thấy mảng JSON");

                    let cleanJsonString = jsonMatch[0];
                    cleanJsonString = cleanJsonString.replace(/,\s*([\]}])/g, '$1');
                    cleanJsonString = cleanJsonString.replace(/[\u0000-\u001F]+/g, " ");

                    batchTranslatedArray = JSON.parse(cleanJsonString);

                } catch (parseError) {
                    retryCount++;
                    console.log(`      ⚠️ [Dịch ngầm Menu] Lỗi Parse JSON phần ${partNum}. Thử lại (Lần ${retryCount}/${MAX_RETRIES})...`);
                    if (retryCount > MAX_RETRIES) throw new Error(`Hủy phần ${partNum} do lỗi AI: ${parseError.message}`);
                    await sleep(1500);
                }
            }

            if (batchTranslatedArray) {
                allTranslatedItems = allTranslatedItems.concat(batchTranslatedArray);
            }
        }

        const getTrans = (id) => {
            const found = allTranslatedItems.find(item => item.id === id);
            return found ? found.text : null;
        };

        mergedMenu.forEach((m) => {
            const t = getTrans(m.__transKey);
            if (t) m.titleEN = t;

            (m.menu1 || []).forEach((m1) => {
                const t1 = getTrans(m1.__transKey);
                if (t1) m1.titleMenuEN = t1;

                (m1.menu2 || []).forEach((m2) => {
                    const t2 = getTrans(m2.__transKey);
                    if (t2) m2.titleChildrenMenuEN = t2;
                });
            });
        });

        cleanupTransKeys(mergedMenu);
        return mergedMenu;
    } catch (error) {
        console.error("❌ Lỗi cấu trúc dịch Menu (diff):", error.message);
        return null;
    }
}

// Xóa field tạm __transKey trước khi trả về, tránh lưu field rác vào MongoDB
function cleanupTransKeys(mergedMenu) {
    mergedMenu.forEach((m) => {
        delete m.__transKey;
        (m.menu1 || []).forEach((m1) => {
            delete m1.__transKey;
            (m1.menu2 || []).forEach((m2) => {
                delete m2.__transKey;
            });
        });
    });
}

// Xuất bản 2 hàm xử lý cốt lõi
module.exports = { translateEditorContent, translateTitleAndNote, translateMenuContentDiff };