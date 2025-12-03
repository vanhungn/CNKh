const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalNews = new Schema({

    content: {}
}, { timestamps: true }, { collection: "news" })

module.exports = mongoose.model('news', modalNews)