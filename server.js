const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Путь к файлу, где будут храниться рекорды
const DB_FILE = path.join(__dirname, 'leaderboard_data.json');

// Загружаем данные при старте сервера
let savedScores = [];
if (fs.existsSync(DB_FILE)) {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        savedScores = JSON.parse(data);
    } catch (err) {
        console.error("Ошибка чтения файла базы данных:", err);
    }
}

// Функция сохранения в файл
function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(savedScores, null, 2), 'utf8');
    } catch (err) {
        console.error("Ошибка записи файла базы данных:", err);
    }
}

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    // Получение лидерборда
    socket.on('get_leaderboard', (tab) => {
        // Сортируем по убыванию очков/волн
        let sorted = [...savedScores].sort((a, b) => b.score - a.score);
        
        // Ограничиваем топ-10 игроков
        socket.emit('leaderboard_data', { tab: tab, list: sorted.slice(0, 10) });
    });

    // Сохранение результата при смерти игрока
    socket.on('submit_score', (playerData) => {
        if (!playerData || typeof playerData.score !== 'number') return;

        // Ищем, есть ли уже этот игрок (по кошельку или имени)
        let existingIndex = savedScores.findIndex(item => 
            (playerData.address && item.address === playerData.address) || 
            item.name === playerData.name
        );

        if (existingIndex !== -1) {
            // Обновляем рекорд, только если новый лучше старого
            if (playerData.score > savedScores[existingIndex].score) {
                savedScores[existingIndex].score = playerData.score;
                savedScores[existingIndex].wave = playerData.wave || 1;
                saveDatabase();
            }
        } else {
            // Добавляем нового игрока
            savedScores.push({
                name: playerData.name || 'Unknown Hero',
                address: playerData.address || '',
                score: playerData.score,
                wave: playerData.wave || 1
            });
            saveDatabase();
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});