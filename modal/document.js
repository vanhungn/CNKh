const mongoose = require('mongoose')
const Schema = mongoose.Schema

const modalDocument = new Schema({
    name:String,
    url:String,
    course:String,
    codeCourse:String
},{timestamps:true},{collection:"documents"})

module.exports = mongoose.model('document',modalDocument)