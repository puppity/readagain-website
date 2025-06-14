// Version: 6.0.0
// Date: 2025-06-13
// Author: Gemini & Folk
// Description:
//   - เพิ่ม API Endpoint ใหม่ (/api/tags) สำหรับดึงรายการ Tag ทั้งหมด
//   - เพิ่ม Route ใหม่ (/tag/:tagName) สำหรับแสดงหน้าหมวดหมู่

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

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

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

// NEW: Route for tag pages
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

// NEW: API to get all unique tags
app.get('/api/tags', async (req, res) => {
    try {
        const tags = await db.collection('videos').distinct('tags');
        res.json(tags.filter(tag => tag)); // Filter out any null/empty tags
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Tag' });
    }
});

app.get('/api/youtube-details/:videoId', async (req, res) => {
    // ... (This endpoint remains the same)
});

app.get('/api/videos/check/:videoId', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
});

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

app.post('/api/videos', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
});

app.put('/api/videos/:id', authMiddleware, async (req, res) => {
    // ... (This endpoint remains the same)
});

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
