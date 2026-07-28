const modelMenu = require("../modal/menu")
const cloudinary = require('../config/cloudinaryConfig')
const menuTranslationQueue = require('../helps/menuTranslationQueue');
const ListMenu = async (req, res) => {
    try {
        const data = await modelMenu.aggregate([
            // Unwind menu
            {
                $unwind: {
                    path: "$menu",
                    preserveNullAndEmptyArrays: true
                }
            },

            // Unwind menu1
            {
                $unwind: {
                    path: "$menu.menu1",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: {
                    "menu.local": 1,
                    "menu.menu1.location": 1
                }
            },

            // Unwind menu2
            {
                $unwind: {
                    path: "$menu.menu1.menu2",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: {
                    "menu.local": 1,
                    "menu.menu1.location": 1,
                    "menu.menu1.menu2.locationChildrenMenu": 1
                }
            },

            // =========================
            // Group menu2
            // =========================
            {
                $group: {
                    _id: {
                        docId: "$_id",
                        menuId: "$menu._id",
                        menu1Id: "$menu.menu1._id"
                    },

                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    bannerTopPic: { $first: "$bannerTopPic" }, // giờ là field cấp document

                    menuTitle: { $first: "$menu.title" },
                    menuTitleEN: { $first: "$menu.titleEN" },
                    menuLocal: { $first: "$menu.local" },
                    menuKindOf: { $first: "$menu.kindOf" },

                    titleMenu: { $first: "$menu.menu1.titleMenu" },
                    titleMenuEN: { $first: "$menu.menu1.titleMenuEN" },
                    typeof: { $first: "$menu.menu1.typeof" },
                    location: { $first: "$menu.menu1.location" },

                    menu2: {
                        $push: {
                            $cond: [
                                { $ifNull: ["$menu.menu1.menu2._id", false] },
                                {
                                    _id: "$menu.menu1.menu2._id",
                                    titleChildrenMenu: "$menu.menu1.menu2.titleChildrenMenu",
                                    titleChildrenMenuEN: "$menu.menu1.menu2.titleChildrenMenuEN",
                                    typeofChildrenMenu: "$menu.menu1.menu2.typeofChildrenMenu",
                                    locationChildrenMenu: "$menu.menu1.menu2.locationChildrenMenu"
                                },
                                "$$REMOVE"
                            ]
                        }
                    }
                }
            },

            // =========================
            // Group menu1
            // =========================
            {
                $group: {
                    _id: {
                        docId: "$_id.docId",
                        menuId: "$_id.menuId"
                    },

                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    bannerTopPic: { $first: "$bannerTopPic" },

                    menuTitle: { $first: "$menuTitle" },
                    menuTitleEN: { $first: "$menuTitleEN" },
                    menuLocal: { $first: "$menuLocal" },
                    menuKindOf: { $first: "$menuKindOf" },

                    menu1: {
                        $push: {
                            $cond: [
                                { $ifNull: ["$_id.menu1Id", false] },
                                {
                                    _id: "$_id.menu1Id",
                                    titleMenu: "$titleMenu",
                                    titleMenuEN: "$titleMenuEN",
                                    typeof: "$typeof",
                                    location: "$location",
                                    menu2: "$menu2"
                                },
                                "$$REMOVE"
                            ]
                        }
                    }
                }
            },

            // =========================
            // Group menu (về lại cấp document)
            // =========================
            {
                $group: {
                    _id: "$_id.docId",

                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },
                    bannerTopPic: { $first: "$bannerTopPic" },

                    menu: {
                        $push: {
                            $cond: [
                                { $ifNull: ["$_id.menuId", false] },
                                {
                                    _id: "$_id.menuId",
                                    title: "$menuTitle",
                                    titleEN: "$menuTitleEN",
                                    local: "$menuLocal",
                                    kindOf: "$menuKindOf",
                                    menu1: "$menu1"
                                },
                                "$$REMOVE"
                            ]
                        }
                    }
                }
            },

            // =========================
            // Sort
            // =========================
            {
                $addFields: {
                    banner: {
                        $sortArray: {
                            input: "$banner",
                            sortBy: {
                                locationBanner: 1
                            }
                        }
                    },

                    // bannerTopPic: nhóm theo typeofTopPic, sort banner con trong mỗi nhóm
                    bannerTopPic: {
                        $map: {
                            input: { $ifNull: ["$bannerTopPic", []] },
                            as: "g",
                            in: {
                                typeofTopPic: "$$g.typeofTopPic",
                                banner: {
                                    $sortArray: {
                                        input: { $ifNull: ["$$g.banner", []] },
                                        sortBy: {
                                            locationBanner: 1
                                        }
                                    }
                                }
                            }
                        }
                    },

                    menu: {
                        $sortArray: {
                            input: {
                                $map: {
                                    input: "$menu",
                                    as: "m",
                                    in: {
                                        _id: "$$m._id",
                                        title: "$$m.title",
                                        titleEN: "$$m.titleEN",
                                        local: "$$m.local",
                                        kindOf: "$$m.kindOf",

                                        menu1: {
                                            $sortArray: {
                                                input: "$$m.menu1",
                                                sortBy: {
                                                    location: 1
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            sortBy: {
                                local: 1
                            }
                        }
                    }
                }
            }
        ]);

        return res.status(200).json({
            data
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};
const createMenu = async (req, res) => {
    try {
        const { menu, locationBanner, bannerTopPicMeta } = req.body;
        const logo = req.files?.['logo']?.[0];
        const banners = req.files?.['banner'];
        const newBannerTopPicFiles = req.files?.['bannerTopPic'] || [];

        if (!menu || !logo || !banners || banners.length <= 0 || !locationBanner) {
            return res.status(400).json({ message: "Not valid" });
        }

        const parsedMenu = JSON.parse(menu);
        const parsedLocations = JSON.parse(locationBanner);

        // ===== Logo =====
        const resultLogo = await cloudinary.uploader.upload(logo.path, {
            folder: "editorjs",
        });

        // ===== Banner cấp document =====
        const uploadPromises = banners.map((file, index) =>
            cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                .then(result => ({
                    img: result.secure_url,
                    locationBanner: Number(parsedLocations[index]) || index + 1
                }))
        );
        const arrBanner = await Promise.all(uploadPromises);

        // ===== BannerTopPic cấp document (nhóm theo typeofTopPic) =====
        let finalBannerTopPic = [];
        if (bannerTopPicMeta) {
            const parsedTopPicMeta = JSON.parse(bannerTopPicMeta);

            const uploadedTopPicUrls = await Promise.all(
                newBannerTopPicFiles.map(file =>
                    cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                        .then(result => result.secure_url)
                )
            );

            let cursor = 0;
            finalBannerTopPic = parsedTopPicMeta.map(group => ({
                typeofTopPic: group.typeofTopPic,
                banner: (group.banner || []).map(b => {
                    if (b.type === "new") {
                        const img = uploadedTopPicUrls[cursor];
                        cursor++;
                        return { img, locationBanner: b.locationBanner };
                    }
                    return { img: b.img, locationBanner: b.locationBanner };
                })
            }));
        }

        // ===== Menu (không còn bannerTopPic) =====
        const finalMenu = parsedMenu.map(m1 => ({
            title: m1.title,
            titleEN: m1.titleEN,
            local: m1.local,
            kindOf: m1.kindOf,
            menu1: (m1.menu1 || []).map(m2 => ({
                titleMenu: m2.titleMenu,
                titleMenuEN: m2.titleMenuEN,
                typeof: m2.typeof,
                location: m2.location,
                menu2: (m2.menu2 || []).map(m3 => ({
                    titleChildrenMenu: m3.titleChildrenMenu,
                    titleChildrenMenuEN: m3.titleChildrenMenuEN,
                    typeofChildrenMenu: m3.typeofChildrenMenu,
                    locationChildrenMenu: m3.locationChildrenMenu
                }))
            }))
        }));

        const create = await modelMenu.create({
            menu: finalMenu,
            logo: resultLogo.secure_url,
            banner: arrBanner,
            bannerTopPic: finalBannerTopPic
        });

        return res.status(201).json({ message: "Successfully", data: create });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const UpdateMenu = async (req, res) => {
    try {
        const { menu, bannerMeta, bannerTopPicMeta } = req.body;
        const { id } = req.params;
        const logo = req.files?.['logo']?.[0];
        const newBannerFiles = req.files?.['banner'] || [];
        const newBannerTopPicFiles = req.files?.['bannerTopPic'] || [];

        if (!id) {
            return res.status(400).json({ message: "ID is required" });
        }

        const updateData = {};
        let oldMenu = null;

        // ===== Logo =====
        if (logo) {
            const resultLogo = await cloudinary.uploader.upload(logo.path, {
                folder: "editorjs",
            });
            updateData.logo = resultLogo.secure_url;
        }

        // ===== Banner cấp document =====
        if (bannerMeta) {
            const parsedMeta = JSON.parse(bannerMeta);

            const uploadedUrls = await Promise.all(
                newBannerFiles.map(file =>
                    cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                        .then(result => result.secure_url)
                )
            );

            let newFileIndex = 0;
            updateData.banner = parsedMeta.map(item => {
                if (item.type === "new") {
                    const img = uploadedUrls[newFileIndex];
                    newFileIndex++;
                    return { img, locationBanner: item.locationBanner };
                }
                return { img: item.img, locationBanner: item.locationBanner };
            });
        }

        // ===== BannerTopPic cấp document (nhóm theo typeofTopPic) =====
        if (bannerTopPicMeta) {
            const parsedTopPicMeta = JSON.parse(bannerTopPicMeta);

            const uploadedTopPicUrls = await Promise.all(
                newBannerTopPicFiles.map(file =>
                    cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                        .then(result => result.secure_url)
                )
            );

            let cursor = 0;
            updateData.bannerTopPic = parsedTopPicMeta.map(group => ({
                typeofTopPic: group.typeofTopPic,
                banner: (group.banner || []).map(b => {
                    if (b.type === "new") {
                        const img = uploadedTopPicUrls[cursor];
                        cursor++;
                        return { img, locationBanner: b.locationBanner };
                    }
                    return { img: b.img, locationBanner: b.locationBanner };
                })
            }));
        }

        // ===== Menu (không còn bannerTopPic) =====
        if (menu) {
            const oldDoc = await modelMenu.findById(id).select('menu').lean();
            oldMenu = oldDoc?.menu || [];

            const parsedMenu = JSON.parse(menu);

            updateData.menu = parsedMenu.map(m1 => ({
                ...(m1._id ? { _id: m1._id } : {}),
                title: m1.title,
                titleEN: m1.titleEN,
                local: m1.local,
                kindOf: m1.kindOf,
                menu1: (m1.menu1 || []).map(m2 => ({
                    ...(m2._id ? { _id: m2._id } : {}),
                    titleMenu: m2.titleMenu,
                    titleMenuEN: m2.titleMenuEN,
                    typeof: m2.typeof,
                    location: m2.location,
                    menu2: (m2.menu2 || []).map(m3 => ({
                        ...(m3._id ? { _id: m3._id } : {}),
                        titleChildrenMenu: m3.titleChildrenMenu,
                        titleChildrenMenuEN: m3.titleChildrenMenuEN,
                        typeofChildrenMenu: m3.typeofChildrenMenu,
                        locationChildrenMenu: m3.locationChildrenMenu
                    }))
                }))
            }));
        }

        const update = await modelMenu.findByIdAndUpdate(id, updateData, { new: true });

        if (!update) {
            return res.status(404).json({ message: "Menu not found" });
        }

        if (updateData.menu) {
            menuTranslationQueue.addJob(id, oldMenu, updateData.menu);
        }

        return res.status(200).json({ message: "Successfully", data: update });

    } catch (error) {
        return res.status(500).json({ message: error.message });
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