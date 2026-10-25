// Không cần dotenv nữa
const modalProblem = require('../modal/problem')
// codeName trong LIST_LANGUAGE → language_id của Judge0 CE
// Đối chiếu tại https://ce.judge0.com/languages
const JUDGE0_LANG = {
    cpp: 54, c: 50, python: 71, java: 62, javascript: 63, typescript: 74,
    go: 60, rust: 73, csharp: 51, ruby: 72, php: 68, swift: 83, sql: 82,
};

const toB64 = (s) => Buffer.from(s ?? "", "utf-8").toString("base64");
// Judge0 trả base64 có xuống dòng; byte lỗi sẽ thành ký tự thay thế thay vì làm hỏng JSON
const fromB64 = (s) => (s ? Buffer.from(s, "base64").toString("utf-8") : "");

const Lapcode = async (req, res) => {
    try {
        const { script, language, stdin = "" } = req.body;

        if (!script || !script.trim()) {
            return res.status(400).json({ success: false, message: "Thiếu code" });
        }

        const language_id = JUDGE0_LANG[language];
        if (!language_id) {
            return res.status(400).json({ success: false, message: `Chưa hỗ trợ ngôn ngữ: ${language}` });
        }

        const response = await fetch(
            "https://ce.judge0.com/submissions?base64_encoded=true&wait=true",
            {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    source_code: toB64(script),
                    language_id,
                    stdin: toB64(stdin + "\n"),
                }),
            }
        );

        const raw = await response.text();
        console.log("JUDGE0:", response.status, raw.slice(0, 500));   // xoá sau khi chạy ổn

        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            return res.status(502).json({
                success: false,
                message: `Judge0 trả dữ liệu lạ (HTTP ${response.status}): ${raw.slice(0, 300)}`,
            });
        }

        if (!response.ok || !data.status) {
            return res.json({
                success: true,
                ok: false,
                output: "",
                error: `Judge0 lỗi (HTTP ${response.status}): ${data.error || data.message || raw.slice(0, 300)}`,
                status: "Judge0 Error",
                time: null,
                memory: null,
            });
        }

        const stdout = fromB64(data.stdout);
        const stderr = fromB64(data.stderr);
        const compileOutput = fromB64(data.compile_output);
        const message = fromB64(data.message);

        const ok = data.status.id === 3; // 3 = Accepted
        const errorText = compileOutput || stderr || message || data.status.description || "";

        return res.json({
            success: true,
            ok,
            output: stdout,
            error: ok ? "" : errorText,
            status: data.status.description,
            time: data.time,
            memory: data.memory,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const CreatePractice = async (req, res) => {
    try {
        const { typeOf, title, statement, input, output, suggest } = req.body
        if (!title || !typeOf || !statement || !input || !output || !suggest) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const data = await modalProblem.create({
            title, typeOf, statement, input, output, suggest
        })
        return res.status(200).json({
            data
        })
    } catch (error) {
        return res.status(500).json({
            message: error
        })
    }
}
const GetProblem = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10
        const skip = parseInt(req.query.skip) || 1
        const search = (req.query.search || "").trim()
        const typeOf = req.query.typeOf
        const query = {
            $match: {
                ...(typeOf && { typeOf }),
                $or: [
                    { title: { $regex: search, $options: "i" } }
                ]
            }
        }
        const data = await modalProblem.aggregate([
            query, { $sort: { createAt: -1 } },
            { $skip: (skip - 1) * limit },
            { $limit: limit }
        ])
        const dataLength = await modalProblem.aggregate([query])

        const total = Math.ceil(dataLength.length / limit)
        return res.status(200).json({
            data, total
        })
    } catch (error) {
        return res.status(500).json({
            message: error
        })
    }
}
const GetProblemDetail = async (req, res) => {
    try {
        const _id = req.params
        if (!_id) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        const data = await modalProblem.findById(_id)
        return res.status(200).json({ data })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
module.exports = { Lapcode, CreatePractice, GetProblem, GetProblemDetail };
