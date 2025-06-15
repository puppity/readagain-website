// Version: 6.2.0
// Date: 2025-06-14
// Author: Gemini & Folk
// Description:
//   - แก้ไข: เพิ่ม .sort({ _id: -1 }) ใน API Endpoint /api/videos
//   - เพื่อให้วิดีโอใหม่ล่าสุดแสดงผลขึ้นก่อนเสมอในทุกส่วนของเว็บไซต์

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
const PORT = process.env.PORT || 3000;
const CONNECTION_STRING = process.env.CONNECTION_STRING;
let db;

// ---- 3. การตั้งค่า Middleware ----
app.use(cors());
app.use(express.static(path.join(__dirname, '')));
app.use(express.json());

// Trust the first proxy for Render.com compatibility
app.set('trust proxy', 1);

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key_for_dev',
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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/tag/:tagName', (req, res) => {
    res.sendFile(path.join(__dirname, 'tag.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

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

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful' });
    });
});

// API to get all unique tags
app.get('/api/tags', async (req, res) => {
    try {
        const tags = await db.collection('videos').distinct('tags');
        res.json(tags.filter(tag => tag));
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Tag' });
    }
});

// API for YouTube details
app.get('/api/youtube-details/:videoId', async (req, res) => {
    // ... (This endpoint remains the same)
});

// API to check for duplicate videos
app.get('/api/videos/check/:videoId', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
});

// GET /api/videos (Public)
app.get('/api/videos', async (req, res) => {
  try {
    const { tag } = req.query;
    const query = tag ? { tags: tag } : {};
    // SORT by _id in descending order to get the newest first
    const videos = await db.collection('videos').find(query).sort({ _id: -1 }).toArray();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
});

// POST /api/videos (Protected)
app.post('/api/videos', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
});

// PUT /api/videos/:id (Protected)
app.put('/api/videos/:id', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
});

// DELETE /api/videos/:id (Protected)
app.delete('/api/videos/:id', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
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
