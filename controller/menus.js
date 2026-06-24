const modelMenu = require("../modal/menu")
const cloudinary = require('../config/cloudinaryConfig')
const ListMenu = async (req, res) => {
    try {
        const data = await modelMenu.aggregate([
            // Unwind menu để sort
            { $unwind: { path: "$menu", preserveNullAndEmptyArrays: true } },
            { $sort: { "menu.location": 1 } },

            // Unwind childrenMenu để sort
            { $unwind: { path: "$menu.childrenMenu", preserveNullAndEmptyArrays: true } },
            { $sort: { "menu.location": 1, "menu.childrenMenu.locationChildrenMenu": 1 } },

            // Group lại childrenMenu
            {
                $group: {
                    _id: { docId: "$_id", menuId: "$menu._id" },
                    title: { $first: "$title" },
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    titleMenu: { $first: "$menu.titleMenu" },
                    type: { $first: "$menu.type" },
                    location: { $first: "$menu.location" },
                    childrenMenu: { $push: "$menu.childrenMenu" }
                }
            },

            // Group lại menu
            {
                $group: {
                    _id: "$_id.docId",
                    title: { $first: "$title" },
                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    menu: {
                        $push: {
                            titleMenu: "$titleMenu",
                            type: "$type",
                            location: "$location",
                            childrenMenu: "$childrenMenu"
                        }
                    }
                }
            },

            // Sort banner theo locationBanner
            {
                $addFields: {
                    banner: {
                        $sortArray: { input: "$banner", sortBy: { locationBanner: 1 } }
                    },
                    menu: {
                        $sortArray: { input: "$menu", sortBy: { location: 1 } }
                    }
                }
            }
        ]);
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
        const { title, menu, locationBanner } = req.body;
        const logo = req.files['logo']?.[0];
        const banners = req.files['banner'];

        if (!title || !menu || !logo || !banners || banners.length <= 0 || !locationBanner) {
            return res.status(400).json({ message: "Not valid" });
        }

        // Parse menu và locationBanner vì gửi từ FormData
        const parsedMenu = JSON.parse(menu);
        const parsedLocations = JSON.parse(locationBanner);

        // Upload logo
        const resultLogo = await cloudinary.uploader.upload(logo.path, {
            folder: "editorjs",
        });

        // Upload banner
        const uploadPromises = banners.map((file, index) =>
            cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                .then(result => ({
                    img: result.secure_url,
                    locationBanner: Number(parsedLocations[index]) || index + 1
                }))
        );
        const arrBanner = await Promise.all(uploadPromises);

        const create = await modelMenu.create({
            title,
            menu: parsedMenu,
            logo: resultLogo.secure_url,
            banner: arrBanner
        });

        return res.status(200).json({ message: "Successfully", data: create });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const UpdateMenu = async (req, res) => {
    try {
        const { title, menu, locationBanner } = req.body;
        const { id } = req.params;
        const logo = req.files?.['logo']?.[0];
        const banners = req.files?.['banner'];

        if (!id) {
            return res.status(400).json({ message: "ID is required" });
        }

        const updateData = {};

        // Cập nhật title nếu có
        if (title) updateData.title = title;

        // Cập nhật menu nếu có
        if (menu) updateData.menu = JSON.parse(menu);

        // Cập nhật logo nếu có file mới
        if (logo) {
            const resultLogo = await cloudinary.uploader.upload(logo.path, {
                folder: "editorjs",
            });
            updateData.logo = resultLogo.secure_url;
        }

        // Cập nhật banner nếu có file mới
        if (banners && banners.length > 0) {
            const parsedLocations = locationBanner ? JSON.parse(locationBanner) : [];
            const uploadPromises = banners.map((file, index) =>
                cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                    .then(result => ({
                        img: result.secure_url,
                        locationBanner: Number(parsedLocations[index]) || index + 1
                    }))
            );
            updateData.banner = await Promise.all(uploadPromises);
        }

        const update = await modelMenu.findByIdAndUpdate(id, updateData, { new: true });

        if (!update) {
            return res.status(404).json({ message: "Menu not found" });
        }

        return res.status(200).json({ message: "Successfully", data: update });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
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