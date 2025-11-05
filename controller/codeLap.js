require('dotenv').config()
const Lapcode = async (req, res) => {
    try {
        const { script, language = "cpp17", versionIndex = "0" } = req.body;

        const response = await fetch("https://api.jdoodle.com/v1/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                script,
                language,
                versionIndex
            }),
        });

        // ✅ Parse JSON từ JDoodle
        const data = await response.json();

        return res.status(200).json({
            result: data   // JDoodle trả về { output, memory, cpuTime, ... }
        });
    } catch (error) {
        console.error("JDoodle API error:", error);
        return res.status(500).json({
            error: error.message || "Internal Server Error",
        });
    }
};

module.exports = { Lapcode };
