class AccountantManager {
    constructor() {
        this.reports = [];
        this.filters = {
            date: '',
            contractor: '',
            showProcessed: false
        };
        this.pdfGenerator = new PDFGenerator();
        this.init();
    }

    init() {
        console.log('🚀 Инициализация AccountantManager');
        
        this.loadContractors();
        this.syncDataSources();
        this.loadReports();
        this.attachEventListeners();
        this.updateStatistics();
        
        // Принудительно загружаем контрагентов если их нет
        setTimeout(() => {
            const select = document.getElementById('contractorFilter');
            if (select.options.length <= 1) {
                console.log('🔄 Forcing contractors reload...');
                this.loadContractorsFromStorage();
            }
        }, 1000);

        showSuccess('Бухгалтерский модуль загружен', 3000);
    }

    // Добавьте эти методы в класс AccountantManager

// Экспорт данных с текущего устройства
exportReportsData() {
    try {
        const reports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
        const data = {
            reports: reports,
            exportedAt: new Date().toISOString(),
            device: navigator.userAgent,
            totalReports: reports.length,
            totalCodes: reports.reduce((sum, r) => sum + (r.codes ? r.codes.length : 0), 0)
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `отчеты_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        showSuccess(`Экспортировано ${reports.length} отчетов`);
        
    } catch (error) {
        console.error('Export error:', error);
        showError('Ошибка экспорта данных');
    }
}

// Импорт данных на текущее устройство
importReportsData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                if (data.reports && Array.isArray(data.reports)) {
                    // Сохраняем отчеты во все нужные хранилища
                    localStorage.setItem('warehouse_reports', JSON.stringify(data.reports));
                    localStorage.setItem('honest_sign_reports', JSON.stringify(data.reports));
                    
                    // Обновляем интерфейс
                    this.loadReports();
                    this.updateStatistics();
                    
                    showSuccess(`Импортировано ${data.reports.length} отчетов с ${data.device || 'устройства'}`);
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                console.error('Import error:', error);
                showError('Ошибка импорта: неверный формат файла');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

    // Диагностика хранилища
    debugStorage() {
        console.log('🐛 DEBUG STORAGE:');
        
        const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
        const appStateReports = JSON.parse(localStorage.getItem('honest_sign_reports') || '[]');
        
        console.log('📊 Warehouse reports:', warehouseReports.length);
        console.log('📊 AppState reports:', appStateReports.length);
        
        // Покажем ID всех отчетов
        const allIds = [
            ...warehouseReports.map(r => r.id),
            ...appStateReports.map(r => r.id)
        ];
        
        console.log('🔍 All report IDs:', [...new Set(allIds)]);
        
        showInfo(`Отчетов в системе: ${warehouseReports.length}`, 4000);
    }

    loadContractors() {
        const select = document.getElementById('contractorFilter');
        const contractors = appState.getContractors();
        
        contractors.forEach(contractor => {
            const option = document.createElement('option');
            option.value = contractor.id;
            option.textContent = contractor.name;
            select.appendChild(option);
        });
    }

    debugStorage() {
        console.log('🐛 DEBUG STORAGE ACROSS DEVICES:');
        
        const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
        const appStateReports = appState.getReports();
        const sentSessions = JSON.parse(localStorage.getItem('honest_sign_sent_sessions') || '[]');
        
        console.log('📱 Current device reports:');
        console.log('- warehouse_reports:', warehouseReports.length, 'reports');
        console.log('- appState reports:', appStateReports.length, 'reports'); 
        console.log('- sent_sessions:', sentSessions.length, 'sessions');
        
        // Покажем ID всех отчетов для сравнения
        const allIds = [
            ...warehouseReports.map(r => r.id),
            ...appStateReports.map(r => r.id),
            ...sentSessions.map(s => s.id)
        ];
        
        console.log('🔍 All report IDs on this device:', [...new Set(allIds)]);
        
        showInfo(`На этом устройстве: ${warehouseReports.length} отчетов (см. консоль)`, 4000);
    }
    
    loadReports() {
        try {
            // Загружаем отчеты из warehouse_reports как основной источник
            const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
            
            if (warehouseReports.length > 0) {
                console.log('📊 Loading reports from warehouse_reports:', warehouseReports.length);
                this.reports = warehouseReports;
            } else {
                // Fallback на appState если warehouse_reports пуст
                console.log('📊 Loading reports from appState (warehouse_reports empty)');
                this.reports = appState.getReports();
            }
            
            this.displayReports();
            this.updateStatistics();
            
        } catch (error) {
            console.error('❌ Error loading reports:', error);
            this.reports = appState.getReports();
            this.displayReports();
            this.updateStatistics();
        }
    }

    // Добавьте в AccountantManager
    syncDataSources() {
        console.log('🔄 Syncing data sources...');
        
        try {
            const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
            const appStateReports = appState.getReports();
            
            console.log('📊 Before sync:', {
                warehouse: warehouseReports.length,
                appState: appStateReports.length
            });
            
            // Если warehouse_reports пуст, но в appState есть данные - копируем
            if (warehouseReports.length === 0 && appStateReports.length > 0) {
                localStorage.setItem('warehouse_reports', JSON.stringify(appStateReports));
                console.log('✅ Copied appState reports to warehouse_reports');
            }
            // Если appState пуст, но в warehouse_reports есть данные - копируем
            else if (appStateReports.length === 0 && warehouseReports.length > 0) {
                appState.saveReports(warehouseReports);
                console.log('✅ Copied warehouse_reports to appState');
            }
            
            this.loadReports();
            showSuccess('Данные синхронизированы');
            
        } catch (error) {
            console.error('❌ Error syncing data:', error);
            showError('Ошибка синхронизации данных');
        }
    }

    displayReports() {
        const reportsList = document.getElementById('reportsList');
        const filteredReports = this.filterReports();

        if (filteredReports.length === 0) {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>Нет отчетов</p>
                    <small>Отчеты появятся здесь после сканирования на складе</small>
                </div>
            `;
            return;
        }

        reportsList.innerHTML = '';
        
        filteredReports.forEach(report => {
            const reportElement = this.createReportElement(report);
            reportsList.appendChild(reportElement);
        });
    }

    filterReports() {
        return this.reports.filter(report => {
            let matches = true;
            
            if (this.filters.date) {
                matches = matches && this.matchesDateFilter(report.createdAt, this.filters.date);
            }
            
            if (this.filters.contractor) {
                matches = matches && report.contractorId === parseInt(this.filters.contractor);
            }
            
            if (!this.filters.showProcessed) {
                matches = matches && report.status !== 'processed';
            }
            
            return matches;
        });
    }

    matchesDateFilter(reportDate, filter) {
        const date = new Date(reportDate);
        const today = new Date();
        
        switch (filter) {
            case 'today':
                return date.toDateString() === today.toDateString();
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                return date >= weekAgo;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(today.getMonth() - 1);
                return date >= monthAgo;
            default:
                return true;
        }
    }

    createReportElement(report) {
        const element = document.createElement('div');
        element.className = `report-item ${report.status === 'processed' ? 'report-processed' : ''}`;
        element.onclick = () => this.showReportDetails(report);
        
        const contractor = appState.getContractor(report.contractorId);
        const date = new Date(report.createdAt);
        
        element.innerHTML = `
            <div class="report-header">
                <div>
                    <h4 class="report-title">
                        Отчет #${report.id}
                        ${report.status === 'processed' ? '✅' : '🆕'}
                    </h4>
                    <p>${contractor ? contractor.name : 'Неизвестный контрагент'}</p>
                </div>
                <div>
                    <span class="badge ${report.status === 'processed' ? 'badge-success' : 'badge-primary'}">
                        ${report.codes.length} кодов
                    </span>
                    ${report.status === 'processed' ? '<div class="status-badge">ОБРАБОТАН</div>' : ''}
                </div>
            </div>
            <div class="report-meta">
                <div>
                    <strong>Дата:</strong> ${date.toLocaleDateString('ru-RU')}
                </div>
                <div>
                    <strong>Время:</strong> ${date.toLocaleTimeString('ru-RU')}
                </div>
            </div>
            <div class="report-actions">
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); accountantManager.downloadReport('${report.id}')">
                    📥 PDF
                </button>
                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); accountantManager.markAsProcessed('${report.id}')" 
                    ${report.status === 'processed' ? 'disabled' : ''}>
                    ✅ Обработано
                </button>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); accountantManager.deleteReport('${report.id}')">
                    🗑️ Удалить
                </button>
            </div>
        `;
        
        return element;
    }

    async markAsProcessed(reportId) {
        console.log('🔄 Marking report as processed:', reportId);
        
        const reportIndex = this.reports.findIndex(r => r.id == reportId);
        if (reportIndex === -1) {
            showError('Отчет не найден');
            return;
        }
    
        this.reports[reportIndex].status = 'processed';
        this.reports[reportIndex].processedAt = new Date().toISOString();
        
        appState.saveReports(this.reports);
        
        // ОБНОВЛЯЕМ ОТЧЕТ В СИСТЕМЕ СКЛАДА
        this.updateWarehouseReportStatus(reportId, 'processed');
        
        // ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ НА СКЛАД ОБ ОБРАБОТКЕ
        this.sendProcessingNotificationToWarehouse(reportId);
        
        showSuccess('✅ Отчет отмечен как обработанный');
        this.loadReports();
        this.updateStatistics(); // ДОБАВЬТЕ ЭТОТ ВЫЗОВ
        this.closeReportDetails();
    }
    
    // ДОБАВЬТЕ НОВЫЙ МЕТОД ДЛЯ ОБНОВЛЕНИЯ СТАТУСА НА СКЛАДЕ
    updateWarehouseReportStatus(reportId, status) {
        try {
            // Получаем отчеты склада из localStorage
            const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
            const warehouseReportIndex = warehouseReports.findIndex(r => r.id == reportId);
            
            if (warehouseReportIndex !== -1) {
                warehouseReports[warehouseReportIndex].status = status;
                if (status === 'processed') {
                    warehouseReports[warehouseReportIndex].processedAt = new Date().toISOString();
                }
                localStorage.setItem('warehouse_reports', JSON.stringify(warehouseReports));
                console.log('✅ Warehouse report status updated:', reportId, status);
            }
            
            // Также обновляем в appState если отчет там есть
            const appReports = appState.getReports();
            const appReportIndex = appReports.findIndex(r => r.id == reportId);
            if (appReportIndex !== -1) {
                appReports[appReportIndex].status = status;
                if (status === 'processed') {
                    appReports[appReportIndex].processedAt = new Date().toISOString();
                }
                appState.saveReports(appReports);
            }
            
        } catch (error) {
            console.error('❌ Error updating warehouse report status:', error);
        }
    }
    
    // ДОБАВЬТЕ НОВЫЙ МЕТОД
    sendProcessingNotificationToWarehouse(reportId) {
        const report = this.reports.find(r => r.id == reportId);
        if (!report) return;
    
        const notification = {
            id: 'processed_' + Date.now(),
            reportId: reportId,
            contractorName: report.contractorName,
            codeCount: report.codes.length,
            processedAt: new Date().toISOString(),
            message: `Отчет #${reportId} по контрагенту "${report.contractorName}" обработан бухгалтерией`,
            type: 'report_processed',
            read: false
        };
    
        const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
        notifications.unshift(notification);
        
        if (notifications.length > 50) {
            notifications.splice(50);
        }
        
        localStorage.setItem('warehouse_notifications', JSON.stringify(notifications));
        console.log('📧 Processing notification sent to warehouse:', notification);
    }
    
    loadReportsHistory() {
        const reports = this.notificationManager.getPendingReports();
        
        try {
            const reports = this.notificationManager.getPendingReports();
            const reportsList = document.getElementById('reportsList');
            
            if (!reportsList) {
                console.warn('❌ reportsList element not found');
                return;
            }
            
            // ПРОВЕРЯЕМ ЧТО reports - МАССИВ
            if (!reports || !Array.isArray(reports)) {
                console.warn('⚠️ No reports found or reports is not array');
                reportsList.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📄</span>
                        <p>Нет отправленных отчетов</p>
                        <small>Созданные отчеты появятся здесь</small>
                    </div>
                `;
                return;
            }
            
            if (reports.length === 0) {
                reportsList.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📄</span>
                        <p>Нет отправленных отчетов</p>
                        <small>Созданные отчеты появятся здесь</small>
                    </div>
                `;
                return;
            }
            
            // БЕЗОПАСНО ИСПОЛЬЗУЕМ slice
            reportsList.innerHTML = reports.map(report => {
                // ПРОВЕРЯЕМ ЧТО У ОТЧЕТА ЕСТЬ ID
                const reportId = report.id || 'unknown';
                const shortId = reportId.slice ? reportId.slice(-6) : reportId;
                
                return `
                    <div class="report-item ${report.status || 'pending'}">
                        <div class="report-header">
                            <div class="report-title">
                                Отчет #${shortId}
                                ${report.status === 'deleted' ? '🗑️' : report.status === 'processed' ? '✅' : '🆕'}
                            </div>
                            <span class="report-status status-${report.status || 'pending'}">
                                ${report.status === 'pending' ? '⏳ Ожидает' : 
                                  report.status === 'processed' ? '✅ Обработан' : 
                                  report.status === 'deleted' ? '🗑️ Удален' : '❓ Неизвестно'}
                            </span>
                        </div>
                        <div class="report-details">
                            <div>Контрагент: ${report.contractorName || 'Неизвестно'}</div>
                            <div>Кодов: ${report.codes ? report.codes.length : 0}</div>
                            <div>Отправлен: ${new Date(report.submittedAt || report.createdAt || Date.now()).toLocaleString('ru-RU')}</div>
                            ${report.status === 'processed' && report.processedAt ? 
                                `<div>Обработан: ${new Date(report.processedAt).toLocaleString('ru-RU')}</div>` : 
                            report.status === 'deleted' && report.deletedAt ?
                                `<div>Удален: ${new Date(report.deletedAt).toLocaleString('ru-RU')}</div>` :
                                '<div>Ожидает обработки бухгалтерией</div>'
                            }
                        </div>
                        <div class="report-actions">
                            ${(report.status === 'pending' || !report.status) ? `
                                <button class="btn btn-sm btn-outline" onclick="window.scannerManager.downloadWarehouseReport('${reportId}')">
                                    📥 PDF
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="window.scannerManager.deleteWarehouseReport('${reportId}')">
                                    🗑️ Удалить
                                </button>
                            ` : ''}
                            ${report.status === 'deleted' ? `
                                <button class="btn btn-sm btn-danger" onclick="window.scannerManager.removeDeletedReport('${reportId}')">
                                    🗑️ Удалить локально
                                </button>
                            ` : ''}
                            ${report.status === 'processed' ? `
                                <button class="btn btn-sm btn-outline" onclick="window.scannerManager.downloadWarehouseReport('${reportId}')">
                                    📥 PDF
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('❌ Error loading reports history:', error);
            const reportsList = document.getElementById('reportsList');
            if (reportsList) {
                reportsList.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">❌</span>
                        <p>Ошибка загрузки отчетов</p>
                        <small>${error.message}</small>
                    </div>
                `;
            }
        }
        reportsList.innerHTML = reports.map(report => `
        <div class="report-item ${report.status}">
            <div class="report-header">
                <div class="report-title">
                    Отчет #${report.sequentialNumber || report.id.slice(-6)}
                    ${report.status === 'deleted' ? '🗑️' : report.status === 'processed' ? '✅' : '🆕'}
                </div>
                <span class="report-status status-${report.status}">
                    ${report.status === 'pending' ? '⏳ Ожидает' : 
                      report.status === 'processed' ? '✅ Обработан' : 
                      report.status === 'deleted' ? '🗑️ Удален' : '❓ Неизвестно'}
                </span>
            </div>
            <div class="report-details">
                <div>Порядковый №: ${report.sequentialNumber || 'N/A'}</div>
                <div>Контрагенты: ${report.contractors ? report.contractors.map(c => c.name).join(', ') : report.contractorName}</div>
                <div>Кодов: ${report.codes.length}</div>
                <div>Создан: ${new Date(report.submittedAt || report.createdAt).toLocaleString('ru-RU')}</div>
                ${report.status === 'processed' && report.processedAt ? 
                    `<div>Обработан: ${new Date(report.processedAt).toLocaleString('ru-RU')}</div>` : 
                report.status === 'deleted' && report.deletedAt ?
                    `<div>Удален: ${new Date(report.deletedAt).toLocaleString('ru-RU')}</div>` :
                    '<div>Ожидает обработки бухгалтерией</div>'
                }
            </div>
            <div class="report-actions">
                <!-- существующие кнопки -->
            </div>
        </div>
    `).join('');
    }

    sendNotificationToWarehouse(reportId) {
        const report = this.reports.find(r => r.id == reportId);
        if (!report) return;

        const notification = {
            id: 'notif_' + Date.now(),
            reportId: reportId,
            contractorName: report.contractorName,
            codeCount: report.codes.length,
            processedAt: new Date().toISOString(),
            message: `Отчет #${reportId} по контрагенту "${report.contractorName}" обработан бухгалтерией`,
            read: false
        };

        const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
        notifications.unshift(notification);
        
        if (notifications.length > 50) {
            notifications.splice(50);
        }
        
        localStorage.setItem('warehouse_notifications', JSON.stringify(notifications));
        console.log('📧 Notification sent to warehouse:', notification);
    }

    async downloadReport(reportId) {
        console.log('📥 Downloading report:', reportId);
        
        const report = this.reports.find(r => r.id == reportId);
        if (!report) {
            showError('Отчет не найден');
            return;
        }

        try {
            const pdfBytes = await this.pdfGenerator.generateReport(report);
            const filename = `отчет_${report.contractorName}_${report.id}.pdf`.replace(/[^a-zA-Z0-9_]/g, '_');
            const success = this.pdfGenerator.downloadPDF(pdfBytes, filename);
            
            if (success) {
                showSuccess('PDF отчет скачан');
            } else {
                throw new Error('PDF download failed');
            }
        } catch (error) {
            console.error('Download error:', error);
            showError('Ошибка скачивания отчета');
        }
    }

    deleteReport(reportId) {
        if (confirm('ВНИМАНИЕ! Вы уверены, что хотите удалить этот отчет? Это действие нельзя отменить.')) {
            this.reports = this.reports.filter(r => r.id != reportId);
            appState.saveReports(this.reports);
            
            // ОБНОВЛЯЕМ СТАТУС В СИСТЕМЕ СКЛАДА
            this.updateWarehouseReportStatus(reportId, 'deleted');
            
            // ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ НА СКЛАД ОБ УДАЛЕНИИ
            this.sendDeleteNotificationToWarehouse(reportId);
            
            this.loadReports();
            this.updateStatistics(); // ДОБАВЬТЕ ЭТОТ ВЫЗОВ
            this.closeReportDetails();
            showWarning('Отчет удален');
        }
    }
    
    // Добавьте этот метод в класс AccountantManager
    updateStatistics() {
        try {
            // Получаем отчеты ИЗ ПРАВИЛЬНОГО ИСТОЧНИКА - warehouse_reports
            const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
            const appStateReports = this.reports;
            
            console.log('📊 Statistics sources:', {
                warehouseReports: warehouseReports.length,
                appStateReports: appStateReports.length
            });
            
            // Используем warehouse_reports как основной источник
            const reportsToCount = warehouseReports.length > 0 ? warehouseReports : appStateReports;
            
            const totalReports = reportsToCount.length;
            const pendingReports = reportsToCount.filter(r => r.status !== 'processed').length;
            const processedReports = reportsToCount.filter(r => r.status === 'processed').length;
            
            // Считаем общее количество кодов
            const totalCodes = reportsToCount.reduce((sum, report) => {
                return sum + (report.codes ? report.codes.length : 0);
            }, 0);
            
            // Обновляем DOM элементы
            const totalEl = document.getElementById('totalReportsCount');
            const pendingEl = document.getElementById('pendingReportsCount');
            const processedEl = document.getElementById('processedReportsCount');
            const codesEl = document.getElementById('totalCodesCount');
            
            if (totalEl) totalEl.textContent = totalReports;
            if (pendingEl) pendingEl.textContent = pendingReports;
            if (processedEl) processedEl.textContent = processedReports;
            if (codesEl) codesEl.textContent = totalCodes;
            
            console.log('📊 Statistics updated from warehouse_reports:', {
                totalReports,
                pendingReports,
                processedReports,
                totalCodes
            });
            
        } catch (error) {
            console.error('❌ Error updating statistics:', error);
            
            // Fallback: используем старый метод если новый не работает
            try {
                const reports = this.reports;
                const totalReports = reports.length;
                const pendingReports = reports.filter(r => r.status !== 'processed').length;
                const processedReports = reports.filter(r => r.status === 'processed').length;
                const totalCodes = reports.reduce((sum, report) => sum + (report.codes ? report.codes.length : 0), 0);
                
                document.getElementById('totalReportsCount').textContent = totalReports;
                document.getElementById('pendingReportsCount').textContent = pendingReports;
                document.getElementById('processedReportsCount').textContent = processedReports;
                document.getElementById('totalCodesCount').textContent = totalCodes;
                
                console.log('📊 Statistics updated from appState (fallback)');
            } catch (fallbackError) {
                console.error('❌ Fallback statistics also failed:', fallbackError);
            }
        }
    }

    sendDeleteNotificationToWarehouse(reportId) {
        const report = this.reports.find(r => r.id == reportId);
        if (!report) return;
    
        const notification = {
            id: 'delete_' + Date.now(),
            reportId: reportId,
            contractorName: report.contractorName,
            codeCount: report.codes.length,
            deletedAt: new Date().toISOString(),
            message: `Отчет #${reportId} по контрагенту "${report.contractorName}" удален бухгалтерией`,
            type: 'deleted',
            read: false
        };
    
        const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
        notifications.unshift(notification);
        
        if (notifications.length > 50) {
            notifications.splice(50);
        }
        
        localStorage.setItem('warehouse_notifications', JSON.stringify(notifications));
        console.log('📧 Delete notification sent to warehouse:', notification);
    }

    showReportDetails(report) {
        const details = document.getElementById('reportDetails');
        const content = document.getElementById('reportContent');
        
        const contractor = appState.getContractor(report.contractorId);
        const date = new Date(report.createdAt);
        
        content.innerHTML = `
            <div class="report-info">
                <div class="status-item">
                    <span class="label">Контрагент:</span>
                    <span>${contractor ? contractor.name : 'Неизвестный'}</span>
                </div>
                <div class="status-item">
                    <span class="label">ID отчета:</span>
                    <span>${report.id}</span>
                </div>
                <div class="status-item">
                    <span class="label">Дата создания:</span>
                    <span>${date.toLocaleString('ru-RU')}</span>
                </div>
                <div class="status-item">
                    <span class="label">Статус:</span>
                    <span class="badge ${report.status === 'processed' ? 'badge-success' : 'badge-warning'}">
                        ${report.status === 'processed' ? '✅ ОБРАБОТАН' : '🆕 НОВЫЙ'}
                    </span>
                </div>
                ${report.processedAt ? `
                <div class="status-item">
                    <span class="label">Обработан:</span>
                    <span>${new Date(report.processedAt).toLocaleString('ru-RU')}</span>
                </div>
                ` : ''}
            </div>
            
            <h4>Список кодов (${report.codes.length}):</h4>
            <div class="codes-list" style="max-height: 300px;">
                ${report.codes.map((scannedCode, index) => `
                    <div class="code-item">
                        <div class="code-info">
                            <div class="code-value">${scannedCode.code}</div>
                            <div class="code-time">${new Date(scannedCode.timestamp).toLocaleTimeString()}</div>
                        </div>
                        <div class="code-actions">
                            <button class="btn btn-sm btn-outline" onclick="accountantManager.copyCode('${scannedCode.code}')">
                                📋 Копировать
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="actions-grid" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="accountantManager.downloadReport('${report.id}')">
                    📥 Скачать PDF
                </button>
                <button class="btn btn-success" onclick="accountantManager.markAsProcessed('${report.id}')" 
                    ${report.status === 'processed' ? 'disabled' : ''}>
                    ✅ Отметить как обработанный
                </button>
                <button class="btn btn-danger" onclick="accountantManager.deleteReport('${report.id}')">
                    🗑️ Удалить отчет
                </button>
            </div>
        `;
        
        details.classList.remove('hidden');
    }

    closeReportDetails() {
        document.getElementById('reportDetails').classList.add('hidden');
    }

    copyCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            showSuccess('Код скопирован в буфер обмена');
        }).catch(err => {
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showSuccess('Код скопирован');
        });
    }

    attachEventListeners() {
        document.getElementById('dateFilter').addEventListener('change', (e) => {
            this.filters.date = e.target.value;
        });
    
        document.getElementById('contractorFilter').addEventListener('change', (e) => {
            this.filters.contractor = e.target.value;
        });
    
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.loadReports();
        });
    
        document.getElementById('clearFilters').addEventListener('click', () => {
            this.filters = { date: '', contractor: '', showProcessed: false };
            document.getElementById('dateFilter').value = '';
            document.getElementById('contractorFilter').value = '';
            this.loadReports();
        });
    
        document.getElementById('refreshReports').addEventListener('click', () => {
            this.loadReports();
            this.updateStatistics(); // ДОБАВЬТЕ ЭТОТ ВЫЗОВ
            showInfo('Список обновлен');
        });
    
        const toggleProcessedBtn = document.getElementById('toggleProcessed');
        if (toggleProcessedBtn) {
            toggleProcessedBtn.addEventListener('click', () => {
                this.filters.showProcessed = !this.filters.showProcessed;
                toggleProcessedBtn.textContent = this.filters.showProcessed ? 
                    '👁️ Скрыть обработанные' : '👁️ Показать все';
                this.loadReports();
            });
        }
    }
}

let accountantManager;
document.addEventListener('DOMContentLoaded', () => {
    accountantManager = new AccountantManager();
});