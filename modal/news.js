const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalNews = new Schema({
    name: String,
    phone: String,
    email: String,
    title: String,
    content: String
}, { timestamps: true }, { collection: "news" })

module.exports = mongoose.model('news', modalNews)