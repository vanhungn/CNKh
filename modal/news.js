const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalNews = new Schema({
    typeOf: String,
    title: String,
    titleEN: String,
    note: String,
    noteEN: String,
    img: { etag: String, url: String },
    content: {},
    contentEN: {},
}, { timestamps: true }, { collection: "news" })

module.exports = mongoose.model('news', modalNews)