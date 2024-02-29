const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const multer = require('multer');
const path = require('path');
const app = express();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru', 
    port: 587, 
    secure: false,
    auth: {
        user: 'timchik.mux@mail.ru', 
        pass: 'E4xa6UKa3VrusheSdSwF'
    },
});

const sendWelcomeEmail = (email, username) => {
    const mailOptions = {
        from: 'timchik.mux@mail.ru', // От кого
        to: email, // Кому
        subject: 'Добро пожаловать на сайт!', // Тема письма
        text: `Привет, ${username}! Добро пожаловать на наш сайт. Мы рады, что вы присоединились к нам.` // Текст письма
        // html: '<b>Привет</b> <i>username</i>! Добро пожаловать на наш сайт. Мы рады, что вы присоединились к нам.' // HTML тело письма
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Не удалось отправить письмо: ', error);
        } else {
            console.log('Письмо успешно отправлено: ', info.response);
        }
    });
};

// Настройка хранилища для Multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/img');
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Настройка подключения к MongoDB
const mongoDB = 'mongodb://127.0.0.1:27017/db_users';
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Успешное подключение к MongoDB'))
    .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Определение схем и создание моделей
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    isAdmin: { type: Boolean, default: false },
    name: String,
    age: Number,
    description: String,
    photo: String // Путь к фотографии пользователя
});
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    author: String,
    isAdminPost: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Настройки Express и сессий
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Для обслуживания загруженных файлов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Создание нового MongoDBStore для сессий
const store = new MongoDBStore({
    uri: mongoDB,
    collection: 'mySessions'
});
app.use(session({
    secret: 'someSecret',
    resave: false,
    saveUninitialized: true,
    store: store
}));

// Функция создания администратора Tim
const createAdminUser = async () => {
    try {
        const userExists = await User.findOne({ username: 'Tim' });
        if (!userExists) {
            const hashedPassword = await bcrypt.hash('tim111!!', 10);
            const adminUser = new User({
                username: 'Tim',
                password: hashedPassword,
                isAdmin: true
            });
            await adminUser.save();
            console.log('Администратор Tim успешно создан');
        }
    } catch (err) {
        console.error('Ошибка при создании администратора Tim:', err);
    }
};

// Маршруты
app.get('/', async (req, res) => {
    let posts = await Post.find().sort({ isAdminPost: -1 });
    res.render('index', { user: req.session.user, posts, isAdmin: req.session.isAdmin });
});

app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send('Неверное имя пользователя или пароль');
    }
    req.session.user = user.username;
    req.session.isAdmin = user.isAdmin;
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Ошибка сервера');
        }
        res.redirect('/');
    });
});

app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    const { username, password, email } = req.body; // Убедитесь, что email включен в тело запроса
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, email });
        await newUser.save();
        res.redirect('/login');

        // Вызов функции отправки письма после успешной регистрации
        sendWelcomeEmail(email, username);

    } catch (err) {
        console.error('Ошибка при регистрации пользователя: ', err);
        res.status(400).send('Ошибка при регистрации пользователя');
    }
});


app.post('/add-post', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('Требуется авторизация');
    }
    const { title, content } = req.body;
    await new Post({ title, content, author: req.session.user, isAdminPost: req.session.isAdmin }).save();
    res.redirect('/');
});

app.post('/delete-post/:id', async (req, res) => {
    const post = await Post.findById(req.params.id);

    // Проверяем, является ли пользователь автором поста или администратором
    if (req.session.user === post.author || req.session.isAdmin) {
        await Post.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } else {
        res.status(403).send('Недостаточно прав для удаления поста');
    }
});


app.post('/edit-post', async (req, res) => {
    const { postId, title, content } = req.body;
    const post = await Post.findById(postId);

    // Проверяем, является ли пользователь автором поста или администратором
    if (req.session.user === post.author || req.session.isAdmin) {
        await Post.findByIdAndUpdate(postId, { title, content });
        res.json({ success: true, message: 'Пост успешно обновлен', postId, title, content });
    } else {
        res.status(403).json({ error: 'Недостаточно прав для редактирования поста' });
    }
});


app.get('/profile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const user = await User.findOne({ username: req.session.user });
    if (user) {
        res.render('profile', { user: user });
    } else {
        res.status(404).send('Профиль не найден');
    }
});

app.post('/update-profile', upload.single('photo'), async (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('Требуется авторизация');
    }
    const { name, age, description } = req.body;
    let update = { name, age, description };
    if (req.file) {
        update.photo = `/uploads/${req.file.filename}`;
    }
    try {
        await User.findOneAndUpdate({ username: req.session.user }, update);
        res.redirect('/profile');
    } catch (err) {
        res.status(500).send('Ошибка при обновлении профиля');
    }
});

app.use('/uploads', express.static('public/img'))

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    createAdminUser();
});
