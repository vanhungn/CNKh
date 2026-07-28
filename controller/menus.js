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

                    menuTitle: { $first: "$menu.title" },
                    menuTitleEN: { $first: "$menu.titleEN" },
                    menuLocal: { $first: "$menu.local" },
                    menuKindOf: { $first: "$menu.kindOf" },
                    // bannerTopPic thuộc cấp "menu" (song song với title/local/kindOf),
                    // không phụ thuộc menu1/menu2 nên lấy $first như các field cấp menu khác.
                    menuBannerTopPic: { $first: "$menu.bannerTopPic" },

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

                    menuTitle: { $first: "$menuTitle" },
                    menuTitleEN: { $first: "$menuTitleEN" },
                    menuLocal: { $first: "$menuLocal" },
                    menuKindOf: { $first: "$menuKindOf" },
                    menuBannerTopPic: { $first: "$menuBannerTopPic" },

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
            // Group menu
            // =========================
            {
                $group: {
                    _id: "$_id.docId",

                    logo: { $first: "$logo" },
                    banner: { $first: "$banner" },

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
                                    bannerTopPic: "$menuBannerTopPic",
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

                                        // Sắp xếp bannerTopPic của từng menu theo locationBanner,
                                        // giống cách banner cấp document được sắp xếp phía trên.
                                        bannerTopPic: {
                                            $sortArray: {
                                                input: { $ifNull: ["$$m.bannerTopPic", []] },
                                                sortBy: {
                                                    locationBanner: 1
                                                }
                                            }
                                        },

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
        const { menu, locationBanner } = req.body;
        const logo = req.files?.['logo']?.[0];
        const banners = req.files?.['banner'];
        const menuBannerFiles = req.files?.['menuBanner'] || []; // banner con trong từng menu

        if (!menu || !logo || !banners || banners.length <= 0 || !locationBanner) {
            return res.status(400).json({ message: "Not valid" });
        }

        const parsedMenu = JSON.parse(menu);
        const parsedLocations = JSON.parse(locationBanner);

        // ===== Upload logo =====
        const resultLogo = await cloudinary.uploader.upload(logo.path, {
            folder: "editorjs",
        });

        // ===== Upload banner cấp document =====
        const uploadPromises = banners.map((file, index) =>
            cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                .then(result => ({
                    img: result.secure_url,
                    locationBanner: Number(parsedLocations[index]) || index + 1
                }))
        );
        const arrBanner = await Promise.all(uploadPromises);

        // ===== Upload banner con nằm trong từng menu (bannerTopPic) =====
        const uploadedMenuBannerUrls = await Promise.all(
            menuBannerFiles.map(file =>
                cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                    .then(result => result.secure_url)
            )
        );

        // Map ngược url mới vào đúng vị trí trong parsedMenu
        // (FE phải append file menuBanner theo đúng thứ tự duyệt menu -> bannerTopPic)
        let bannerCursor = 0;
        const finalMenu = parsedMenu.map(m1 => ({
            title: m1.title,
            titleEN: m1.titleEN,
            local: m1.local,
            kindOf: m1.kindOf,
            bannerTopPic: (m1.bannerTopPic || []).map(b => {
                if (b.type === "new") {
                    const img = uploadedMenuBannerUrls[bannerCursor];
                    bannerCursor++;
                    return { img, locationBanner: b.locationBanner };
                }
                return { img: b.img, locationBanner: b.locationBanner };
            }),
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
            banner: arrBanner
        });

        return res.status(201).json({ message: "Successfully", data: create });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
const UpdateMenu = async (req, res) => {
    try {
        const { menu, bannerMeta } = req.body;
        const { id } = req.params;
        const logo = req.files?.['logo']?.[0];
        const newBannerFiles = req.files?.['banner'] || [];
        const newMenuBannerFiles = req.files?.['menuBanner'] || [];

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

        // ===== Menu (kèm banner con bannerTopPic) =====
        if (menu) {
            const oldDoc = await modelMenu.findById(id).select('menu').lean();
            oldMenu = oldDoc?.menu || [];

            const parsedMenu = JSON.parse(menu);

            // Upload tất cả file banner con MỚI (gộp từ mọi menu, theo đúng thứ tự FE append)
            const uploadedMenuBannerUrls = await Promise.all(
                newMenuBannerFiles.map(file =>
                    cloudinary.uploader.upload(file.path, { folder: "editorjs" })
                        .then(result => result.secure_url)
                )
            );

            let bannerCursor = 0;
            updateData.menu = parsedMenu.map(m1 => ({
                ...(m1._id ? { _id: m1._id } : {}),
                title: m1.title,
                titleEN: m1.titleEN,
                local: m1.local,
                kindOf: m1.kindOf,
                bannerTopPic: (m1.bannerTopPic || []).map(b => {
                    if (b.type === "new") {
                        const img = uploadedMenuBannerUrls[bannerCursor];
                        bannerCursor++;
                        return { img, locationBanner: b.locationBanner };
                    }
                    return { img: b.img, locationBanner: b.locationBanner };
                }),
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