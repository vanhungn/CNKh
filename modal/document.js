const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalDocument = new Schema({

    course: String,
    codeCourse: String,
    docx: [{
        name: String,
        url: String,
    }],
    avatar: String
}, { timestamps: true }, { collection: "documents" })

module.exports = mongoose.model('document', modalDocument)