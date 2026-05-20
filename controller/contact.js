const modelContact = require('../modal/contact')
// const nodemailer = require('nodemailer');
require("dotenv").config();

// const transporter = nodemailer.createTransport({
//     host: 'smtp-relay.brevo.com',
//     port: 587,
//     auth: {
//         user: "9808c3002@smtp-brevo.com",   // email đăng ký Brevo
//         pass: process.env.EMAIL_API_KEY // SMTP key (khác API key)
//     }
// });

const CreateContact = async (req, res) => {
    try {
        const { name, phone, email, title, content } = req.body;

        if (!name || !phone || !email || !title || !content) {
            return res.status(400).json({ success: false, message: "Not valid" });
        }

        // await transporter.sendMail({
        //     from: '"Nguyễn Văn Hùng" <vanhungnvh1712004@gmail.com>',
        //     to: 'hungnguyenninhbinh2004@gmail.com',
        //     subject: 'Hỗ trợ sinh viên',
        //     html: `
        //         <h2>Thông tin sinh viên cần hỗ trợ</h2>
        //         <p><strong>Họ tên:</strong> ${name}</p>
        //         <p><strong>Số điện thoại:</strong> ${phone}</p>
        //         <p><strong>Email:</strong> ${email}</p>
        //         <p><strong>Tiêu đề:</strong> ${title}</p>
        //         <p><strong>Nội dung:</strong> ${content}</p>
        //     `
        // });

        const create = await modelContact.create({ name, phone, email, title, content });

        return res.status(200).json({ success: true, message: "Send email successfully", create });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
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