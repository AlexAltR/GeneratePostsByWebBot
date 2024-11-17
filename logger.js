// logger.js

import { createLogger, format, transports } from 'winston';
const { combine, timestamp, printf, errors } = format;

// Формат логов
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
});

// Создаем логгер
const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }), // Для логирования ошибок с трассировкой стека
        logFormat
    ),
    transports: [
        // Логи ошибок в отдельный файл
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        // Все логи в файл
        new transports.File({ filename: 'logs/combined.log' }),
    ],
});

// Если не в production, логируем в консоль
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            logFormat
        )
    }));
}

export default logger;
