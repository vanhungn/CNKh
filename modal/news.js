const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalNews = new Schema({
    typeOf: String,
    title: String,
    note: String,
    img: { etag: String, url: String },
    content: {}
}, { timestamps: true }, { collection: "news" })

module.exports = mongoose.model('news', modalNews)