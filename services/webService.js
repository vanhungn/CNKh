const axios = require('axios');
const { classifyUserIntent } = require('./aiService');

const API_BASE = 'https://cnkh.onrender.com';
const CACHE_DURATION = 5 * 60 * 1000;
const MAX_RESULTS = 3;
const MAX_CONTENT_CHARS = 1500;

let typesCache = { data: null, lastFetched: 0 };
// ✅ Cache THEO TỪNG CATEGORY (trước đây dùng 1 cache chung cho mọi intent)
const newsCacheByType = new Map(); // type -> { data, lastFetched }

// ---------- Helpers ----------
function parseEditorBlocks(blocks) {
    if (!Array.isArray(blocks)) return "";
    return blocks.map(b => {
        if (b.data?.text) return b.data.text.replace(/<[^>]*>?/gm, '');
        if (Array.isArray(b.data?.items)) {
            return b.data.items
                .map(i => (typeof i === 'string' ? i : i?.content || ''))
                .join('\n')
                .replace(/<[^>]*>?/gm, '');
        }
        return "";
    }).join("\n");
}

// Bỏ dấu tiếng Việt + lowercase để so khớp từ khóa
function normalize(str = '') {
    return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const STOPWORDS = new Set([
    'la', 'cua', 'va', 'nhung', 'cho', 've', 'voi', 'trong', 'co', 'khong',
    'gi', 'nao', 'toi', 'muon', 'biet', 'tin', 'tuc', 'bai', 'viet', 'xin',
    'hay', 'cac', 'mot', 'o', 'tai', 'the', 'nay', 'do', 'a', 'an', 'the',
    'of', 'in', 'on', 'for', 'and', 'to', 'is', 'about', 'what', 'news'
]);

function tokenize(query) {
    return normalize(query)
        .split(' ')
        .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

function articleDate(a) {
    return new Date(a.createdAt || a.date || a.publishedAt || 0).getTime() || 0;
}

// ---------- Fetch ----------
async function getCategories() {
    if (!typesCache.data || Date.now() - typesCache.lastFetched > CACHE_DURATION) {
        const res = await axios.get(`${API_BASE}/news/typeof`, { timeout: 8000 });
        const fetched = [...res.data.data];
        if (!fetched.includes('generalNews')) fetched.push('generalNews');
        typesCache = { data: fetched, lastFetched: Date.now() };
    }
    return typesCache.data;
}

async function getArticlesByType(type) {
    const cached = newsCacheByType.get(type);
    if (cached && Date.now() - cached.lastFetched < CACHE_DURATION) {
        return cached.data;
    }
    const res = await axios.get(`${API_BASE}/news`, {
        params: { typeOf: type },
        timeout: 8000
    });
    const data = Array.isArray(res.data.data) ? res.data.data : [];
    newsCacheByType.set(type, { data, lastFetched: Date.now() });
    return data;
}

// ✅ Lấy bài của TẤT CẢ category để tìm theo từ khóa (không phụ thuộc intent)
async function getAllArticles(categories) {
    const realTypes = categories.filter(c => c !== 'generalNews');
    const results = await Promise.all(
        realTypes.map(t => getArticlesByType(t).catch(() => []))
    );
    const seen = new Set();
    const all = [];
    for (const a of results.flat()) {
        const id = a._id || a.id || a.title;
        if (seen.has(id)) continue;
        seen.add(id);
        all.push(a);
    }
    return all;
}

// ---------- Ranking ----------
function rankByKeyword(articles, query) {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const phrase = tokens.join(' ');

    const scored = articles.map(a => {
        const title = normalize(`${a.title || ''} ${a.titleEN || ''}`);
        const body = normalize(
            `${parseEditorBlocks(a.content?.blocks)} ${parseEditorBlocks(a.contentEN?.blocks)}`
        );

        let score = 0;
        let matched = 0;
        for (const tk of tokens) {
            const inTitle = title.includes(tk);
            const inBody = body.includes(tk);
            if (inTitle) score += 3;
            if (inBody) score += 1;
            if (inTitle || inBody) matched++;
        }
        if (tokens.length > 1) {
            if (title.includes(phrase)) score += 10;
            if (body.includes(phrase)) score += 5;
        }
        return { article: a, score, ratio: matched / tokens.length };
    });

    return scored
        .filter(s => s.score > 0 && s.ratio >= 0.5)
        .sort((x, y) => y.score - x.score || articleDate(y.article) - articleDate(x.article))
        .map(s => s.article);
}

function formatArticle(a) {
    const viContent = parseEditorBlocks(a.content?.blocks).slice(0, MAX_CONTENT_CHARS);
    const enContent = parseEditorBlocks(a.contentEN?.blocks).slice(0, MAX_CONTENT_CHARS);

    let result = `Tiêu đề: ${a.title}`;
    if (a.typeOf) result += `\nChuyên mục: ${a.typeOf}`;
    if (a.createdAt || a.date) result += `\nNgày đăng: ${a.createdAt || a.date}`;
    result += `\nNội dung (VI): ${viContent || '(bài viết chưa có nội dung chi tiết)'}`;
    if (enContent) result += `\nNội dung (EN): ${enContent}`;
    return result;
}

// ---------- Main ----------
async function getDynamicNewsFromAPI(query) {
    try {
        const categories = await getCategories();

        // 1) Tìm theo từ khóa trên toàn bộ bài viết (ưu tiên số 1)
        const all = await getAllArticles(categories);
        let picked = rankByKeyword(all, query).slice(0, MAX_RESULTS);

        // 2) Không khớp từ khóa -> dùng intent để lấy bài mới nhất theo chuyên mục
        if (picked.length === 0) {
            const intent = await classifyUserIntent(query, categories);
            console.log('[News] không khớp từ khóa, dùng intent:', intent);

            const pool = intent === 'generalNews'
                ? all
                : all.filter(a => a.typeOf === intent);

            picked = [...pool]
                .sort((x, y) => articleDate(y) - articleDate(x))
                .slice(0, MAX_RESULTS);
        }

        console.log('[News] query:', query, '->', picked.map(a => a.title));

        if (picked.length === 0) {
            return "[TIN TỨC]: Hiện tại chưa có bài viết nào thuộc chủ đề này.";
        }

        return `[TIN TỨC]:\n` + picked.map(formatArticle).join("\n---\n");

    } catch (error) {
        console.error("Lỗi fetch tin tức:", error);
        return "";
    }
}

module.exports = { getDynamicNewsFromAPI };