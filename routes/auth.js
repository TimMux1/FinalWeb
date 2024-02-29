const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user'); // Предполагается, что модель User уже создана
const router = express.Router();

// Регистрация нового пользователя
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10); // Хеширование пароля
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save(); // Сохраняем нового пользователя в базе данных
        res.redirect('/login'); // Перенаправляем на страницу входа после регистрации
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при регистрации пользователя.');
    }
});

// Вход пользователя
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        // Пользователь найден и пароль совпадает
        // Здесь должна быть логика создания сессии или токена аутентификации
        res.redirect('/'); // Перенаправляем на главную страницу
    } else {
        res.status(400).send('Неверное имя пользователя или пароль.');
    }
});

module.exports = router;
