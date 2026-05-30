const { translateEditorContent, translateTitleAndNote } = require('./translationService'); // Bổ sung thêm hàm dịch Title/Note
const modelNews = require('../modal/news'); // Đã giữ nguyên đường dẫn chuẩn của bạn

class TranslationQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    // CẬP NHẬT: Nhận thêm title và note từ Controller
    addJob(articleId, content, title, note) {
        this.queue.push({ articleId, content, title, note });
        console.log(`📥 Đã đưa bài viết [${articleId}] vào hàng đợi. Đang chờ: ${this.queue.length} bài.`);

        // Nếu cái máy bơm chưa chạy thì bật nó lên
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    // Máy bơm chạy tuần tự từng bài
    async processQueue() {
        this.isProcessing = true;

        while (this.queue.length > 0) {
            // Rút bài đầu tiên ra khỏi hàng đợi
            const currentJob = this.queue.shift();

            try {
                console.log(`⚙️ Đang tiến hành dịch ngầm bài: ${currentJob.articleId}...`);
                let isUpdated = false;
                let updateData = {}; // Cục chứa dữ liệu chuẩn bị lưu vào DB

                // 1. Xử lý dịch Content
                if (currentJob.content && Object.keys(currentJob.content).length > 0) {
                    const englishContent = await translateEditorContent(currentJob.content);
                    if (englishContent) {
                        updateData.contentEN = englishContent;
                        isUpdated = true;
                    }
                }

                // 2. Xử lý dịch Title và Note
                if (currentJob.title || currentJob.note) {
                    const translatedTitleNote = await translateTitleAndNote(currentJob.title, currentJob.note);
                    if (translatedTitleNote) {
                        if (translatedTitleNote.titleEN) updateData.titleEN = translatedTitleNote.titleEN;
                        if (translatedTitleNote.noteEN) updateData.noteEN = translatedTitleNote.noteEN;
                        isUpdated = true;
                    }
                }

                // 3. Nếu có bất kỳ trường nào được dịch xong -> Cập nhật Database 1 lần duy nhất
                if (isUpdated) {
                    await modelNews.findByIdAndUpdate(currentJob.articleId, updateData);
                    console.log(`✅ [Queue] Đã lưu bản dịch (Content/Title/Note) thành công: ${currentJob.articleId}`);
                }

            } catch (error) {
                console.error(`❌ [Queue] Lỗi dịch bài ${currentJob.articleId}:`, error.message);
            }

            // BẮT BUỘC: Cho hàng đợi nghỉ 2.5 giây trước khi dịch bài tiếp theo 
            // để AI không bị ngợp và không báo lỗi Rate Limit
            await new Promise(resolve => setTimeout(resolve, 2500));
        }

        // Khi hàng đợi trống, tắt máy bơm
        this.isProcessing = false;
        console.log("⏸️ Hàng đợi dịch thuật đã trống. Đang tạm nghỉ.");
    }
}

// Khởi tạo một đối tượng Queue dùng chung cho toàn bộ app
const translationQueue = new TranslationQueue();
module.exports = translationQueue;