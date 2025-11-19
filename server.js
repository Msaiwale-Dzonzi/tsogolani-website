const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Ensure upload directories exist
['uploads/images', 'uploads/videos'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'adminsecret',
    resave: false,
    saveUninitialized: true
}));

// Admin credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password123';

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'images') cb(null, 'uploads/images');
        else if (file.fieldname === 'videos') cb(null, 'uploads/videos');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// News file
const NEWS_FILE = 'news.json';
function loadNews() {
    if (fs.existsSync(NEWS_FILE)) {
        const data = fs.readFileSync(NEWS_FILE);
        return data.length ? JSON.parse(data) : [];
    }
    return [];
}
function saveNews(news) {
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
}

// Routes
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/admin', (req,res) => res.sendFile(path.join(__dirname,'public','admin.html')));

// Admin login
app.post('/admin/login', (req,res)=>{
    const { username, password } = req.body;
    if(username === ADMIN_USER && password === ADMIN_PASS){
        req.session.admin = true;
        res.json({ success:true });
    } else res.json({ success:false });
});

// Admin logout
app.post('/admin/logout', (req,res)=>{
    req.session.destroy();
    res.json({ success:true });
});

// Get all news (for homepage)
app.get('/api/news', (req,res)=>{
    res.json(loadNews());
});

// Add news
app.post('/api/news', upload.fields([{ name:'images' },{ name:'videos' }]), (req,res)=>{
    if(!req.session.admin) return res.status(403).send('Forbidden');

    const news = loadNews();
    const newItem = {
        title: req.body.title,
        desc: req.body.desc,
        images: req.files['images'] ? req.files['images'].map(f => '/uploads/images/' + f.filename) : [],
        videos: req.files['videos'] ? req.files['videos'].map(f => '/uploads/videos/' + f.filename) : []
    };
    news.push(newItem);
    saveNews(news);
    res.json({ success:true });
});

// Delete news by index
app.delete('/api/news/:index', (req,res)=>{
    if(!req.session.admin) return res.status(403).send('Forbidden');
    const news = loadNews();
    const idx = parseInt(req.params.index);
    if(news[idx]){
        // Delete associated files
        news[idx].images.forEach(img => {
            const filePath = path.join(__dirname, img);
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        news[idx].videos.forEach(video => {
            const filePath = path.join(__dirname, video);
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        news.splice(idx,1);
        saveNews(news);
        res.json({ success:true });
    } else res.status(404).send('Not found');
});

// Clear all news
app.delete('/api/news', (req,res)=>{
    if(!req.session.admin) return res.status(403).send('Forbidden');
    const news = loadNews();
    news.forEach(item=>{
        item.images.forEach(img => {
            const filePath = path.join(__dirname, img);
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        item.videos.forEach(video => {
            const filePath = path.join(__dirname, video);
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    });
    saveNews([]);
    res.json({ success:true });
});

app.listen(PORT, ()=> console.log(`Server running at http://localhost:${PORT}`));
