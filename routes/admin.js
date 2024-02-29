const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Post = mongoose.model('Post', new mongoose.Schema({
    title: String,
    content: String,
    isAdminPost: { type: Boolean, default: false }
}));

// Доступ к административной панели
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find();
        // Предполагается, что есть шаблон admin.ejs для рендеринга
        res.render('admin', { posts });
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при получении данных.');
    }
});

// Добавление нового поста
router.post('/add-post', async (req, res) => {
    try {
        const { title, content } = req.body;
        const newPost = new Post({ title, content, isAdminPost: true });
        await newPost.save();
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при добавлении поста.');
    }
});

// Удаление поста
router.get('/delete-post/:id', async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при удалении поста.');
    }
});

module.exports = router;
