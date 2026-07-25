const { Int32 } = require("mongodb")
const mongoose = require("mongoose")
const schema = mongoose.Schema

const ModelMenu = new schema({
    menu: [
        {
            title: String,
            titleEN: String,
            local: Int32,
            kindOf:String,
            menu1: [
                {
                    titleMenu: String,
                    titleMenuEN: String,
                    typeof: String,
                    location: Int32,
                    menu2: [
                        {
                            titleChildrenMenu: String,
                            titleChildrenMenuEN: String,
                            typeofChildrenMenu: String,
                            locationChildrenMenu: Int32,
                        }
                    ]
                }
            ]

        }
    ],
    logo: String,
    banner: [
        {
            img: String,
            locationBanner: Int32

        }
    ]

}, { timestamps: true, collection: "menus" })
module.exports = mongoose.model("menus", ModelMenu)
