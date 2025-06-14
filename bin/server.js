// Version: 3.2.0
// Date: 2025-06-13
// Author: Gemini & Folk
// Description: เพิ่ม API Endpoint สำหรับ Timeline และปรับปรุง API เดิม

// ---- 1. นำเข้าเครื่องมือที่จำเป็น ----
const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

// ---- 2. ตั้งค่าตัวแปร ----
const app = express();
const PORT = 3000;
const CONNECTION_STRING = "mongodb+srv://readagain118:JbX8W9GqjF0K0Z1L@readagaincluster.hsgfgig.mongodb.net/?retryWrites=true&w=majority&appName=ReadAgainCluster";
let db;

// ---- 3. การตั้งค่า Middleware ----
app.use(cors());
app.use(express.static(path.join(__dirname, '')));
app.use(express.json()); 

// ---- 4. สร้างเส้นทาง (Routes) ----
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// GET /api/videos - ดึงวิดีโอทั้งหมด (พร้อมกรองและจัดเรียง)
app.get('/api/videos', async (req, res) => {
  try {
    const { tag, search } = req.query; 
    let query = {};

    if (tag) {
        query = { tags: tag };
    } else if (search) {
        query = { $text: { $search: search } };
    }
    
    const videos = await db.collection('videos').find(query).sort({ _id: -1 }).toArray();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
});

// GET /api/timeline - ดึงข้อมูล Timeline
app.get('/api/timeline', async (req, res) => {
    try {
        // ในอนาคต ส่วนนี้จะดึงข้อมูลจาก Database
        // ตอนนี้เราจะใช้ข้อมูลจำลองไปก่อน
        const timelineData = {
            title: "วิธีไม่ตกอยู่ในเกมรัก",
            description: "ความสัมพันธ์แบบไหนถึงจะดี | THINGS NO ONE TAUGHT US ABOUT LOVE",
            imageUrl: "https://img.youtube.com/vi/a-T3Gf-K484/maxresdefault.jpg", // URL รูปภาพที่คุณจะอัปโหลดเอง
            videoId: "a-T3Gf-K484" // ID ของวิดีโอที่ต้องการให้เปิดเมื่อคลิก
        };
        res.json(timelineData);
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Timeline' });
    }
});

// --- API สำหรับการจัดการวิดีโอ (POST, PUT, DELETE) ยังคงเหมือนเดิม ---
app.post('/api/videos', async (req, res) => { /* ... โค้ดเหมือนเดิม ... */ });
app.put('/api/videos/:id', async (req, res) => { /* ... โค้ดเหมือนเดิม ... */ });
app.delete('/api/videos/:id', async (req, res) => { /* ... โค้ดเหมือนเดิม ... */ });

// ---- 5. ฟังก์ชันสำหรับเชื่อมต่อฐานข้อมูลและสตาร์ทเซิร์ฟเวอร์ ----
async function startServer() {
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
