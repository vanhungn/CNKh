// Không cần dotenv nữa
const modalProblem = require('../modal/problem')

const Lapcode = async (req, res) => {
    try {
        const { script, language = "cpp", stdin = "" } = req.body;

        // ✅ Gửi request tới Piston API
        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language, // ví dụ: "cpp", "python", "javascript"
                version: "*", // lấy version mới nhất
                files: [
                    {
                        name: "main",
                        content: script, // code người dùng nhập
                    },
                ],
                stdin, // dữ liệu đầu vào
            }),
        });

        const data = await response.json();
        console.log(data)
        return res.status(200).json({
            success: true,
            result: data, // kết quả thực thi: output, stderr, exit_code, ...
        });
    } catch (error) {
        console.error("Piston API error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi chạy code",
            error: error.message,
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
const GetProblem = async(req,res) => {
    try {
        const search = req.query.search||""
        const data = await modalProblem.aggregate([
            {$match:{
                $or:[
                    {title:{$regex:search}}
                ]
            }}
        ])
        return res.status(200).json({
            data
        })
    } catch (error) {
        return res.status(500).json({
            message: error
        })
    }
}
module.exports = { Lapcode, CreatePractice,GetProblem };
