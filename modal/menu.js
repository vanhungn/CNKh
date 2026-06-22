const { Int32 } = require("mongodb")
const mongoose = require("mongoose")
const schema = mongoose.Schema

const ModelMenu = new schema({
    title: String,
    menu: [
        {
            titleMenu: String,
            typeof: String,
            location:Int32,
            childrenMenu:[
                {
                    titleChildrenMenu:String,
                    typeofChildrenMenu:String,
                    locationChildrenMenu:Int32,
                }
            ]
        }
    ]
},{timestamps:true},{collection:"menus"})
module.exports = mongoose.model("menus",ModelMenu)
