const express = require("express");
let { pool } = require("../db");
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const jwtSecret = "iamsecret";
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../auth.js');

router.post('/register', async (req, res) => {
    const result = {
        success: false
    }
    const name = req.body.username;
    const password = req.body.password;
    let id = Math.floor(Date.now() * Math.random() / 1000);
    if (name === "" || password === "") {
        result.message = "Cannot leave blank";
        return res.json(result);
    }
    const [memberList] = await pool.execute("SELECT 1 FROM member WHERE name=?", [name]);
    console.log(memberList);
    if (memberList.length >= 1) {
        result.message = "User already exists";
        return res.json(result);
    } else {
        const hashed = await bcrypt.hash(password, saltRounds);
        await pool.execute("INSERT INTO member (id, name, password) VALUES (?,?,?)", [id, name, hashed]);

        const jti = uuidv4();
        const date = Date.now();
        const payload = {
            id,
            name,
            jti,
            exp: Math.floor(date / 1000) + (60 * 60)
        };
        const token = jwt.sign(payload, jwtSecret);
        const iat = new Date(date).toISOString().slice(0, 19).replace('T', ' ');
        await pool.query(`INSERT INTO token_whitelist (jti, iat) VALUES ("${jti}", "${iat}")`);

        result.success = true;
        result.token = token;
        result.message = "Registration Successful";
        return res.json(result);
    }
});

router.post('/login', async (req, res) => {
    let result = {
        success: false
    }
    const name = req.body.username;
    const password = req.body.password;
    if(!name || !password){
        result.message = "Please provide complete information";
        return res.json(result);
    }
    const [memberList] = await pool.execute("select * from member where name=?", [name]);
    let target = memberList[0];
    console.log(target);
    if (target) {
        const comparedResult = await bcrypt.compare(password, target.password);
        if (comparedResult) {
            const jti = uuidv4();
            const date = Date.now();
            const payload = {
                id: target.id,
                name,
                jti,
                exp: Math.floor(date / 1000) + (60 * 60)
            };
            const token = jwt.sign(payload, jwtSecret);
            const iat = new Date(date).toISOString().slice(0, 19).replace('T', ' ');;
            await pool.query(`INSERT INTO token_whitelist (jti, iat) VALUES ("${jti}", "${iat}")`);
            result.success = true;
            result.token = token;
            result.message = "Login Successful";
            return res.json(result);
        } else {
            result.message = "Invalid username or Password";
            return res.json(result);
        }
    } else {
        result.message = "Invalid Username or password";
        return res.json(result);
    }
})

router.post('/logout', auth, async (req, res) => {
    const targetJti = req.userInfo.jti;
    await pool.execute("DELETE FROM token_whitelist WHERE jti=?", [targetJti]);
    res.json('You logged out successfully');
})

module.exports = router;