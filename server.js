// Version: 6.4.0
// Date: 2025-06-15
// Author: Gemini & Folk
// Description:
//   - โค้ดฉบับสมบูรณ์ที่รวมทุกฟังก์ชันและการแก้ไขปัญหาทั้งหมด
//   - แก้ไข: นำ app.set('trust proxy', 1) กลับมาเพื่อให้ Session ทำงานบน Render.com ได้
//   - มี API สำหรับ Tags, YouTube Details, Check Duplicates และระบบ Logging

// ---- 1. นำเข้าเครื่องมือที่จำเป็น ----
require('dotenv').config();
const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');

// ---- 2. ตั้งค่าตัวแปรหลัก ----
const app = express();
const PORT = process.env.PORT || 3000;
const CONNECTION_STRING = process.env.CONNECTION_STRING;
let db;

// ---- 3. การตั้งค่า Middleware ----
app.use(cors());
app.use(express.static(path.join(__dirname, '')));
app.use(express.json());

// ** FIX: Trust the first proxy for Render.com compatibility **
app.set('trust proxy', 1);

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Auth Middleware
const authMiddleware = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
};

// ---- 4. สร้างเส้นทาง (Routes) ----

// --- Page Routes ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/tag/:tagName', (req, res) => { res.sendFile(path.join(__dirname, 'tag.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/admin', authMiddleware, (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });

// --- API Routes ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isLoggedIn = true;
        res.status(200).json({ message: 'Login successful' });
    } else {
        res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
});

app.get('/api/tags', async (req, res) => {
    try {
        const tags = await db.collection('videos').distinct('tags');
        res.json(tags.filter(tag => tag));
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Tag' });
    }
});

app.get('/api/youtube-details/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const apiKey = process.env.YOUTUBE_API_KEY;
    console.log(`[DEBUG] Request for videoId: ${videoId}. API Key Found: ${!!apiKey}`);
    if (!apiKey) {
        return res.status(500).json({ message: 'YOUTUBE_API_KEY is not configured on the server.'});
    }
    const YOUTUBE_API_URL = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`;
    try {
        const response = await axios.get(YOUTUBE_API_URL);
        const snippet = response.data.items[0]?.snippet;
        if (snippet) {
            res.json({ title: snippet.title, description: snippet.description });
        } else {
            res.status(404).json({ message: "Video not found on YouTube" });
        }
    } catch (error) {
        console.error("[DEBUG] YouTube API Error:", error.response?.data?.error?.message || error.message);
        res.status(500).json({ message: 'Error fetching video details from YouTube' });
    }
});

app.get('/api/videos/check/:videoId', authMiddleware, async (req, res) => {
    try {
        const video = await db.collection('videos').findOne({ videoId: req.params.videoId });
        res.json({ exists: !!video, title: video?.title });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
    }
});

app.get('/api/videos', async (req, res) => {
  try {
    const { tag } = req.query;
    const query = tag ? { tags: tag } : {};
    const videos = await db.collection('videos').find(query).sort({ _id: -1 }).toArray();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
});

app.post('/api/videos', authMiddleware, async (req, res) => {
    try {
        const newVideo = req.body;
        if (!newVideo.videoId || !newVideo.title) {
            return res.status(400).json({ message: "กรุณากรอก Video ID และ Title" });
        }
        const existingVideo = await db.collection('videos').findOne({ videoId: newVideo.videoId });
        if (existingVideo) {
            return res.status(409).json({ message: `คลิปนี้มีในระบบแล้ว: "${existingVideo.title}"` });
        }
        const result = await db.collection('videos').insertOne(newVideo);
        res.status(201).json({ message: "เพิ่มวิดีโอใหม่สำเร็จ!", insertedId: result.insertedId });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
    }
});

app.put('/api/videos/:id', authMiddleware, async (req, res) => {
    try {
        const id = new ObjectId(req.params.id);
        const { videoId, title, description, tags } = req.body;
        const result = await db.collection('videos').updateOne({ _id: id }, { $set: { videoId, title, description, tags } });

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "ไม่พบวิดีโอที่ต้องการแก้ไข" });
        }
        res.json({ message: "แก้ไขข้อมูลวิดีโอสำเร็จ" });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
    }
});

app.delete('/api/videos/:id', authMiddleware, async (req, res) => {
    try {
        const id = new ObjectId(req.params.id);
        const result = await db.collection('videos').deleteOne({ _id: id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "ไม่พบวิดีโอที่ต้องการลบ" });
        }
        res.json({ message: "ลบวิดีโอสำเร็จ" });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
    }
});

// ---- 5. ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูลและสตาร์ทเซิร์ฟเวอร์ ----
async function startServer() {
  if(!CONNECTION_STRING) {
    console.error("❌ FAILED TO START: CONNECTION_STRING is not defined in .env file.");
    process.exit(1);
  }
  try {
    const client = new MongoClient(CONNECTION_STRING);
    await client.connect();
    db = client.db("readagain_db");
    console.log("✅ เชื่อมต่อกับฐานข้อมูลสำเร็จ!");

    app.listen(PORT, () => {
      console.log(`🚀 เซิร์ฟเวอร์ของคุณทำงานแล้วที่ http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล:", error);
    process.exit(1);
  }
}

// ---- 6. เรียกใช้งานฟังก์ชันเพื่อเริ่มทุกอย่าง ----
startServer();
