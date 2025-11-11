const mongoose = require('mongoose')
const Schema = mongoose.Schema
const ModalProblem = new Schema({
    typeOf:String,
    title:String,
    statement:String,
    input: String,
    output: String,
    suggest:String
},{timestamps:true},{collection:'problems'})
module.exports = mongoose.model('problems',ModalProblem)