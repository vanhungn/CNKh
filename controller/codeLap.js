// Không cần dotenv nữa


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

module.exports = { Lapcode };
