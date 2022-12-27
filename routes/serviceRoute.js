const express = require("express");
let { pool } = require("../db");
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'images/uploaded/' });
const { auth } = require('../auth.js');
const fs = require('fs');

router.get('/', async (req, res) => {
    if (req.query.keyword) {
        let kw = req.query.keyword;
        const [searchKwResult, field] = await pool.execute("SELECT service.id, owner_id, name AS owner_name, item_name, description, availability, like_count FROM service LEFT JOIN member ON member.id=service.owner_id WHERE availability=true AND is_delete=false AND (item_name LIKE ? OR description LIKE ?)", [`%${kw}%`, `%${kw}%`]);
        tinyIntToBoolean(searchKwResult);
        return res.json(searchKwResult);
    } else {
        const [searchAllResult, field] = await pool.execute("SELECT service.id, owner_id, name AS owner_name, item_name, description, availability, like_count FROM service LEFT JOIN member ON member.id=service.owner_id WHERE availability=true AND is_delete=false");
        tinyIntToBoolean(searchAllResult);
        return res.json(searchAllResult);
    }
})

router.get('/:itemId', async (req, res) => {
    let id = parseInt(req.params.itemId);
    const [result] = await pool.execute("SELECT service.id, owner_id, name AS owner_name, item_name, description, availability, like_count FROM service LEFT JOIN member ON member.id=service.owner_id WHERE service.id=? AND is_delete=false", [id]);

    if (result.length >= 1) {
        const [booker] = await pool.execute("SELECT name FROM member JOIN book_record ON book_record.booker_id=member.id WHERE book_record.service_id=? AND status=?", [id, "Confirmed"]);
        if (booker.length >= 1) {
            result[0].bookedBy = booker[0].name;
        } else {
            result[0].bookedBy = null;
        }
        const [cmResult] = await pool.execute("SELECT comment.id, content, author_id, member.name AS authorName, date FROM comment JOIN member ON member.id=comment.author_id WHERE item IN (SELECT id FROM service WHERE id=?)", [id]);
        result[0].comment = cmResult;
        const [picResult] = await pool.execute("SELECT path FROM picture WHERE item IN (SELECT id FROM service WHERE id=?)", [id]);
        //result[0].pictures = picResult;
        let picArr = [];
        picResult.forEach((item) => {
            picArr.push(item.path);
        })
        result[0].pictures = picArr;

        tinyIntToBoolean(result);
        res.json(result);
    } else {
        res.json('Not found');
    }
})

