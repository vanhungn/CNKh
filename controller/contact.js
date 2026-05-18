const modelContact = require('../modal/contact')
const SibApiV3Sdk = require('sib-api-v3-sdk');
require("dotenv").config();

const CreateContact = async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            title,
            content
        } = req.body;

        if (
            !name ||
            !phone ||
            !email ||
            !title ||
            !content
        ) {
            return res.status(400).json({
                success: false,
                message: "Not valid"
            });
        }

        // 1. CONFIGURE API KEY GLOBALLY
        const defaultClient = SibApiV3Sdk.ApiClient.instance;
        const apiKey = defaultClient.authentications['api-key'];
        apiKey.apiKey = process.env.EMAIL_API_KEY;
        console.log("My API Key is:", process.env.EMAIL_API_KEY);
        // 2. CREATE API INSTANCE (It will automatically use the global API key)
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

        // 3. CONFIGURE EMAIL
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.subject = "Hỗ trợ sinh viên";

        sendSmtpEmail.htmlContent = `
            <h2>Thông tin sinh viên cần hỗ trợ</h2>
            <p><strong>Họ tên:</strong> ${name}</p>
            <p><strong>Số điện thoại:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Tiêu đề:</strong> ${title}</p>
            <p><strong>Nội dung:</strong> ${content}</p>
        `;

        // SENDER
        sendSmtpEmail.sender = {
            name: "Nguyễn Văn Hùng",
            email: "vanhungnvh1712004@gmail.com",
        };

        // RECEIVER
        sendSmtpEmail.to = [
            {
                email: "hungnguyenninhbinh2004@gmail.com",
                name: "Người hỗ trợ",
            },
        ];

        // 4. SEND EMAIL
        await apiInstance.sendTransacEmail(sendSmtpEmail);

        // 5. SAVE TO DATABASE (Assuming modelContact is defined elsewhere)
        const create = await modelContact.create({
            name,
            phone,
            email,
            title,
            content
        });

        return res.status(200).json({
            success: true,
            message: "Send email successfully",
            create
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            // Fallback to error.message for better debugging if available
            message: error.message || "Internal Server Error"
        });
    }
};
const GetContact = async (req, res) => {
    try {
        const sort = parseInt(req.query.sort) || -1
        const search = (req.query.search || "").trim()
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const query = {
            $match: {
                $or: [
                    { title: { $regex: search, $options: "i" } },
                    { name: { $regex: search, $options: "i" } }
                ]
            }
        }
        const data = await modelContact.aggregate([query, {
            $sort: { createdAt: sort }
        },
            { $skip: (skip - 1) * limit },
            { $limit: limit }
        ])
        const dataLength = await modelContact.aggregate([query])
        const total = Math.ceil(dataLength.length / limit)
        return res.status(200).json({
            data, total
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const DeleteContact = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "not valid"
            })
        }
        await modelContact.findByIdAndDelete(_id)
        return res.status(200).json({
            message: "successFully"
        })
    } catch (error) {
        return res.status(500).json(error)
    }
}
module.exports = { CreateContact, GetContact, DeleteContact }