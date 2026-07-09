const { translateMenuContentDiff } = require('./translationService');
const modelMenu = require('../modal/menu');

class MenuTranslationQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    addJob(menuDocId, oldMenu, newMenu) {
        this.queue.push({ menuDocId, oldMenu, newMenu });
        console.log(`📥 Đã đưa menu [${menuDocId}] vào hàng đợi dịch. Đang chờ: ${this.queue.length} job.`);

        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    async processQueue() {
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const currentJob = this.queue.shift();

            try {
                console.log(`⚙️ Đang tiến hành dịch ngầm menu: ${currentJob.menuDocId}...`);

                const translatedMenu = await translateMenuContentDiff(currentJob.oldMenu, currentJob.newMenu);

                if (translatedMenu) {
                    await modelMenu.findByIdAndUpdate(currentJob.menuDocId, { menu: translatedMenu });
                    console.log(`✅ [Queue] Đã lưu bản dịch menu thành công: ${currentJob.menuDocId}`);
                }

            } catch (error) {
                console.error(`❌ [Queue] Lỗi dịch menu ${currentJob.menuDocId}:`, error.message);
            }

            await new Promise(resolve => setTimeout(resolve, 2500));
        }

        this.isProcessing = false;
        console.log("⏸️ Hàng đợi dịch menu đã trống. Đang tạm nghỉ.");
    }
}

const menuTranslationQueue = new MenuTranslationQueue();
module.exports = menuTranslationQueue;