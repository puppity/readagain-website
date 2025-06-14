// Version: 4.1.0
// Date: 2025-06-14
// Author: Gemini & Folk
// Description:
//   - แก้ไขปัญหาล็อกอินแล้วรีเฟรชบน Render.com
//   - เพิ่ม app.set('trust proxy', 1) เพื่อให้ session cookie ทำงานได้ถูกต้องหลัง reverse proxy

// ---- 1. นำเข้าเครื่องมือที่จำเป็น (Import Dependencies) ----
require('dotenv').config();
const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');

// ---- 2. ตั้งค่าตัวแปรหลัก (Initial Setup) ----
const app = express();
const PORT = 3000;
const CONNECTION_STRING = process.env.CONNECTION_STRING;
let db;

// ---- 3. การตั้งค่า Middleware ----
app.use(cors());
app.use(express.static(path.join(__dirname, '')));
app.use(express.json());

// NEW: Trust the first proxy (for Render.com compatibility)
app.set('trust proxy', 1);

// ตั้งค่า Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // ใน production ควรเป็น true (HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // Cookie มีอายุ 1 วัน (24 ชั่วโมง)
    }
}));

// Middleware สำหรับตรวจสอบการ Login
const authMiddleware = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next(); // ถ้า Login อยู่แล้ว ให้ทำคำสั่งถัดไป
    } else {
        res.redirect('/login'); // ถ้ายังไม่ได้ Login ให้ redirect ไปที่หน้า Login
    }
};


// ---- 4. สร้างเส้นทาง (Routes) ----

// --- Page Routes ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route สำหรับหน้า Login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Route สำหรับหน้า Admin ที่มีการป้องกัน
app.get('/admin', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});


// --- API Routes ---

// API สำหรับ Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // ตรวจสอบชื่อผู้ใช้และรหัสผ่านกับค่าที่ตั้งไว้ในไฟล์ .env
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isLoggedIn = true; // บันทึกสถานะ Login ลงใน Session
        res.status(200).json({ message: 'Login successful' });
    } else {
        res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
});

// API สำหรับ Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'ไม่สามารถออกจากระบบได้' });
        }
        res.clearCookie('connect.sid'); // ล้าง Cookie ของ Session
        res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
    });
});

// API สำหรับดึงข้อมูลวิดีโอจาก YouTube
app.get('/api/youtube-details/:videoId', async (req, res) => {
    const { videoId } = req.params;
    const apiKey = process.env.YOUTUBE_API_KEY;

    // Fallback กรณีไม่มี API Key
    if (!apiKey) {
        try {
            const noembedRes = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            return res.json({ title: noembedRes.data.title, description: '' });
        } catch (error) {
             return res.status(404).json({ message: 'Video not found with fallback' });
        }
    }

    // ใช้ YouTube Data API v3 เมื่อมี API Key
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
        console.error("Error fetching from YouTube API:", error.response?.data?.error?.message || error.message);
        res.status(500).json({ message: 'Error fetching video details from YouTube' });
    }
});

// GET /api/videos (Public - ไม่ต้องป้องกัน)
app.get('/api/videos', async (req, res) => {
  try {
    const { tag } = req.query;
    const query = tag ? { tags: tag } : {};
    const videos = await db.collection('videos').find(query).toArray();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
});

// POST /api/videos (Protected)
app.post('/api/videos', authMiddleware, async (req, res) => {
    try {
        const newVideo = req.body;
        if (!newVideo.videoId || !newVideo.title) {
            return res.status(400).json({ message: "กรุณากรอก Video ID และ Title" });
        }
        const result = await db.collection('videos').insertOne(newVideo);
        res.status(201).json({ message: "เพิ่มวิดีโอใหม่สำเร็จ!", insertedId: result.insertedId });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
    }
});

// PUT /api/videos/:id (Protected)
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

// DELETE /api/videos/:id (Protected)
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
