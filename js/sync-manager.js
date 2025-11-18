class SyncManager {
    constructor() {
        this.syncEnabled = true;
        this.lastSync = null;
    }

    // Основной метод синхронизации всех данных
    async syncAllData() {
        try {
            console.log('🔄 Начинаем синхронизацию данных...');
            
            // Синхронизируем контрагентов
            await this.syncContractors();
            
            // Синхронизируем отчеты
            await this.syncReports();
            
            // Синхронизируем уведомления
            await this.syncNotifications();
            
            this.lastSync = new Date().toISOString();
            localStorage.setItem('last_sync_time', this.lastSync);
            
            console.log('✅ Синхронизация завершена');
            showSuccess('Данные синхронизированы между устройствами');
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            showError('Ошибка синхронизации данных');
            return false;
        }
    }

    // Синхронизация контрагентов
    syncContractors() {
        return new Promise((resolve) => {
            try {
                const contractors = JSON.parse(localStorage.getItem('honest_sign_contractors') || '[]');
                const defaultContractors = this.getDefaultContractors();
                
                // Объединяем контрагентов, избегая дубликатов
                const allContractors = [...defaultContractors];
                
                contractors.forEach(contractor => {
                    if (!allContractors.some(c => c.id === contractor.id)) {
                        allContractors.push(contractor);
                    }
                });
                
                // Сохраняем объединенный список
                localStorage.setItem('honest_sign_contractors', JSON.stringify(allContractors));
                
                console.log('✅ Контрагенты синхронизированы:', allContractors.length);
                resolve();
            } catch (error) {
                console.error('Ошибка синхронизации контрагентов:', error);
                resolve(); // Продолжаем даже при ошибке
            }
        });
    }

    // Синхронизация отчетов
    syncReports() {
        return new Promise((resolve) => {
            try {
                // Основной источник - warehouse_reports
                const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
                const appStateReports = JSON.parse(localStorage.getItem('honest_sign_reports') || '[]');
                
                // Объединяем отчеты
                const allReports = [...warehouseReports];
                
                appStateReports.forEach(report => {
                    if (!allReports.some(r => r.id === report.id)) {
                        allReports.push(report);
                    }
                });
                
                // Сохраняем во все хранилища для совместимости
                localStorage.setItem('warehouse_reports', JSON.stringify(allReports));
                localStorage.setItem('honest_sign_reports', JSON.stringify(allReports));
                
                console.log('✅ Отчеты синхронизированы:', allReports.length);
                resolve();
            } catch (error) {
                console.error('Ошибка синхронизации отчетов:', error);
                resolve();
            }
        });
    }

    // Синхронизация уведомлений
    syncNotifications() {
        return new Promise((resolve) => {
            try {
                const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
                // Ограничиваем количество уведомлений
                if (notifications.length > 100) {
                    notifications.splice(100);
                    localStorage.setItem('warehouse_notifications', JSON.stringify(notifications));
                }
                console.log('✅ Уведомления синхронизированы:', notifications.length);
                resolve();
            } catch (error) {
                console.error('Ошибка синхронизации уведомлений:', error);
                resolve();
            }
        });
    }

    // Получение стандартных контрагентов
    getDefaultContractors() {
        return [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель', createdAt: new Date().toISOString() },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть', createdAt: new Date().toISOString() },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер', createdAt: new Date().toISOString() },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер', createdAt: new Date().toISOString() },
            { id: 5, name: 'ООО "Луч Саяны"', category: 'Дилер', createdAt: new Date().toISOString() },
            { id: 6, name: 'АО "Луч Восток"', category: 'Партнер', createdAt: new Date().toISOString() },
            { id: 7, name: 'ИП Лучистый', category: 'Розничная сеть', createdAt: new Date().toISOString() }
        ];
    }

    // Экспорт всех данных
    exportAllData() {
        try {
            const data = {
                contractors: JSON.parse(localStorage.getItem('honest_sign_contractors') || '[]'),
                reports: JSON.parse(localStorage.getItem('warehouse_reports') || '[]'),
                notifications: JSON.parse(localStorage.getItem('warehouse_notifications') || '[]'),
                exportedAt: new Date().toISOString(),
                device: navigator.userAgent,
                version: '1.0'
            };
            
            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `megaqr_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            showSuccess(`Экспортировано: ${data.contractors.length} контрагентов, ${data.reports.length} отчетов`);
            return true;
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            showError('Ошибка экспорта данных');
            return false;
        }
    }

    // Импорт всех данных
    importAllData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // Валидация данных
                    if (!data.contractors || !data.reports) {
                        throw new Error('Неверный формат файла');
                    }
                    
                    // Сохраняем данные
                    localStorage.setItem('honest_sign_contractors', JSON.stringify(data.contractors));
                    localStorage.setItem('warehouse_reports', JSON.stringify(data.reports));
                    
                    if (data.notifications) {
                        localStorage.setItem('warehouse_notifications', JSON.stringify(data.notifications));
                    }
                    
                    console.log('✅ Данные импортированы:', {
                        contractors: data.contractors.length,
                        reports: data.reports.length
                    });
                    
                    showSuccess(`Импортировано: ${data.contractors.length} контрагентов, ${data.reports.length} отчетов`);
                    resolve(true);
                    
                } catch (error) {
                    console.error('Ошибка импорта:', error);
                    showError('Ошибка импорта: неверный формат файла');
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Ошибка чтения файла'));
            };
            
            reader.readAsText(file);
        });
    }

    // Проверка необходимости синхронизации
    needsSync() {
        const lastSync = localStorage.getItem('last_sync_time');
        if (!lastSync) return true;
        
        const lastSyncDate = new Date(lastSync);
        const now = new Date();
        const hoursDiff = (now - lastSyncDate) / (1000 * 60 * 60);
        
        return hoursDiff > 1; // Синхронизировать если прошло больше часа
    }

    // Автоматическая синхронизация при загрузке
    autoSync() {
        if (this.needsSync()) {
            setTimeout(() => {
                this.syncAllData();
            }, 3000);
        }
    }
}

// Глобальный экземпляр
const syncManager = new SyncManager();
