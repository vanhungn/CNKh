// Không cần dotenv nữa
const modalProblem = require('../modal/problem')
const Lapcode = async (req, res) => {
    try {
        const { script, language_id = 54, stdin = "" } = req.body;

        const response = await fetch(
            "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    source_code: script,
                    language_id,
                    stdin: stdin + "\n"
                }),
            }
        );

        const data = await response.json();

        return res.json({
            success: true,
            output: data.stdout || "",
            stderr: data.stderr || "",
            status: data.status?.description
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
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
