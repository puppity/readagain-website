// Version: 6.3.0
// Date: 2025-06-15
// Author: Gemini & Folk
// Description:
//   - เพิ่ม: console.log สำหรับ Debugging การดึงข้อมูลจาก YouTube API บน Render.com

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

app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key_for_dev',
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

// ... (Other page routes remain the same)
app.get('/tag/:tagName', (req, res) => { res.sendFile(path.join(__dirname, 'tag.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/admin', authMiddleware, (req, res) => { res.sendFile(path.join(__dirname, 'admin.html')); });

// --- API Routes ---

app.post('/api/login', (req, res) => {
    // ... (This endpoint remains the same)
});

// NEW: API to get all unique tags
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
    const { videoId } = req.params;
    const apiKey = process.env.YOUTUBE_API_KEY;

    console.log(`[DEBUG] Received request for videoId: ${videoId}`);

    if (!apiKey) {
        console.log('[DEBUG] YOUTUBE_API_KEY not found. Using fallback: noembed.com');
        try {
            const noembedRes = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            console.log('[DEBUG] Fallback success. Title:', noembedRes.data.title);
            return res.json({ title: noembedRes.data.title, description: '' });
        } catch (error) {
            console.error('[DEBUG] Fallback Error:', error.message);
            return res.status(404).json({ message: 'Video not found with fallback' });
        }
    }

    console.log('[DEBUG] YOUTUBE_API_KEY found. Using YouTube Data API.');
    const YOUTUBE_API_URL = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`;

    try {
        const response = await axios.get(YOUTUBE_API_URL);
        const snippet = response.data.items[0]?.snippet;

        if (snippet) {
            console.log('[DEBUG] YouTube API success. Title:', snippet.title);
            res.json({
                title: snippet.title,
                description: snippet.description,
            });
        } else {
            console.log('[DEBUG] Video not found on YouTube. API response:', response.data);
            res.status(404).json({ message: "Video not found on YouTube" });
        }
    } catch (error) {
        console.error("[DEBUG] Error fetching from YouTube API:", error.response?.data?.error?.message || error.message);
        res.status(500).json({ message: 'Error fetching video details from YouTube' });
    }
});


// ... (Other API routes remain the same)
app.get('/api/videos/check/:videoId', authMiddleware, async (req, res) => {
    try {
        const { videoId } = req.params;
        const video = await db.collection('videos').findOne({ videoId: videoId });
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
