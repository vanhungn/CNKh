const modelMenu = require("../modal/menu")

const ListMenu = async (req, res) => {
    try {
        const data = await modelMenu.aggregate([
            { $sort: { location: 1 } },

            { $unwind: { path: "$childrenMenu", preserveNullAndEmptyArrays: true } },

            { $sort: { location: 1, "childrenMenu.locationChildrenMenu": 1 } },

            {
                $group: {
                    _id: "$_id",
                    titleMenu: { $first: "$titleMenu" },
                    typeof: { $first: "$typeof" },
                    location: { $first: "$location" },
                    childrenMenu: { $push: "$childrenMenu" }
                }
            },
        ])
        await res.status(200).json({
            data
        })
    } catch (error) {
        res.status(500).json({
            message: error
        })
    }
}
const createMenu = async (req, res) => {
    try {
        const { title, menu } = req.body
        if (!title || menu.length <= 0) {
            return res.status(400).json({
                message: "Not valid"
            })
        }
        const create = await modelMenu.create({
            title, menu
        })
        if (!create) {
            return res.status(400).json({
                message: "Create not successfully"
            })
        }
        return res.status(200).json({
            message: "Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error
        })
    }
}
const UpdateMenu = async (req, res) => {
    try {
        const { title, menu } = req.body
        const { id } = req.params
        if (!title || menu.length <= 0 || !id) {
            return res.status(400).json({
                message: "Not valid"
            })
        }
        const update = await modelMenu.findByIdAndUpdate(id, { title, menu }, { new: true })
        if (!update) {
            return res.status(400).json({

                message: "Create not successfully"
            })
        }
        return res.status(200).json({
            message: "Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error
        })
    }
}
const DeleteMenu = async (req, res) => {
    try {
        const { id } = req.params
        if (!id) {
            return res.status(400).json({
                message: "Not valid"
            })
        }
        const deleteMenu = await modelMenu.findByIdAndDelete(id)
        return res.status(200).json({
            message: "Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: error
        })
    }
}
module.exports = { ListMenu, createMenu, UpdateMenu, DeleteMenu }