const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalContact = new Schema({
    name:String,
    phone:String,
    email:String,
    title:String,
    content:String
}, { timestamps: true }, { collection: "contacts" })

module.exports = mongoose.model('contacts', modalContact)