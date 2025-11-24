const modalTheory = require('../modal/thoery')
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const modalDocument = require('../modal/document')
const cloudinary = require('../config/cloudinaryConfig')


const CreateFile = async (req, res) => {
    try {

        const files = req.files;
        const { course, codeCourse } = req.body
        const check = await modalDocument.findOne({ codeCourse })
        if (check) {
            return res.status(403).json({
                message: "course valid"
            })
        }
        if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

        const uploadedFiles = await Promise.all(
            files.map(file => new Promise((resolve, reject) => {
                // Giữ tên file gốc và đuôi
                const originalName = file.originalname;
                const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
                const extension = originalName.substring(originalName.lastIndexOf('.') + 1);

                // QUAN TRỌNG: Loại bỏ dấu tiếng Việt và ký tự đặc biệt
                const sanitizedName = nameWithoutExt
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
                    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Đổi đ thành d
                    .replace(/[^a-zA-Z0-9-_]/g, '_') // Thay ký tự đặc biệt bằng _
                    .toLowerCase();

                const publicId = `${sanitizedName}-${Date.now()}`;

                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "raw",
                        public_id: publicId,
                        format: extension
                    },
                    (err, result) => {
                        console.log(file)
                        if (err) reject(err);
                        else resolve({ url: result.secure_url, name: result.public_id });
                    }
                );

                uploadStream.end(file.buffer);
            }))
        );
        await modalDocument.create({
            course, codeCourse,
            docx: uploadedFiles

        })
        return res.status(200).json({
            message: "Upload successfully",

        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
const GetNameDocument = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = req.query.search || ""
        const query = {
            $match: {
                $or: [
                    { course: { $regex: search, $options: "i" } }
                ]
            }
        }
        const title = await modalDocument.aggregate([
            query,
            { $skip: ((skip - 1) * limit) },
            { $limit: limit }
        ])
        const totalPage = await modalDocument.aggregate([query])
        const total = Math.ceil(totalPage.length / limit)
        return res.status(200).json({
            data: title, total
        })
    } catch (error) {
        return res.status(500).json({
            error
        })
    }
}
const GetDocumentCourse = async (req, res) => {
    try {
        const { _idCourse, _idDocx } = req.params;

        if (!_idCourse || !_idDocx) {
            return res.status(400).json({ message: "Missing parameters" });
        }

        const course = await modalDocument.findById(_idCourse);

        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const data = course.docx.find(doc => doc._id.toString() === _idDocx);

        return res.status(200).json({ data });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}



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
const GetListDocument = async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = req.query.search || "";

        const query = {
            $match: {
                $or: [
                    { course: { $regex: search, $options: 'i' } },
                ]
            }
        }
        const data = await modalDocument.aggregate([
            query, {
                $skip: (skip - 1) * limit
            }, {
                $limit: limit
            }
        ])
        const lengthData = await modalDocument.aggregate([query])
        const total = Math.ceil(lengthData.length / limit)
        return res.status(200).json({
            data, total
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const GetDocumentDetail = async (req, res) => {
    try {

        const { _id } = req.params
        const search = req.query.search || "";
        if (!_id) {
            return res.status(400).json({
                message: "valid"
            })
        }
        const detail = await modalDocument.findById(_id)
        const data = detail.docx.filter(item =>
            item.name.toLowerCase().includes(search.toLowerCase())
        );
        return res.status(200).json({
            data
        })
    } catch (error) {
        return res.status(500).json({ error })
    }
}
const CreateDocx = async (req, res) => {
    try {
        const { _id } = req.params
        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

        const uploadedFiles = await Promise.all(
            files.map(file => new Promise((resolve, reject) => {
                // Giữ tên file gốc và đuôi
                const originalName = file.originalname;
                const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
                const extension = originalName.substring(originalName.lastIndexOf('.') + 1);

                // QUAN TRỌNG: Loại bỏ dấu tiếng Việt và ký tự đặc biệt
                const sanitizedName = nameWithoutExt
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
                    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Đổi đ thành d
                    .replace(/[^a-zA-Z0-9-_]/g, '_') // Thay ký tự đặc biệt bằng _
                    .toLowerCase();

                const publicId = `${sanitizedName}-${Date.now()}`;

                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "raw",
                        public_id: publicId,
                        format: extension
                    },
                    (err, result) => {
                        if (err) reject(err);
                        else resolve({ url: result.secure_url, name: result.public_id });
                    }
                );

                uploadStream.end(file.buffer);
            }))
        );
        const data = await modalDocument.findById(_id)

        data.docx.push(...uploadedFiles)
        await data.save()
        return res.status(200).json({
            message: "Upload successfully",

        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
const DeleteDocx = async (req, res) => {
    try {
        const { idDocument, idDocx } = req.query
        if (!idDocument || !idDocx) {
            return res.status(400).json({
                message: "valid"
            })
        }
        const document = await modalDocument.findById({ _id: idDocument })
        document.docx = document.docx.filter(item => item._id.toString() !== idDocx)
        await document.save()
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({ error: error.message });

    }
}
const DeleteDocument = async (req, res) => {
    try {
        const { _id } = req.params
        if (!_id) {
            return res.status(400).json({
                message: "valid"
            })
        }
        await modalDocument.findByIdAndDelete({ _id })
        return res.status(200).json({
            message: "successfully"
        })
    } catch (error) {
        return res.status(500).json({ error: error.message });

    }
}
module.exports = {
    CreateDocx,
    GetDocumentDetail,
    GetListDocument,
    GetDocumentCourse,
    GetNameDocument,
    CreateFile,
    ExportDocument,
    ImportDocument,
    DeleteDocx,
    DeleteDocument
};
