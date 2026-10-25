// Không cần dotenv nữa
const modalProblem = require('../modal/problem')
// codeName trong LIST_LANGUAGE → language_id của Judge0 CE
// Đối chiếu tại https://ce.judge0.com/languages
const JUDGE0_LANG = {
    cpp: 54, c: 50, python: 71, java: 62, javascript: 63, typescript: 74,
    go: 60, rust: 73, csharp: 51, ruby: 72, php: 68, swift: 83, sql: 82,
};

const Lapcode = async (req, res) => {
    try {
        const { script, language, stdin = "" } = req.body;
        const language_id = JUDGE0_LANG[language];
        if (!language_id) {
            return res.status(400).json({ success: false, message: `Chưa hỗ trợ ngôn ngữ: ${language}` });
        }

        const response = await fetch(
            "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
            {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ source_code: script, language_id, stdin: stdin + "\n" }),
            }
        );
        const data = await response.json();

        return res.json({
            success: true,
            output: data.stdout || data.compile_output || data.stderr || data.message || "",
            stderr: data.stderr || "",
            compileOutput: data.compile_output || "",
            status: data.status?.description,
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
