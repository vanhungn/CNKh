const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalTheory = new Schema({
    chapter: String,
    list: [
        {
            question: String,
            imgUrl: String,
            options: [
                {
                    text: String,
                    key: String,
                }
            ],
            answer: String
        }
    ],
    idCourse: { type: mongoose.Types.ObjectId, ref: 'documents' }
}, { timestamps: true }, { collection: 'theorys' })
module.exports = mongoose.model('thoerys', modalTheory)
