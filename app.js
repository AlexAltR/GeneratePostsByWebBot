import dotenv from 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import { OpenAI } from 'openai';
import logger from './logger.js'; // Импортируем логгер
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname в ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usedTopicsFile = path.join(__dirname, 'usedTopics.json');

// Проверка наличия папки logs
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Инициализация Telegram бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Инициализация OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ID чата для отправки сообщений
const chatId = process.env.CHAT_ID;

// Темы для генерации постов
const topics = [
    'React.js',
    'Angular',
    'Vue.js',
    'Node.js',
    'Express.js',
    'GraphQL',
    'TypeScript',
    'Webpack',
    'Docker',
    'Kubernetes',
    'Microservices',
    'Progressive Web Apps',
    'Serverless Computing',
    'WebAssembly',
    'RESTful APIs',
    'Next.js',
    'Nuxt.js',
    'Svelte',
    'Tailwind CSS',
    'Responsive Design',
];

// Максимальное количество дней для хранения использованных тем
const MAX_TOPIC_AGE_DAYS = 7;

/**
 * Загружает использованные темы из файла
 */
function loadUsedTopics() {
    try {
        if (fs.existsSync(usedTopicsFile)) {
            const data = fs.readFileSync(usedTopicsFile, 'utf-8');
            return JSON.parse(data);
        } else {
            return {};
        }
    } catch (error) {
        logger.error('Ошибка при загрузке использованных тем:', error);
        return {};
    }
}

/**
 * Сохраняет использованные темы в файл
 */
function saveUsedTopics(usedTopics) {
    try {
        fs.writeFileSync(usedTopicsFile, JSON.stringify(usedTopics, null, 2));
    } catch (error) {
        logger.error('Ошибка при сохранении использованных тем:', error);
    }
}

/**
 * Добавляет тему в список использованных тем
 */
function addUsedTopic(topic) {
    const usedTopics = loadUsedTopics();
    usedTopics[topic] = new Date().toISOString();
    saveUsedTopics(usedTopics);
}

/**
 * Очищает устаревшие темы из списка использованных тем
 */
function cleanUpUsedTopics(usedTopics) {
    const cleanedTopics = {};
    const now = new Date();
    for (const [topic, dateStr] of Object.entries(usedTopics)) {
        const topicDate = new Date(dateStr);
        const diffDays = (now - topicDate) / (1000 * 60 * 60 * 24);
        if (diffDays < MAX_TOPIC_AGE_DAYS) {
            cleanedTopics[topic] = dateStr;
        }
    }
    return cleanedTopics;
}

/**
 * Получает список доступных тем, исключая использованные
 */
function getAvailableTopics() {
    let usedTopics = loadUsedTopics();
    usedTopics = cleanUpUsedTopics(usedTopics);
    saveUsedTopics(usedTopics);

    const usedTopicKeys = Object.keys(usedTopics);
    return topics.filter(topic => !usedTopicKeys.includes(topic));
}

/**
 * Выбирает случайную тему
 */
function getRandomTopic() {
    const availableTopics = getAvailableTopics();
    if (availableTopics.length === 0) {
        logger.warn('Все темы были использованы. Сбрасываем список использованных тем.');
        saveUsedTopics({});
        return getRandomTopic();
    }
    const randomIndex = Math.floor(Math.random() * availableTopics.length);
    return availableTopics[randomIndex];
}

/**
 * Выполняет повторные попытки асинхронной операции
 */
async function retryOperation(operation, retries, delay) {
    try {
        return await operation();
    } catch (error) {
        if (retries > 0) {
            logger.warn(`Ошибка при выполнении операции. Повторная попытка через ${delay} мс. Осталось попыток: ${retries}`);
            await new Promise(res => setTimeout(res, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        } else {
            throw error;
        }
    }
}

/**
 * Генерирует пост о веб-технологиях с использованием GPT-4o-mini
 */
async function generatePost() {
    try {
        const topic = getRandomTopic();
        const prompt = `Напиши информативный и интересный пост о веб-технологии "${topic}". Используй Markdown.`;

        const operation = async () => {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Ты эксперт в веб-технологиях.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 800,
                temperature: 0.7,
            });
            return response.choices[0].message.content;
        };

        const generatedText = await retryOperation(operation, 3, 1000);
        logger.info(`Пост успешно сгенерирован на тему: ${topic}`);
        addUsedTopic(topic);
        return generatedText;
    } catch (error) {
        logger.error('Ошибка при генерации поста:', error);
        return null;
    }
}

/**
 * Отправляет сообщение через Telegram
 */
async function sendMessage(text) {
    try {
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        logger.info('Сообщение успешно отправлено');
    } catch (error) {
        logger.error('Ошибка при отправке сообщения:', error);
    }
}

// Планирование задач
const timezone = 'Europe/Moscow';
cron.schedule('0 9 * * *', async () => {
    const post = await generatePost();
    if (post) await sendMessage(post);
}, { timezone });

cron.schedule('0 18 * * *', async () => {
    const post = await generatePost();
    if (post) await sendMessage(post);
}, { timezone });

// Немедленная генерация и отправка поста
(async () => {
    const post = await generatePost();
    if (post) await sendMessage(post);
})();