router.post('/', auth, upload.array('pictures'), async (req, res) => {
    let id = Math.floor(Date.now() * Math.random() / 1000);
    const itemName = req.body.itemName;
    const description = req.body.desc;
    const member = req.userInfo;

    //validation: item name and description are must
    if (!itemName || !description) {
        return res.json({ success: false, message: `Please provide complete information` });
    }

    //create new item object
    await pool.execute("INSERT INTO service (id, owner_id, item_name, description, availability, like_count, is_delete) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, member.id, itemName, description, true, 0, false]);

    //handle image paths
    if(req.files.length>=1){
        let sql = [];
        let prepParams = [];
        for (let i = 0; i < req.files.length; i++) {
            let picPath = `/${req.files[i].destination}${req.files[i].filename}`;
            sql.push("(?,?)");
            prepParams.push(id);
            prepParams.push(picPath);
        };
        let result = sql.join(",");
        await pool.execute(`INSERT INTO picture (item, path) VALUES ${result}`, prepParams);
    }


    return res.json({ success: true, message: 'Create a service successfully', item: { id, itemName } })
})

router.patch('/:itemId', auth, upload.array('pictures'), async (req, res) => {
    let id = parseInt(req.params.itemId);
    const [result] = await pool.execute("SELECT id, owner_id, item_name, description, availability, like_count FROM service WHERE id=? AND is_delete=false", [id]);
    //check if there's result
    if (result.length < 1) {
        return res.json({ success: false, message: `Item Not Found` })
    }
    //validate the owner id
    if (result[0].owner_id !== req.userInfo.id) {
        return res.json({ success: false, message: `You don't have permission to update this item` })
    } else {
        const itemName = req.body.itemName;
        const description = req.body.desc;
        const bookedBy = req.body.bookedBy;

        if (itemName) {
            await pool.execute("UPDATE service SET item_name=? WHERE id=?", [itemName, id]);
        }
        if (description) {
            await pool.execute("UPDATE service SET description=? WHERE id=?", [description, id]);
        }
        if (req.files.length > 0) {
            await pool.execute("DELETE FROM picture where item=?", [id]);
            for (let i = 0; i < req.files.length; i++) {
                let picPath = `/${req.files[i].destination}${req.files[i].filename}`;
                await pool.execute(`INSERT INTO picture (item, path) VALUES (${id}, "${picPath}")`);
            };
        }
        if (bookedBy === "") {
            await pool.execute("UPDATE service SET availability=true WHERE id=?", [id]);
            await pool.execute("UPDATE book_record SET status=? WHERE service_id=? AND status=?", ["Cancelled", id, "Confirmed"]);
        }
        return res.json({ success: true, message: 'Update Done'});
    }
})

router.delete('/:itemId', auth, async (req, res) => {
    let id = parseInt(req.params.itemId);
    const [result] = await pool.execute("SELECT id, owner_id, item_name, description, availability, like_count FROM service WHERE id=? AND is_delete=false", [id]);
    //check if there's result
    if (result.length < 1) {
        return res.json({ success: false, message: `Item Not Found` })
    }
    //if it has result
    if (result[0].owner_id !== req.userInfo.id) {
        return res.json({ success: false, message: `You don't have permission to delete this item` })
    } else if (result[0].availability === 0 || result[0].availability === false){
        //any service currently booked by member can't be deleted
        return res.json({ success: false, message: `You cannot delete the service which is currently occupied` })
    } else {
        await pool.execute("UPDATE service SET is_delete=? WHERE id=?", [true, id]);

        //delete pictures from image file and delete pictures path from DB
        const [pic] = await pool.execute("SELECT path FROM picture WHERE item=?", [id]);
        if (pic.length >= 1) {
            for (let i = 0; i < pic.length; i++) {
                let path = pic[i].path;
                fs.unlink(`.${path}`, function (err) {
                    if (err) {
                        console.error(err);
                        console.log('File not found');
                    } else {
                        console.log('File Delete Successfuly');
                    }
                });
            }
        }

        await pool.execute("DELETE FROM picture WHERE item=?", [id]);
        return res.json({ success: true, message: 'Item Deleted'});
    }
})

router.post('/:itemId/like', auth, async (req, res) => {
    let id = parseInt(req.params.itemId);
    const [result] = await pool.execute("SELECT id, owner_id, item_name, description, availability, like_count FROM service WHERE id=? AND is_delete=false", [id]);
    //check if there's result
    if (result.length >= 1) {
        let like = result[0].like_count;
        like++;
        await pool.execute("UPDATE service SET like_count=? WHERE id=?", [like, id]);

        const [displayResult] = await pool.execute("SELECT id, owner_id, item_name, description, availability, like_count FROM service WHERE id=?", [id]);
        return res.json({ success: true, item: displayResult[0], message: `You Liked the post-ID:${id}` });
    } else {
        return res.json({ success: false, message: 'Item Not Found' });
    }
})

router.post('/:itemId/comment', auth, async (req, res) => {
    let itemId = parseInt(req.params.itemId);
    const cmDate = new Date();
    const [result] = await pool.execute("SELECT id, owner_id, item_name, description, availability, like_count FROM service WHERE id=? AND is_delete=false", [itemId]);
    if (result.length >= 1) {
        const id = "c" + Math.floor(Date.now() * Math.random() / 10000);
        const cmMsg = req.body.comment;
        const author = req.userInfo.id;
        await pool.execute("INSERT INTO comment (id, item, content, author_id, date) VALUES (?,?,?,?,?)", [id, itemId, cmMsg, author, cmDate]);
        return res.json({ success: true, message: `You left a comment on post-ID:${itemId}` });
    } else {
        return res.json({ success: false, message: 'Item Not Found' });
    }
})

router.post('/:itemId/booking', auth, async (req, res) => {
    let itemId = parseInt(req.params.itemId);
    const [result] = await pool.execute("SELECT id, owner_id, item_name, description, availability FROM service WHERE id=? AND is_delete=false AND availability=true", [itemId]);
    let targetItem = undefined;
    if (result.length >= 1) {
        targetItem = result[0];
    }

    if (targetItem) {
        if (targetItem.owner_id !== req.userInfo.id) {
            const [bookRecordList] = await pool.execute("SELECT id FROM book_record ORDER BY id DESC limit 1");
            let bookRecordId = bookRecordList[0].id;
            bookRecordId++;
            
            await pool.execute("INSERT INTO book_record (id, service_id, booker_id, status) VALUES (?,?,?,?)", [bookRecordId, targetItem.id, req.userInfo.id, "Confirmed"]);
            await pool.execute("UPDATE service SET availability=false WHERE id=?", [targetItem.id]);
            return res.json({ success: true, message: 'You have successfully booked the service' });
        } else {
            return res.json({ success: false, message: 'You cannot book the service created by yourself' });
        }
    } else {
        return res.json({ success: false, message: 'Item Not Found' });
    }
})

function tinyIntToBoolean(arr) {
    arr.forEach(function (item) {
        item.availability = !!item.availability;
    })
};

module.exports = router;