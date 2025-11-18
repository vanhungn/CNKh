const modalTheory = require('../modal/thoery')
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const cloudinary = require("cloudinary").v2;
const modalDocument = require('../modal/document')
// Cấu hình Cloudinary
cloudinary.config({
    cloud_name: "djybyg1o3",
    api_key: "515998948284271",
    api_secret: "53vkRUxGp4_JXSjQVIFfED6u-tk",
    secure: true,
});

const CreateFile = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

        const uploadedFiles = await Promise.all(
            files.map(file => new Promise((resolve, reject) => {
                // Giữ tên file gốc và đuôi
                const originalName = file.originalname.split(".")[0];
                const extension = file.originalname.split(".").pop();

                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "raw", // raw cho Word/Excel/PPT
                        public_id: `${originalName}-${Date.now()}`, // tên file giữ gốc
                        format: extension // bắt buộc giữ đuôi
                    },
                    (err, result) => {
                        if (err) reject(err);
                        else resolve({ url: result.secure_url, name: file.originalname });
                    }
                );

                uploadStream.end(file.buffer);
            }))
        );
        await modalDocument.create({
            name: uploadedFiles[0].name,
            url: uploadedFiles[0].url
        })
        return res.status(200).json({
            message: "Upload successfully",

        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
const ExportDocument = async (req, res) => {
    try {
        const { _id } = req.params;
        const docx = await modalTheory.findById(_id);

        if (!docx) {
            return res.status(404).json({ message: "Document not found" });
        }

        const children = [];

        // Tiêu đề
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `DE THI CHUONG: ${docx.chapter}`,
                        bold: true,
                        size: 32
                    })
                ],
                spacing: { after: 400 }
            })
        );

        // Separator
        children.push(
            new Paragraph({
                children: [new TextRun({ text: "=".repeat(50) })],
                spacing: { after: 200 }
            })
        );

        // Duyệt câu hỏi
        docx.list.forEach((item, index) => {
            // Câu hỏi
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Cau ${index + 1}: ${item.question}`,
                            bold: true
                        })
                    ],
                    spacing: { before: 200, after: 100 }
                })
            );

            // Hình ảnh
            if (item.imgUrl) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `[Hinh anh: ${item.imgUrl}]`,
                                italics: true
                            })
                        ],
                        spacing: { after: 100 }
                    })
                );
            }

            // Đáp án
            item.options.forEach((option) => {
                const isCorrect = option.key === item.answer;
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${option.key}. ${option.text}`,
                                bold: isCorrect
                            })
                        ],
                        spacing: { after: 50 }
                    })
                );
            });

            // Đáp án đúng
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Dap an dung: ${item.answer}`,
                            bold: true
                        })
                    ],
                    spacing: { after: 100 }
                })
            );

            // Separator
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: "-".repeat(50) })],
                    spacing: { after: 200 }
                })
            );
        });

        // Tạo document
        const doc = new Document({
            sections: [{ children }]
        });

        // Tạo buffer
        const buffer = await Packer.toBuffer(doc);

        // ✅ QUAN TRỌNG: Set header ĐÚNG
        res.writeHead(200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-disposition': `attachment; filename=de-thi-${Date.now()}.docx`,
            'Content-Length': buffer.length
        });

        res.end(buffer);

    } catch (error) {
        console.error('Export error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};
function parseWordContent(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const questions = [];
    let currentQuestion = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Bỏ qua tiêu đề và separator
        if (line.startsWith('DE THI CHUONG') || line.startsWith('===') || line.startsWith('---')) {
            continue;
        }

        // Phát hiện câu hỏi mới: "Cau 1: ..."
        const questionMatch = line.match(/^Cau\s+(\d+):\s*(.+)$/i);
        if (questionMatch) {
            // Lưu câu hỏi trước đó (nếu có)
            if (currentQuestion && currentQuestion.options.length > 0) {
                questions.push(currentQuestion);
            }

            // Tạo câu hỏi mới
            currentQuestion = {
                question: questionMatch[2].trim(),
                imgUrl: '',
                options: [],
                answer: ''
            };
            continue;
        }

        // Phát hiện hình ảnh: "[Hinh anh: ...]"
        if (line.startsWith('[Hinh anh:')) {
            const imgMatch = line.match(/\[Hinh anh:\s*(.+?)\]/i);
            if (imgMatch && currentQuestion) {
                currentQuestion.imgUrl = imgMatch[1].trim();
            }
            continue;
        }

        // Phát hiện đáp án: "A. ...", "B. ...", etc
        const optionMatch = line.match(/^([A-D])\.\s*(.+)$/i);
        if (optionMatch && currentQuestion) {
            currentQuestion.options.push({
                key: optionMatch[1].toUpperCase(),
                text: optionMatch[2].trim()
            });
            continue;
        }

        // Phát hiện đáp án đúng: "Dap an dung: A"
        const answerMatch = line.match(/^Dap an dung:\s*([A-D])$/i);
        if (answerMatch && currentQuestion) {
            currentQuestion.answer = answerMatch[1].toUpperCase();
            continue;
        }
    }

    // Lưu câu hỏi cuối cùng
    if (currentQuestion && currentQuestion.options.length > 0) {
        questions.push(currentQuestion);
    }

    return questions;
}
const ImportDocument = async (req, res) => {
    try {
        console.log(req.file)
        if (!req.file) {
            return res.status(400).json({ message: "Khong co file nao duoc upload" });
        }

        const { _id } = req.params; // ID của document cần update

        // Đọc file Word từ buffer
        const result = await mammoth.extractRawText({
            buffer: req.file.buffer
        });

        const text = result.value;
        console.log('Noi dung file:', text);

        // Parse text thành cấu trúc câu hỏi
        const parsedQuestions = parseWordContent(text);

        if (parsedQuestions.length === 0) {
            return res.status(400).json({
                message: "Khong doc duoc cau hoi tu file. Kiem tra dinh dang!"
            });
        }

        // Cập nhật database
        const updatedDoc = await modalTheory.findByIdAndUpdate(
            _id,
            { list: parsedQuestions },
            { new: true }
        );

        if (!updatedDoc) {
            return res.status(404).json({ message: "Khong tim thay document" });
        }

        return res.status(200).json({
            message: "Import thanh cong",
            totalQuestions: parsedQuestions.length,
            data: updatedDoc
        });

    } catch (error) {
        console.error('Import error:', error);
        return res.status(500).json({ error: error.message });
    }
};
module.exports = { CreateFile, ExportDocument, ImportDocument };
