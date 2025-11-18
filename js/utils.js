// Функции уведомлений
function showSuccess(message, duration = 3000) {
    showNotification(message, 'success', duration);
}

function showError(message, duration = 5000) {
    showNotification(message, 'error', duration);
}

function showWarning(message, duration = 4000) {
    showNotification(message, 'warning', duration);
}

function showInfo(message, duration = 3000) {
    showNotification(message, 'info', duration);
}

function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.onclick = () => notification.remove();

    container.appendChild(notification);

    // Автоматическое удаление
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// Утилиты для работы с устройствами
const DeviceUtils = {
    // Определение типа устройства
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
            return 'mobile';
        } else {
            return 'desktop';
        }
    },

    // Проверка поддержки Touch
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // Получение информации об устройстве
    getDeviceInfo() {
        return {
            type: this.getDeviceType(),
            userAgent: navigator.userAgent,
            screen: `${screen.width}x${screen.height}`,
            touch: this.isTouchDevice(),
            platform: navigator.platform
        };
    }
};

// Улучшенные уведомления с поддержкой мобильных
function showNotification(message, type = 'info', duration = 5000) {
    // Используем существующий showSuccess/Error/Warning для обратной совместимости
    switch (type) {
        case 'success':
            showSuccess(message, duration);
            break;
        case 'error':
            showError(message, duration);
            break;
        case 'warning':
            showWarning(message, duration);
            break;
        default:
            showInfo(message, duration);
    }
}
