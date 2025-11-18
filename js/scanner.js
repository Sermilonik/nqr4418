class ScannerManager {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.currentContractor = null;
        this.selectedContractors = [];
        this.allContractors = [];
        this.pdfGenerator = new PDFGenerator();
        this.notificationManager = new NotificationManager();
        
        // Сохраняем глобальную ссылку
        window.scannerManager = this;
        
        this.init();
    }

    init() {
        console.log('🚀 Инициализация ScannerManager');
        
        this.loadContractors();
        this.attachEventListeners();
        this.checkExistingSession();
        this.checkNotifications();
    
        // Автоматическая синхронизация при загрузке
        setTimeout(() => {
            if (window.syncManager) {
                syncManager.autoSync();
            }
        }, 2000);
    
        showSuccess('Складской модуль готов к работе', 3000);
    }
    
    // ПОКАЗ КНОПКИ РАЗРЕШЕНИЯ ДЛЯ CHROME
    showChromePermissionButton() {
        const permissionBtn = document.getElementById('requestCameraPermission');
        if (permissionBtn) {
            permissionBtn.classList.remove('hidden');
            
            permissionBtn.addEventListener('click', async () => {
                try {
                    // ЗАПРАШИВАЕМ РАЗРЕШЕНИЕ ПРОСТЫМ ЗАПРОСОМ
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    
                    // ОСТАНАВЛИВАЕМ ПОТОК
                    stream.getTracks().forEach(track => track.stop());
                    
                    showSuccess('✅ Доступ к камере разрешен! Теперь попробуйте запустить камеру.', 5000);
                    permissionBtn.classList.add('hidden');
                    
                } catch (error) {
                    showError('❌ Не удалось получить разрешение: ' + error.message);
                }
            });
        }
    }

    // Добавьте этот метод в класс ScannerManager
    forceCleanReports() {
        console.log('🧹 FORCE CLEANING ALL REPORTS');
    
        if (confirm('ВНИМАНИЕ! Это удалит ВСЕ отчеты из системы (склад + бухгалтерия). Продолжить?')) {
            try {
                // Очищаем все хранилища отчетов
                localStorage.removeItem('warehouse_reports');
                localStorage.removeItem('honest_sign_reports');
                localStorage.removeItem('honest_sign_sent_sessions');
            
                // Очищаем уведомления
                localStorage.removeItem('warehouse_notifications');
            
                // Очищаем текущую сессию
                appState.clearCurrentSession();
                this.selectedContractors = [];
                localStorage.removeItem('honest_sign_selected_contractors');
            
                // Обновляем интерфейс
                this.loadReportsHistory();
                this.updateSelectedContractorsUI();
                this.updateUI();
                this.updateButtonStates();
            
                showSuccess('🧹 Все отчеты и данные очищены', 5000);
            
            } catch (error) {
                console.error('❌ Error during force clean:', error);
                showError('Ошибка при очистке данных');
            }
        }
    }

    // Добавьте метод для просмотра всех отчетов в системе
    debugReports() {
        console.log('🐛 DEBUG ALL REPORTS:');
    
        const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
        const appStateReports = appState.getReports();
        const sentSessions = JSON.parse(localStorage.getItem('honest_sign_sent_sessions') || '[]');
    
        console.log('📋 Warehouse reports:', warehouseReports);
        console.log('📋 AppState reports:', appStateReports);
        console.log('📋 Sent sessions:', sentSessions);
    
        // Показываем ID всех отчетов
        const allReportIds = [
            ...warehouseReports.map(r => r.id),
            ...appStateReports.map(r => r.id),
            ...sentSessions.map(s => s.id)
        ];
    
        console.log('🔍 All report IDs:', [...new Set(allReportIds)]);
    
        showInfo(`Отчетов в системе: ${allReportIds.length} (см. консоль)`, 3000);
    }

    createTestSession() {
        // Создаем тестовую сессию
        const contractor = appState.getContractor(1); // Первый контрагент
        if (contractor) {
            this.selectContractor(contractor);
            
            // Добавляем тестовые коды
            const testCodes = ['0104604063405720219NQNfSwVmcTEST001', '0104604063405720219NQNfSwVmdTEST002'];
            testCodes.forEach(code => {
                appState.addScannedCode(code);
            });
            
            this.updateUI();
            console.log('✅ Test session created');
            showSuccess('Тестовая сессия создана', 3000);
        }
    }
    
    debugSession() {
        console.log('=== SESSION DEBUG ===');
        console.log('Current contractor:', this.currentContractor);
        console.log('Current session:', appState.getCurrentSession());
        console.log('Contractor select value:', document.getElementById('contractorSelect').value);
        console.log('localStorage session:', localStorage.getItem('honest_sign_current_session'));
        console.log('All contractors:', appState.getContractors());
        console.log('=====================');
    } 
      
    loadReportsHistory() {
        try {
            const reports = this.notificationManager.getPendingReports();
            const reportsList = document.getElementById('reportsList');
            
            if (!reportsList) {
                console.warn('❌ reportsList element not found');
                return;
            }
            
            if (!reports || !Array.isArray(reports) || reports.length === 0) {
                reportsList.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📄</span>
                        <p>Нет отправленных отчетов</p>
                        <small>Созданные отчеты появятся здесь</small>
                    </div>
                `;
                return;
            }
            
            // СОРТИРУЕМ ОТЧЕТЫ: сначала необработанные, потом обработанные
            const sortedReports = [...reports].sort((a, b) => {
                if (a.status === 'processed' && b.status !== 'processed') return 1;
                if (a.status !== 'processed' && b.status === 'processed') return -1;
                return new Date(b.createdAt || b.submittedAt) - new Date(a.createdAt || a.submittedAt);
            });
            
            reportsList.innerHTML = sortedReports.map(report => {
                const reportId = report.id || 'unknown';
                const shortId = reportId.slice ? reportId.slice(-6) : reportId;
                const sequentialNumber = report.sequentialNumber || 'N/A';
                
                let contractorName = 'Неизвестно';
                if (report.contractors && Array.isArray(report.contractors)) {
                    contractorName = report.contractors.map(c => c.name).join(', ');
                } else if (report.contractorName) {
                    contractorName = report.contractorName;
                }
                
                return `
                    <div class="report-item ${report.status || 'pending'}">
                        <div class="report-header">
                            <div class="report-title">
                                Отчет #${sequentialNumber}
                                ${report.status === 'processed' ? '✅' : '🆕'}
                            </div>
                            <span class="report-status status-${report.status || 'pending'}">
                                ${report.status === 'pending' ? '⏳ Ожидает' : 
                                  report.status === 'processed' ? '✅ Обработан' : 
                                  report.status === 'deleted' ? '🗑️ Удален' : '❓ Неизвестно'}
                            </span>
                        </div>
                        <div class="report-details">
                            <div>Порядковый №: ${sequentialNumber}</div>
                            <div>Контрагенты: ${contractorName}</div>
                            <div>Кодов: ${report.codes ? report.codes.length : 0}</div>
                            <div>Создан: ${new Date(report.submittedAt || report.createdAt || Date.now()).toLocaleString('ru-RU')}</div>
                            ${report.status === 'processed' && report.processedAt ? 
                                `<div>Обработан: ${new Date(report.processedAt).toLocaleString('ru-RU')}</div>` : 
                            report.status === 'deleted' && report.deletedAt ?
                                `<div>Удален: ${new Date(report.deletedAt).toLocaleString('ru-RU')}</div>` :
                                '<div>Ожидает обработки бухгалтерией</div>'
                            }
                        </div>
                        <div class="report-actions">
                            <button class="btn btn-sm btn-outline" onclick="window.scannerManager.downloadWarehouseReport('${reportId}')">
                                📥 PDF
                            </button>
                            ${(report.status === 'pending' || !report.status) ? `
                                <button class="btn btn-sm btn-danger" onclick="window.scannerManager.deleteWarehouseReport('${reportId}')">
                                    🗑️ Удалить
                                </button>
                            ` : ''}
                            ${report.status === 'deleted' ? `
                                <button class="btn btn-sm btn-danger" onclick="window.scannerManager.removeDeletedReport('${reportId}')">
                                    🗑️ Удалить локально
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
    }

    removeDeletedReport(reportId) {
        console.log('🗑️ Removing deleted report:', reportId);
    
        // Удаляем из локального хранилища склада
        const reports = appState.getReports();
        const updatedReports = reports.filter(r => r.id !== reportId);
        appState.saveReports(updatedReports);
    
        // Обновляем интерфейс
        this.loadReportsHistory();
    
        showWarning(`Отчет #${reportId} удален по запросу бухгалтерии`, 4000);
    }

    // Удаление уведомлений
    markNotificationRead(notificationId) {
        const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
        const notificationIndex = notifications.findIndex(n => n.id === notificationId);
        
        if (notificationIndex !== -1) {
            const notification = notifications[notificationIndex];
            
            // ОБРАБАТЫВАЕМ РАЗНЫЕ ТИПЫ УВЕДОМЛЕНИЙ
            if (notification.type === 'deleted') {
                this.removeDeletedReport(notification.reportId);
            } else if (notification.type === 'report_processed') {
                this.removeProcessedReport(notification.reportId);
            }
            
            notifications[notificationIndex].read = true;
            localStorage.setItem('warehouse_notifications', JSON.stringify(notifications));
            this.checkNotifications();
            this.showNotifications();
            showSuccess('Уведомление обработано', 2000);
        }
    }

    removeProcessedReport(reportId) {
        console.log('✅ Removing processed report:', reportId);
    
        // Удаляем из локального хранилища склада
        const reports = appState.getReports();
        const updatedReports = reports.filter(r => r.id !== reportId);
        appState.saveReports(updatedReports);
    
        // Также удаляем из системы уведомлений
        const pendingReports = this.notificationManager.getPendingReports();
        const updatedPendingReports = pendingReports.filter(r => r.id !== reportId);
        localStorage.setItem('warehouse_reports', JSON.stringify(updatedPendingReports));
    
        // Обновляем интерфейс
        this.loadReportsHistory();
    
        showSuccess(`Отчет #${reportId} удален (обработан бухгалтерией)`, 4000);
    }

    deleteWarehouseReport(reportId) {
        if (confirm('Вы уверены, что хотите удалить этот отчет? Отчет будет удален только из системы склада.')) {
            console.log('🗑️ Deleting warehouse report:', reportId);
        
            // Удаляем из локального хранилища склада
            const reports = appState.getReports();
            const updatedReports = reports.filter(r => r.id !== reportId);
            appState.saveReports(updatedReports);
        
            // Также удаляем из системы уведомлений если там есть
            const pendingReports = this.notificationManager.getPendingReports();
            const updatedPendingReports = pendingReports.filter(r => r.id !== reportId);
            localStorage.setItem('warehouse_reports', JSON.stringify(updatedPendingReports));
        
            // Обновляем интерфейс
            this.loadReportsHistory();
        
            showSuccess(`Отчет #${reportId} удален`, 3000);
        }
    }

    attachDropdownClickHandlers() {
        const dropdown = document.getElementById('contractorDropdown');
        console.log('🎯 attachDropdownClickHandlers CALLED, dropdown:', dropdown);
        
        if (!dropdown) {
            console.error('❌ Dropdown element not found');
            return;
        }
    
        // Удаляем старые обработчики
        dropdown.removeEventListener('click', this.handleDropdownClick);
        dropdown.removeEventListener('touchend', this.handleDropdownClick);
        
        // Создаем новый обработчик
        this.handleDropdownClick = (e) => {
            console.log('🎯 Dropdown CLICK event:', e.type);
            console.log('🎯 Click target:', e.target);
            console.log('🎯 Current target:', e.currentTarget);
            
            const item = e.target.closest('.dropdown-item');
            console.log('🎯 Found dropdown item:', item);
            
            if (item && !item.classList.contains('no-results')) {
                const contractorId = item.getAttribute('data-contractor-id');
                console.log('🎯 Contractor ID from data attribute:', contractorId);
                
                if (contractorId) {
                    console.log('✅ Calling toggleContractor with ID:', contractorId);
                    this.toggleContractor(parseInt(contractorId));
                } else {
                    console.error('❌ No contractor ID found in data attribute');
                }
            } else {
                console.log('❌ No valid dropdown item found or it\'s no-results');
            }
        };
        
        // Добавляем обработчики
        dropdown.addEventListener('click', this.handleDropdownClick);
        dropdown.addEventListener('touchend', this.handleDropdownClick);
        
        console.log('✅ Dropdown click handlers attached');
    }

    // Управление контрагентами
    showContractorManager() {
        const modal = document.getElementById('contractorManager');
        modal.classList.remove('hidden');
        this.loadContractorsManagerList();
    }

    hideContractorManager() {
        const modal = document.getElementById('contractorManager');
        modal.classList.add('hidden'); // БЫЛО remove, ДОЛЖНО БЫТЬ add
        // Перезагружаем список контрагентов для выбора
        this.loadContractors();
        this.filterContractors('');
    }

    loadContractorsManagerList() {
        const list = document.getElementById('contractorsManagerList');
        const totalCount = document.getElementById('totalContractors');
        const loadedCount = document.getElementById('loadedContractors');
        
        if (!list) return;
        
        const contractors = appState.getContractors();
        totalCount.textContent = contractors.length;
        loadedCount.textContent = contractors.length;
        
        list.innerHTML = contractors.map(contractor => `
            <div class="contractor-manager-item">
                <div class="contractor-info">
                    <strong>${contractor.name}</strong>
                    <span class="contractor-category">${contractor.category}</span>
                    <small>ID: ${contractor.id} • Создан: ${new Date(contractor.createdAt).toLocaleDateString()}</small>
                </div>
                <div class="contractor-actions">
                    <button class="btn btn-sm btn-outline" onclick="scannerManager.editContractor(${contractor.id})">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="scannerManager.deleteContractor(${contractor.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    showAddContractorForm() {
        document.getElementById('addContractorForm').classList.remove('hidden');
        document.getElementById('importForm').classList.add('hidden');
    }

    hideAddContractorForm() {
        document.getElementById('addContractorForm').classList.add('hidden');
        // Очищаем поля
        document.getElementById('contractorName').value = '';
        document.getElementById('contractorCategory').value = '';
    }

    addContractor() {
        const name = document.getElementById('contractorName').value.trim();
        const category = document.getElementById('contractorCategory').value.trim() || 'Партнер';
        
        if (!name) {
            showError('Введите название контрагента');
            return;
        }
        
        try {
            const contractor = appState.addContractor(name, category);
            this.loadContractorsManagerList();
            this.hideAddContractorForm();
            this.loadContractors(); // Перезагружаем для выбора
            showSuccess(`Контрагент "${name}" добавлен`);
        } catch (error) {
            showError('Ошибка при добавлении контрагента');
        }
    }

    deleteContractor(contractorId) {
        if (confirm('Вы уверены, что хотите удалить этого контрагента?')) {
            appState.deleteContractor(contractorId);
            this.loadContractorsManagerList();
            this.loadContractors(); // Перезагружаем для выбора
            showWarning('Контрагент удален');
        }
    }

    removeContractor(contractorId) {
        console.log('🗑️ Removing contractor:', contractorId);
        
        if (!this.selectedContractors) {
            this.selectedContractors = [];
        }
        
        this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
        this.updateSelectedContractorsUI();
        this.updateButtonStates(); // ДОБАВЬТЕ ЭТОТ ВЫЗОВ
        
        // СОХРАНЯЕМ обновленный список контрагентов
        const selectedContractorsData = {
            contractorIds: this.selectedContractors.map(c => c.id),
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('honest_sign_selected_contractors', JSON.stringify(selectedContractorsData));
        
        // Обновляем dropdown
        const searchInput = document.getElementById('contractorSearch');
        if (searchInput) {
            this.filterContractors(searchInput.value);
        }
        
        console.log('✅ Contractor removed, remaining:', this.selectedContractors.length);
    }

    showImportForm() {
        document.getElementById('importForm').classList.remove('hidden');
        document.getElementById('addContractorForm').classList.add('hidden');
    }

    hideImportForm() {
        document.getElementById('importForm').classList.add('hidden');
        document.getElementById('importData').value = '';
    }

    importContractors() {
        const csvData = document.getElementById('importData').value.trim();
        
        if (!csvData) {
            showError('Введите данные для импорта');
            return;
        }
        
        try {
            const imported = appState.importContractorsFromCSV(csvData);
            this.loadContractorsManagerList();
            this.hideImportForm();
            this.loadContractors(); // Перезагружаем для выбора
            showSuccess(`Импортировано ${imported.length} контрагентов`);
        } catch (error) {
            showError(error.message);
        }
    }

    exportContractors() {
        const csv = appState.exportContractorsToCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `контрагенты_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showSuccess('Контрагенты экспортированы в CSV');
    }

    filterContractorsList() {
        const query = document.getElementById('managerSearch').value.toLowerCase();
        const items = document.querySelectorAll('.contractor-manager-item');
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? 'flex' : 'none';
        });
    }

    loadContractors() {
        try {
            this.allContractors = appState.getContractors();
            console.log('✅ Contractors loaded:', this.allContractors);
            
            // Проверяем что контрагенты есть
            if (this.allContractors.length === 0) {
                console.warn('⚠️ No contractors found, loading defaults');
                this.loadDefaultContractors();
            }
            
            // Инициализируем поиск
            this.initContractorSearch();
            
        } catch (error) {
            console.error('❌ Error loading contractors:', error);
            this.loadDefaultContractors();
        }
    }
    
    attachEventListeners() {
        console.log('🔧 Attaching event listeners');
        
        // Обработчики для камеры и сканирования
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera());
        document.getElementById('showSimulator').addEventListener('click', () => this.showSimulator());
        document.getElementById('generateReport').addEventListener('click', () => this.generateReport());
        document.getElementById('clearSession').addEventListener('click', () => this.clearSession());
        document.getElementById('showNotifications').addEventListener('click', () => this.showNotifications());
        
        // Обработчики для управления отчетами
        const deleteAllBtn = document.getElementById('deleteAllPending');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => this.deleteAllPendingReports());
        }
        
        const refreshBtn = document.getElementById('refreshReports');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadReportsHistory());
        }
        
        console.log('✅ Event listeners attached');
    }

    processAutoNotifications() {
        console.log('🔍 Checking auto-notifications');
        
        try {
            const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
            const unreadNotifications = notifications.filter(n => !n.read);
            
            console.log('📧 Unread notifications:', unreadNotifications.length);
            
            // Пока просто логируем, функционал добавим позже
            if (unreadNotifications.length > 0) {
                console.log('📬 New notifications found:', unreadNotifications);
            }
            
        } catch (error) {
            console.error('❌ Error processing auto-notifications:', error);
        }
    }

    // ДОБАВЬТЕ МЕТОД ДЛЯ ЗАГРУЗКИ СТАНДАРТНЫХ КОНТРАГЕНТОВ
    loadDefaultContractors() {
        const defaultContractors = [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель' },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть' },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер' },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер' },
            { id: 5, name: 'ООО "Луч Саяны"', category: 'Дилер' },
            { id: 6, name: 'АО "Луч Восток"', category: 'Партнер' },
            { id: 7, name: 'ИП Лучистый', category: 'Розничная сеть' }
        ];
        
        // Добавляем только если их нет в appState
        defaultContractors.forEach(contractor => {
            if (!appState.getContractor(contractor.id)) {
                appState.contractors.push(contractor);
            }
        });
        
        appState.saveContractors();
        this.allContractors = appState.getContractors();
        console.log('✅ Default contractors loaded:', this.allContractors);
    }

    // Метод массового удаления
    deleteAllPendingReports() {
        const reports = this.notificationManager.getPendingReports();
        const pendingReports = reports.filter(r => r.status === 'pending');
    
        if (pendingReports.length === 0) {
            showInfo('Нет необработанных отчетов для удаления');
            return;
        }
    
        if (confirm(`ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ необработанные отчеты (${pendingReports.length} шт.)?`)) {
            const updatedReports = reports.filter(r => r.status !== 'pending');
            localStorage.setItem('warehouse_reports', JSON.stringify(updatedReports));
        
            // Также удаляем из appState
            const appReports = appState.getReports();
            const updatedAppReports = appReports.filter(appReport => 
                !pendingReports.some(pending => pending.id === appReport.id)
            );
            appState.saveReports(updatedAppReports);
        
            this.loadReportsHistory();
            showSuccess(`Удалено ${pendingReports.length} необработанных отчетов`, 4000);
        }
    }

    async downloadWarehouseReport(reportId) {
        console.log('📥 Downloading warehouse report:', reportId);
    
        const reports = this.notificationManager.getPendingReports();
        const report = reports.find(r => r.id === reportId);
    
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

    // Метод инициализации поиска
    initContractorSearch() {
        const searchInput = document.getElementById('contractorSearch');
        const dropdown = document.getElementById('contractorDropdown');
        
        if (!searchInput || !dropdown) {
            console.error('❌ Search elements not found');
            return;
        }
        
        console.log('🔍 Initializing mobile-friendly contractor search');
        
        // Улучшенное поведение для мобильных
        searchInput.addEventListener('focus', () => {
            console.log('📱 Search input focused on mobile');
            const query = searchInput.value.trim();
            this.filterContractors(query || '');
            this.showDropdown();
        });
        
        // Поиск при вводе с оптимизацией для мобильных
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                console.log('📱 Mobile search for:', query);
                this.filterContractors(query);
                if (query) {
                    this.showDropdown();
                }
            }, 300); // Увеличили задержку для мобильных
        });
        
        // Закрытие при клике вне (работает и на мобильных)
        document.addEventListener('touchstart', (e) => {
            if (!dropdown.contains(e.target) && e.target !== searchInput) {
                this.hideDropdown();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== searchInput) {
                this.hideDropdown();
            }
        });
        
        // Закрытие при скролле на мобильных
        document.addEventListener('scroll', () => {
            this.hideDropdown();
        }, { passive: true });
    
        this.attachDropdownClickHandlers();
        console.log('✅ Mobile contractor search initialized');
    }

    // Добавьте в ScannerManager для отладки
    testTouchEvents() {
        console.log('📱 Testing touch events...');
        const dropdown = document.getElementById('contractorDropdown');
        
        if (dropdown) {
            dropdown.addEventListener('touchstart', (e) => {
                console.log('✅ touchstart fired');
            }, { passive: true });
            
            dropdown.addEventListener('touchend', (e) => {
                console.log('✅ touchend fired');
            }, { passive: true });
            
            dropdown.addEventListener('click', (e) => {
                console.log('✅ click fired');
            });
        }
        
        showInfo('Тест touch-событий запущен. Смотрите консоль.', 3000);
    }

    // Метод фильтрации
    filterContractors(query = '') {
        const dropdown = document.getElementById('contractorDropdown');
        const searchInput = document.getElementById('contractorSearch');
        
        if (!dropdown || !searchInput) return;
    
        console.log('🔍 Фильтрация по запросу:', query);
    
        let filteredContractors = this.allContractors;
        
        if (query && query.trim() !== '') {
            const searchTerm = query.trim().toLowerCase();
            console.log('🎯 Ищем:', searchTerm);
            
            // 🔥 ИСПРАВЛЕННАЯ ЛОГИКА ПОИСКА
            filteredContractors = this.allContractors.filter(contractor => {
                const nameMatch = contractor.name.toLowerCase().includes(searchTerm);
                const categoryMatch = contractor.category.toLowerCase().includes(searchTerm);
                
                // 🔥 ДЕБАГ: Логируем каждый контрагент для проверки
                if (contractor.name.includes('Ромашка')) {
                    console.log('🔍 Ромашка проверка:', {
                        name: contractor.name,
                        searchTerm: searchTerm,
                        nameMatch: nameMatch,
                        categoryMatch: categoryMatch,
                        includes: contractor.name.toLowerCase().includes(searchTerm)
                    });
                }
                
                return nameMatch || categoryMatch;
            });
        }
    
        console.log('📊 Результаты поиска:', filteredContractors.length);
        
        // 🔥 ДЕБАГ: Показываем какие контрагенты найдены
        if (query) {
            console.log('📋 Найденные контрагенты:', filteredContractors.map(c => c.name));
        }
    
        // ОГРАНИЧИВАЕМ ДЛЯ УДОБСТВА
        filteredContractors = filteredContractors.slice(0, 10);
    
        // ОТОБРАЖАЕМ РЕЗУЛЬТАТЫ
        if (filteredContractors.length === 0) {
            dropdown.innerHTML = `
                <div class="dropdown-item no-results">
                    <div>🔍 Контрагенты не найдены</div>
                    <small>Попробуйте изменить запрос</small>
                </div>
            `;
        } else {
            dropdown.innerHTML = filteredContractors.map(contractor => {
                const isSelected = this.selectedContractors.some(c => c.id === contractor.id);
                
                // 🔥 ПОДСВЕТКА СОВПАДЕНИЙ В РЕЗУЛЬТАТАХ ПОИСКА
                const highlightedName = this.highlightMatch(contractor.name, query);
                const highlightedCategory = this.highlightMatch(contractor.category, query);
                
                return `
                    <div class="dropdown-item ${isSelected ? 'selected' : ''}" 
                         data-contractor-id="${contractor.id}"
                         onclick="scannerManager.handleContractorSelection(${contractor.id})">
                        <div class="contractor-info">
                            <div class="contractor-name">${highlightedName}</div>
                            <div class="contractor-category">${highlightedCategory}</div>
                        </div>
                        ${isSelected ? '<div class="selected-badge">✓ Выбран</div>' : ''}
                    </div>
                `;
            }).join('');
        }
        
        // 🔥 ВАЖНО: Всегда показываем dropdown при поиске
        if (query || filteredContractors.length > 0) {
            this.showDropdown();
        }
    }
    
    // 🔥 МЕТОД ДЛЯ ПОДСВЕТКИ СОВПАДЕНИЙ В ПОИСКЕ
    highlightMatch(text, query) {
        if (!query || !text) return text;
        
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const startIndex = lowerText.indexOf(lowerQuery);
        
        if (startIndex === -1) return text;
        
        const endIndex = startIndex + query.length;
        const before = text.substring(0, startIndex);
        const match = text.substring(startIndex, endIndex);
        const after = text.substring(endIndex);
        
        return `${before}<mark style="background: yellow; padding: 2px 0; border-radius: 2px;">${match}</mark>${after}`;
    }
    
    showDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
            // Принудительно устанавливаем z-index для мобильных
            dropdown.style.zIndex = '1000';
            dropdown.style.position = 'absolute';
        }
    }
    
    hideDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    attachDropdownClickHandlers() {
        const dropdown = document.getElementById('contractorDropdown');
        if (!dropdown) return;
        
        console.log('📱 Setting up mobile-friendly dropdown handlers');
        
        // Удаляем все старые обработчики
        dropdown.removeEventListener('click', this.handleDropdownClick);
        dropdown.removeEventListener('touchend', this.handleDropdownClick);
        dropdown.removeEventListener('touchstart', this.handleTouchStart);
        
        // Обработчик для touchstart (фиксирует начало касания)
        this.handleTouchStart = (e) => {
            e.preventDefault(); // Предотвращаем поведение по умолчанию
            const item = e.target.closest('.dropdown-item');
            if (item && !item.classList.contains('no-results')) {
                // Добавляем визуальную обратную связь
                item.style.backgroundColor = '#f0f0f0';
            }
        };
        
        // Упрощенный обработчик для выбора
        this.handleDropdownClick = (e) => {
            console.log('📱 Dropdown interaction:', e.type);
            
            const item = e.target.closest('.dropdown-item');
            if (item && !item.classList.contains('no-results')) {
                const contractorId = item.getAttribute('data-contractor-id');
                console.log('📱 Contractor ID selected:', contractorId);
                
                if (contractorId) {
                    // Убираем визуальную обратную связь
                    item.style.backgroundColor = '';
                    
                    this.toggleContractor(parseInt(contractorId));
                    
                    // На мобильных закрываем dropdown после выбора для удобства
                    setTimeout(() => {
                        this.hideDropdown();
                        document.getElementById('contractorSearch').blur();
                    }, 300);
                }
            }
        };
        
        // Добавляем обработчики с правильными опциями
        dropdown.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        dropdown.addEventListener('touchend', this.handleDropdownClick, { passive: true });
        dropdown.addEventListener('click', this.handleDropdownClick);
        
        console.log('✅ Mobile dropdown handlers attached');
    }
    
    // ДОБАВЬТЕ МЕТОД ДЛЯ ПОДСВЕТКИ СОВПАДЕНИЙ
    highlightMatch(text, query) {
        if (!query) return text;
        
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const startIndex = lowerText.indexOf(lowerQuery);
        
        if (startIndex === -1) return text;
        
        const endIndex = startIndex + query.length;
        return text.substring(0, startIndex) + 
               '<mark>' + text.substring(startIndex, endIndex) + '</mark>' + 
               text.substring(endIndex);
    }   
    
    handleContractorSelect(contractorId) {
        console.log('🎯 Contractor selected:', contractorId);
    
        if (!contractorId) {
            console.log('❌ No contractor selected');
            this.deselectContractor();
            return;
        }

        const contractor = appState.getContractor(parseInt(contractorId));
        console.log('🔍 Contractor found:', contractor);
    
        if (contractor) {
            this.selectContractor(contractor);
        } else {
            console.error('❌ Contractor not found for ID:', contractorId);
            showError('Контрагент не найден');
        }
    }

    selectContractor(contractor) {
        try {
            console.log('✅ Selecting contractor:', contractor);
        
            if (!contractor || !contractor.id) {
                console.error('❌ Invalid contractor:', contractor);
                showError('Ошибка выбора контрагента');
                return;
            }
        
            this.currentContractor = contractor;
            appState.startNewSession(contractor.id);
        
            this.updateSessionStatus();
            this.enableCameraButton();
        
            // Двойная проверка
            console.log('📝 Current contractor after select:', this.currentContractor);
            console.log('📝 Session after select:', appState.getCurrentSession());
        
            showSuccess(`Выбран контрагент: ${contractor.name}`, 3000);
        
        } catch (error) {
            console.error('❌ Error selecting contractor:', error);
            showError('Ошибка при выборе контрагента');
        }
    }

    deselectContractor() {
        this.currentContractor = null;
        document.getElementById('startCamera').disabled = true;
        this.hideSessionStatus();
        this.hideSimulator();
        this.stopCamera();
    }

    updateSessionStatus() {
        if (!this.selectedContractors || this.selectedContractors.length === 0) {
            console.log('ℹ️ No contractors selected, hiding session status');
            this.hideSessionStatus();
            return;
        }
        
        const session = appState.getCurrentSession();
        const statusCard = document.getElementById('sessionStatus');
        
        statusCard.classList.remove('hidden');
        document.getElementById('currentContractor').textContent = 
            this.selectedContractors.map(c => c.name).join(', ');
        document.getElementById('codesCount').textContent = session.scannedCodes.length;
        document.getElementById('sessionId').textContent = session.id;
        
        // Добавляем информацию о валидации
        const contractorsCount = this.selectedContractors.length;
        const codesCount = session.scannedCodes.length;
        
        const validationInfo = document.getElementById('validationInfo') || 
            document.createElement('div');
        validationInfo.id = 'validationInfo';
        validationInfo.className = 'validation-info';
        
        if (codesCount < contractorsCount) {
            validationInfo.innerHTML = `
                <div class="validation-warning">
                    ⚠️ Недостаточно кодов: ${codesCount} из ${contractorsCount} требуемых
                </div>
            `;
        } else {
            validationInfo.innerHTML = `
                <div class="validation-success">
                    ✅ Достаточно кодов для ${contractorsCount} контрагентов
                </div>
            `;
        }
        
        // Добавляем в статус карту если еще нет
        if (!document.getElementById('validationInfo')) {
            statusCard.querySelector('.status-info').appendChild(validationInfo);
        }
    }

    hideSessionStatus() {
        document.getElementById('sessionStatus').classList.add('hidden');
    }

    enableCameraButton() {
        document.getElementById('startCamera').disabled = false;
    }

    // ЗАПУСК КАМЕРЫ С ПРАВИЛЬНЫМ ОТОБРАЖЕНИЕМ
    async startCamera() {
        console.log('📷 Запускаем камеру...');
        
        if (this.isScanning) {
            console.log('⚠️ Камера уже запущена');
            return;
        }

        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }

        try {
            // ПРОВЕРЯЕМ ДОСТУПНОСТЬ БИБЛИОТЕКИ
            if (typeof Html5Qrcode === 'undefined') {
                await loadHtml5QrCode();
            }

            // Останавливаем предыдущую камеру
            await this.stopCamera();

            // ПОЛУЧАЕМ КОНТЕЙНЕР
            const container = document.getElementById('reader');
            if (!container) {
                throw new Error('Контейнер для камеры не найден');
            }

            // ОЧИЩАЕМ КОНТЕЙНЕР
            container.innerHTML = '';
            
            this.scanner = new Html5Qrcode("reader");
            
            // КОНФИГУРАЦИЯ ДЛЯ МОБИЛЬНЫХ
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_QR_CODE]
            };

            console.log('🎯 Пробуем запустить камеру...');

            // ПРОБУЕМ РАЗНЫЕ КАМЕРЫ
            let cameraStarted = false;
            
            try {
                // СНАЧАЛА ПРОБУЕМ ЗАДНЮЮ КАМЕРУ
                console.log('📸 Пробуем заднюю камеру...');
                await this.scanner.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        console.log('✅ QR-код распознан:', decodedText);
                        this.onScanSuccess(decodedText);
                    },
                    (errorMessage) => {
                        // Игнорируем ошибки сканирования
                    }
                );
                cameraStarted = true;
                console.log('✅ Задняя камера запущена');
                
            } catch (error) {
                console.log('❌ Задняя камера не доступна, пробуем переднюю:', error.message);
                
                try {
                    // ПРОБУЕМ ПЕРЕДНЮЮ КАМЕРУ
                    console.log('📸 Пробуем переднюю камеру...');
                    await this.scanner.start(
                        { facingMode: "user" },
                        config,
                        (decodedText) => {
                            console.log('✅ QR-код распознан:', decodedText);
                            this.onScanSuccess(decodedText);
                        },
                        (errorMessage) => {
                            // Игнорируем ошибки сканирования
                        }
                    );
                    cameraStarted = true;
                    console.log('✅ Передняя камера запущена');
                    
                } catch (error2) {
                    console.log('❌ Передняя камера не доступна:', error2.message);
                    throw error2;
                }
            }

            if (cameraStarted) {
                this.isScanning = true;
                
                // ОБНОВЛЯЕМ ИНТЕРФЕЙС
                document.getElementById('startCamera').classList.add('hidden');
                document.getElementById('stopCamera').classList.remove('hidden');
                
                // СКРЫВАЕМ ПЛЕЙСХОЛДЕР И ПОКАЗЫВАЕМ КАМЕРУ
                const placeholder = document.querySelector('.scanner-overlay');
                if (placeholder) {
                    placeholder.classList.add('hidden');
                }
                
                console.log('🎉 Камера успешно запущена и отображается');
                showSuccess('📷 Камера запущена! Наведите на QR-код', 3000);
            }

        } catch (error) {
            console.error('❌ Основной метод не сработал, пробуем альтернативный...');
            
            // ПРОБУЕМ АЛЬТЕРНАТИВНЫЙ МЕТОД ДЛЯ CHROME
            if (/Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)) {
                try {
                    await this.startCameraChromeFallback();
                    return; // Успех!
                } catch (fallbackError) {
                    console.error('❌ Альтернативный метод тоже не сработал:', fallbackError);
                    lastError = fallbackError;
                }
            }
            let message = 'Не удалось запустить камеру: ' + error.message;
            if (error.message.includes('NotAllowedError')) {
                message = '📷 Разрешите доступ к камере в настройках браузера\n\n1. Нажмите на значок 🔒 в адресной строке\n2. Выберите "Разрешить доступ к камере"\n3. Перезагрузите страницу';
            } else if (error.message.includes('NotFoundError')) {
                message = '📷 Камера не найдена на устройстве';
            } else if (error.message.includes('NotSupportedError')) {
                message = '📷 Ваш браузер не поддерживает сканирование QR-кодов';
            }
            
            showError(message);
            this.showSimulator();
        }
    }

    // АЛЬТЕРНАТИВНЫЙ ЗАПУСК ДЛЯ CHROME
    async startCameraChromeFallback() {
        console.log('🔄 Альтернативный запуск для Chrome...');
        
        try {
            // ПРЯМОЙ ЗАПРОС РАЗРЕШЕНИЯ
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            console.log('✅ Разрешение получено, создаем сканер...');
            
            // ТЕПЕРЬ СОЗДАЕМ СКАНЕР
            const container = document.getElementById('reader');
            container.innerHTML = '';
            
            this.scanner = new Html5Qrcode("reader");
            
            // ЗАПУСКАЕМ СКАНЕР С УЖЕ ПОЛУЧЕННЫМ РАЗРЕШЕНИЕМ
            await this.scanner.start(
                { deviceId: { exact: stream.getVideoTracks()[0].getSettings().deviceId } },
                { 
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => {
                    this.onScanSuccess(decodedText);
                },
                (errorMessage) => {}
            );
            
            // ОСТАНАВЛИВАЕМ НАШ ПОТОК (сканер создаст свой)
            stream.getTracks().forEach(track => track.stop());
            
            this.isScanning = true;
            document.getElementById('startCamera').classList.add('hidden');
            document.getElementById('stopCamera').classList.remove('hidden');
            this.hideScannerPlaceholder();
            
            showSuccess('📷 Камера запущена через альтернативный метод!', 3000);
            
        } catch (error) {
            console.error('❌ Альтернативный метод не сработал:', error);
            throw error;
        }
    }

    // ДИАГНОСТИКА КАМЕРЫ
    async checkCameraSupport() {
        try {
            // ПРОВЕРЯЕМ ДОСТУП К КАМЕРЕ
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Браузер не поддерживает доступ к камере');
            }

            // ПРОВЕРЯЕМ РАЗРЕШЕНИЯ
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            
            console.log('✅ Камера доступна');
            return true;
            
        } catch (error) {
            console.error('❌ Камера не доступна:', error);
            
            let message = 'Камера не доступна: ';
            if (error.name === 'NotAllowedError') {
                message = '❌ Доступ к камере запрещен. Разрешите доступ в настройках браузера.';
            } else if (error.name === 'NotFoundError') {
                message = '❌ Камера не найдена на устройстве.';
            } else if (error.name === 'NotSupportedError') {
                message = '❌ Ваш браузер не поддерживает доступ к камере.';
            } else {
                message += error.message;
            }
            
            showError(message);
            return false;
        }
    }

    // ОСТАНОВКА КАМЕРЫ
    async stopCamera() {
        if (this.scanner && this.isScanning) {
            try {
                await this.scanner.stop();
                await this.scanner.clear();
                console.log('✅ Камера остановлена');
            } catch (error) {
                console.warn('⚠️ Ошибка при остановке камеры:', error);
            }
        }
        
        this.isScanning = false;
        this.scanner = null;
        
        // ОБНОВЛЯЕМ ИНТЕРФЕЙС
        document.getElementById('startCamera').classList.remove('hidden');
        document.getElementById('stopCamera').classList.add('hidden');
        
        // ПОКАЗЫВАЕМ ПЛЕЙСХОЛДЕР
        const placeholder = document.querySelector('.scanner-overlay');
        if (placeholder) {
            placeholder.classList.remove('hidden');
        }
        
        // ОЧИЩАЕМ КОНТЕЙНЕР
        const container = document.getElementById('reader');
        if (container) {
            container.innerHTML = `
                <div class="scanner-overlay">
                    <span class="placeholder-icon">📷</span>
                    <p>Камера запущена. Наведите на QR-код</p>
                    <div class="scanner-frame"></div>
                </div>
            `;
        }
    }
    showManualInput() {
        const code = prompt('Введите QR-код вручную:', '0104604063405720219NQNfSwVmcTEST001');
        if (code && code.trim()) {
            this.onScanSuccess(code.trim());
        }
    }

    toggleCameraControls(scanning) {
        document.getElementById('startCamera').classList.toggle('hidden', scanning);
        document.getElementById('stopCamera').classList.toggle('hidden', !scanning);
    }

    onScanSuccess(decodedText) {
        console.log('📷 Scan success, selected contractors:', this.selectedContractors);
        
        // УЛУЧШЕННАЯ ПРОВЕРКА С ВЫВОДОМ ОШИБКИ
        if (!this.selectedContractors || this.selectedContractors.length === 0) {
            console.error('❌ No contractors selected. selectedContractors:', this.selectedContractors);
            showError('Сначала выберите контрагентов');
            return;
        }
    
        if (appState.hasCodeBeenScanned(decodedText)) {
            showWarning('Этот код уже отсканирован');
            return;
        }
    
        const scannedCode = {
            code: decodedText,
            timestamp: new Date().toISOString(),
            contractors: this.selectedContractors.map(c => ({ id: c.id, name: c.name }))
        };
        
        appState.addScannedCode(decodedText);
        this.addCodeToList(scannedCode);
        this.updateUI();
        this.updateButtonStates(); // ОБНОВЛЯЕМ СОСТОЯНИЕ КНОПОК ПОСЛЕ ДОБАВЛЕНИЯ КОДА
        
        showSuccess(`Код добавлен для ${this.selectedContractors.length} контрагентов`, 2000);
    }

    debugInfo() {
        console.log('=== DEBUG INFO ===');
        console.log('Current contractor:', this.currentContractor);
        console.log('Current session:', appState.getCurrentSession());
        console.log('Contractor select value:', document.getElementById('contractorSelect').value);
        console.log('All contractors:', appState.getContractors());
        console.log('==================');
    }

    forceRestoreSession() {
        console.log('🔄 Force restoring session...');
        const session = appState.getCurrentSession();
        console.log('Current session:', session);
        console.log('Current contractor in manager:', this.currentContractor);
    
        if (session.contractorId) {
            const contractor = appState.getContractor(parseInt(session.contractorId));
            if (contractor) {
                this.currentContractor = contractor;
                document.getElementById('contractorSelect').value = contractor.id;
                console.log('✅ Session restored:', this.currentContractor);
            }
        }
    }

    addCodeToList(scannedCode) {
        const codesList = document.getElementById('codesList');
        const emptyState = codesList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        const codeItem = document.createElement('div');
        codeItem.className = 'code-item';
        codeItem.innerHTML = `
            <div class="code-info">
                <div class="code-value">${this.formatCode(scannedCode.code)}</div>
                <div class="code-time">${new Date(scannedCode.timestamp).toLocaleTimeString()}</div>
            </div>
            <div class="code-actions">
                <button class="btn btn-sm btn-danger" onclick="scannerManager.removeCode('${scannedCode.code}')">
                    ✕ Удалить
                </button>
            </div>
        `;
        
        codesList.appendChild(codeItem);
    }

    formatCode(code) {
        if (code.length > 25) {
            return code.substring(0, 15) + '...' + code.substring(code.length - 10);
        }
        return code;
    }

    removeCode(code) {
        console.log('🗑️ removeCode CALLED with code:', code);
        
        // Проверяем текущие коды до удаления
        const beforeCodes = appState.getCurrentSession().scannedCodes;
        console.log('📋 Codes BEFORE removal:', beforeCodes);
        
        // Удаляем код
        appState.removeScannedCode(code);
        
        // Проверяем коды после удаления
        const afterCodes = appState.getCurrentSession().scannedCodes;
        console.log('📋 Codes AFTER removal:', afterCodes);
        
        // Обновляем интерфейс
        this.updateUI();
        this.updateButtonStates();
        
        console.log('✅ Code removal completed');
        showWarning('Код удален', 2000);
    }
    
    // РУЧНОЙ ВВОД КОДА
    manualInputCode() {
        const code = prompt('Введите QR-код вручную:', '0104604063405720219NQNfSwVmcTEST001');
        if (code && code.trim()) {
            this.simulateScan(code.trim());
        }
    }

    updateUI() {
        console.log('🔄 updateUI CALLED');

        const codesCount = appState.getCurrentSession().scannedCodes.length;
        console.log('📊 Current codes count:', codesCount);

        document.getElementById('totalCodes').textContent = codesCount;
        document.getElementById('codesCount').textContent = codesCount;
        document.getElementById('generateReport').disabled = codesCount === 0;
        
        this.updateCodesList();
        this.updateSessionStatus();

        console.log('✅ UI updated');
    }

    updateCodesList() {
        console.log('🔄 updateCodesList CALLED');
        
        const codesList = document.getElementById('codesList');
        const codes = appState.getCurrentSession().scannedCodes;
        
        console.log('📋 Codes to display:', codes);
        
        if (codes.length === 0) {
            console.log('📭 No codes, showing empty state');
            codesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>Нет отсканированных кодов</p>
                    <small>Начните сканирование или используйте симулятор</small>
                </div>
            `;
        } else {
            console.log('📦 Rendering', codes.length, 'codes');
            
            // ОЧИЩАЕМ список и ПЕРЕРИСОВЫВАЕМ все коды
            codesList.innerHTML = '';
            
            codes.forEach(scannedCode => {
                this.addCodeToList(scannedCode);
            });
        }
        
        console.log('✅ Codes list updated');
    }

    showSimulator() {
        document.getElementById('simulator').classList.remove('hidden');
        showInfo('Симулятор активирован', 2000);
    }

    hideSimulator() {
        document.getElementById('simulator').classList.add('hidden');
    }

    simulateScan(code) {
        console.log('🧪 Simulate scan, selectedContractors:', this.selectedContractors);
        
        // ПРОВЕРЯЕМ НОВЫЙ МАССИВ КОНТРАГЕНТОВ
        if (!this.selectedContractors || this.selectedContractors.length === 0) {
            console.error('❌ No contractors selected in simulator');
            showError('Сначала выберите контрагентов');
            return;
        }
    
        if (appState.hasCodeBeenScanned(code)) {
            showWarning('Этот код уже отсканирован');
            return;
        }
    
        // ИСПОЛЬЗУЕМ НОВУЮ СТРУКТУРУ ДАННЫХ
        const scannedCode = {
            code: code,
            timestamp: new Date().toISOString(),
            contractors: this.selectedContractors.map(c => ({ id: c.id, name: c.name }))
        };
        
        appState.addScannedCode(code);
        this.addCodeToList(scannedCode);
        this.updateUI();
        this.updateButtonStates();
        
        showSuccess(`Тестовый код добавлен для ${this.selectedContractors.length} контрагентов`, 2000);
    }

    simulateMultipleScans() {
        if (!this.currentContractor) {
            showError('Сначала выберите контрагента');
            return;
        }

        const testCodes = [
            '0104604063405720219NQNfSwVmcTEST001',
            '0104604063405720219NQNfSwVmdTEST002',
            '0104604063405720219NQNfSwVmeTEST003',
            '0104604063405720219NQNfSwVmfTEST004',
            '0104604063405720219NQNfSwVmgTEST005'
        ];

        let addedCount = 0;
        
        testCodes.forEach(code => {
            if (!appState.hasCodeBeenScanned(code)) {
                const scannedCode = appState.addScannedCode(code);
                this.addCodeToList(scannedCode);
                addedCount++;
            }
        });

        this.updateUI();
        showSuccess(`Добавлено ${addedCount} тестовых кодов`, 3000);
    }

    async generateReport() {
        const session = appState.getCurrentSession();
        console.log('🔍 Session data:', session);
        console.log('👥 Selected contractors:', this.selectedContractors);
        
        // ВАЛИДАЦИЯ 1: Проверяем есть ли коды
        if (session.scannedCodes.length === 0) {
            showError('Нет кодов для отчета');
            return;
        }
    
        // ВАЛИДАЦИЯ 2: Проверяем есть ли контрагенты
        if (!this.selectedContractors || this.selectedContractors.length === 0) {
            showError('Нет выбранных контрагентов');
            return;
        }
    
        // ВАЛИДАЦИЯ 3: Проверяем соотношение контрагентов и кодов
        const contractorsCount = this.selectedContractors.length;
        const codesCount = session.scannedCodes.length;
        
        console.log(`📊 Validation: ${contractorsCount} contractors, ${codesCount} codes`);
        
        // Нельзя отгрузить меньше кодов чем контрагентов
        if (codesCount < contractorsCount) {
            showError(`Нельзя отгрузить ${codesCount} кодов на ${contractorsCount} контрагентов\nМинимум ${contractorsCount} кодов требуется`);
            return;
        }
    
        // ВАЛИДАЦИЯ 4: Проверяем что коды можно равномерно распределить (опционально)
        if (codesCount % contractorsCount !== 0) {
            const warningMessage = `Внимание: ${codesCount} кодов невозможно равномерно распределить между ${contractorsCount} контрагентами\nПродолжить создание отчета?`;
            
            if (!confirm(warningMessage)) {
                return;
            }
        }
    
        try {
            // СОЗДАЕМ ОТЧЕТ С ВСЕМИ ДАННЫМИ ВКЛЮЧАЯ sequentialNumber
            const report = {
                id: session.id,
                contractorId: this.selectedContractors[0].id,
                contractorName: this.selectedContractors.map(c => c.name).join(', '),
                contractors: this.selectedContractors,
                codes: session.scannedCodes,
                createdAt: new Date().toISOString(),
                status: 'pending',
                pdfGenerated: true,
                // ДОБАВЛЯЕМ sequentialNumber ВРУЧНУЮ
                sequentialNumber: appState.reportCounter
            };
    
            console.log('📋 Report data before saving:', report);
    
            // СОХРАНЯЕМ ОТЧЕТ В СИСТЕМУ (БЕЗ АВТОМАТИЧЕСКОГО СКАЧИВАНИЯ PDF)
            this.notificationManager.saveReportForAccountant(report);
            appState.saveReport(report);
            
            setTimeout(() => {
                this.loadReportsHistory();
                console.log('✅ Отчет сохранен');
            }, 100);
            
            showSuccess(`✅ Отчет создан! Кодов: ${session.scannedCodes.length}\nPDF можно скачать в списке отчетов`, 5000);
            this.clearSession();
    
        } catch (error) {
            console.error('❌ Ошибка создания отчета:', error);
            showError('Ошибка создания отчета');
        }
    }

    // МЕТОД ДЛЯ ОБНОВЛЕНИЯ СОСТОЯНИЯ КНОПОК
    updateButtonStates() {
        const hasContractors = this.selectedContractors && this.selectedContractors.length > 0;
        const hasCodes = appState.getCurrentSession().scannedCodes.length > 0;
        
        const contractorsCount = this.selectedContractors ? this.selectedContractors.length : 0;
        const codesCount = appState.getCurrentSession().scannedCodes.length;
        
        console.log('🔄 Updating buttons:', { 
            hasContractors, 
            hasCodes, 
            contractorsCount, 
            codesCount 
        });
    
        // Включить камеру - нужно только выбранные контрагенты
        document.getElementById('startCamera').disabled = !hasContractors;
    
        // Сформировать отчет - нужны и контрагенты и коды + проверка соотношения
        const canGenerateReport = hasContractors && hasCodes && codesCount >= contractorsCount;
        document.getElementById('generateReport').disabled = !canGenerateReport;
        
        // Добавляем подсказку если нельзя создать отчет
        const generateReportBtn = document.getElementById('generateReport');
        if (hasContractors && hasCodes && codesCount < contractorsCount) {
            generateReportBtn.title = `Недостаточно кодов: ${codesCount} кодов на ${contractorsCount} контрагентов`;
            generateReportBtn.classList.add('btn-warning');
        } else {
            generateReportBtn.title = '';
            generateReportBtn.classList.remove('btn-warning');
        }
    }

    // Добавьте метод проверки мобильного устройства
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    selectAllContractors() {
        this.selectedContractors = appState.getContractors();
        this.updateSelectedContractorsUI();
        this.updateContractorButtons();
        this.enableCameraButton();
        showSuccess('Выбраны все контрагенты', 2000);
    }

    clearContractors() {
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateContractorButtons();
        this.deselectContractor();
        showWarning('Контрагенты очищены', 2000);
    }

    updateContractorButtons() {
        // Обновляем стили кнопок в зависимости от выбора
        const buttons = document.querySelectorAll('.contractor-btn');
        buttons.forEach(button => {
            const contractorId = parseInt(button.getAttribute('onclick').match(/\d+/)[0]);
            const isSelected = this.selectedContractors.some(c => c.id === contractorId);
        
            if (isSelected) {
                button.classList.remove('btn-outline');
                button.classList.add('btn-primary');
            } else {
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline');
            }
        });
    }
    
    updateSelectedContractorsUI() {
        console.log('🔄 updateSelectedContractorsUI CALLED');
        console.log('📦 selectedContractors:', this.selectedContractors);

        const container = document.getElementById('selectedContractors');
        const list = document.getElementById('contractorsList');
        const count = document.getElementById('selectedCount');

        console.log('🎯 Found elements:', { container, list, count });
        
        if (!container || !list || !count) {
            console.error('❌ UI elements not found');
            return;
        }
        
        console.log('🔄 Updating UI, selectedContractors:', this.selectedContractors);
        
        // ОБНОВЛЯЕМ СЧЕТЧИК
        count.textContent = this.selectedContractors.length;
        
        if (this.selectedContractors.length === 0) {
            container.style.display = 'none';
            console.log('📭 No contractors selected, hiding container');
            return;
        }
        
        // ПОКАЗЫВАЕМ КОНТЕЙНЕР
        container.style.display = 'block';
        
        // ОБНОВЛЯЕМ СПИСОК
        list.innerHTML = this.selectedContractors.map(contractor => `
            <div class="contractor-tag">
                <span>${contractor.name}</span>
                <button class="btn btn-sm btn-danger" onclick="scannerManager.removeContractor(${contractor.id})">
                    ✕
                </button>
            </div>
        `).join('');
        
        console.log('✅ UI updated, showing', this.selectedContractors.length, 'contractors');
        
        // ОБНОВЛЯЕМ КНОПКИ
        this.updateButtonStates();
    }

    toggleContractor(contractorId) {
        console.log('🎯 toggleContractor CALLED with contractorId:', contractorId);
        console.log('📱 Is mobile:', this.isMobile());
        console.log('🎯 Current selectedContractors BEFORE:', this.selectedContractors);
        
        console.log('📋 allContractors:', this.allContractors);
        console.log('📋 allContractors length:', this.allContractors ? this.allContractors.length : 'undefined');
        
        if (!this.selectedContractors) {
            console.warn('⚠️ selectedContractors is undefined, initializing...');
            this.selectedContractors = [];
        }
        
        const contractor = this.allContractors.find(c => c.id === contractorId);
        if (!contractor) {
            console.error('❌ Contractor not found for id:', contractorId);
            console.error('❌ Available contractors:', this.allContractors);
            return;
        }
        
        const isSelected = this.selectedContractors.some(c => c.id === contractorId);
        console.log('🎯 Is selected?:', isSelected);
        
        if (isSelected) {
            this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
        } else {
            this.selectedContractors.push(contractor);
        }
        
        console.log('🎯 selectedContractors AFTER:', this.selectedContractors);
        
        // СОХРАНЯЕМ выбранных контрагентов
        const selectedContractorsData = {
            contractorIds: this.selectedContractors.map(c => c.id),
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('honest_sign_selected_contractors', JSON.stringify(selectedContractorsData));
    
        // Обновляем сессию в appState
        if (this.selectedContractors.length > 0) {
            appState.startNewSession(this.selectedContractors.map(c => c.id));
        }
        
        this.updateSelectedContractorsUI();
        this.filterContractors(document.getElementById('contractorSearch').value);
        this.updateButtonStates(); // ДОБАВЬТЕ ЭТОТ ВЫЗОВ
        
        console.log('✅ Contractor toggled, button states updated');
    }

    // Обновите deselectContractor для работы с массивом
    deselectContractor() {
        this.selectedContractors = [];
        document.getElementById('startCamera').disabled = true;
        this.hideSessionStatus();
        this.hideSimulator();
        this.stopCamera();
        this.updateContractorButtons();
    }

    saveSession() {
        appState.saveToStorage();
        showSuccess('Сессия сохранена', 2000);
    }

    clearSession() {
        
        this.clearSessionCompletely();

        console.log('🗑️ Clearing session completely');
        
        if (this.isScanning) {
            this.stopCamera();
        }
        
        // Полностью очищаем состояние
        appState.clearCurrentSession();
        this.selectedContractors = [];
        
        // Обновляем интерфейс
        this.updateSelectedContractorsUI();
        this.updateUI();
        this.hideSessionStatus();
        this.hideSimulator();
        
        // ОБНОВЛЯЕМ КНОПКИ
        this.updateButtonStates();
        
        console.log('✅ Session cleared completely');
        showWarning('Сессия очищена', 3000);
    }

    checkExistingSession() {
        try {
            const session = appState.getCurrentSession();
            console.log('📋 Checking existing session:', session);
            
            // Восстанавливаем ВЫБРАННЫХ КОНТРАГЕНТОВ из отдельного хранилища
            const savedContractors = JSON.parse(localStorage.getItem('honest_sign_selected_contractors') || '{}');
            console.log('📋 Saved contractors data:', savedContractors);
            
            if (savedContractors.contractorIds && savedContractors.contractorIds.length > 0) {
                this.selectedContractors = savedContractors.contractorIds.map(id => {
                    return appState.getContractor(parseInt(id));
                }).filter(contractor => contractor !== undefined); // Фильтруем существующих
                
                console.log('✅ Restored contractors:', this.selectedContractors);
                
                if (this.selectedContractors.length > 0) {
                    this.updateSelectedContractorsUI();
                    this.updateButtonStates(); // ОБНОВЛЯЕМ СОСТОЯНИЕ КНОПОК
                    this.enableCameraButton();
                }
            }
            
            // Восстанавливаем отсканированные коды ТОЛЬКО если есть выбранные контрагенты
            if (session.scannedCodes && session.scannedCodes.length > 0) {
                if (this.selectedContractors && this.selectedContractors.length > 0) {
                    console.log('✅ Restoring', session.scannedCodes.length, 'scanned codes');
                    session.scannedCodes.forEach(code => {
                        this.addCodeToList(code);
                    });
                    this.updateUI();
                    this.updateButtonStates(); // ОБНОВЛЯЕМ СОСТОЯНИЕ КНОПОК ПОСЛЕ ВОССТАНОВЛЕНИЯ КОДОВ
                } else {
                    // Нет контрагентов - очищаем коды
                    console.warn('⚠️ No contractors selected, clearing scanned codes');
                    appState.clearCurrentSession();
                }
            }
            
            // ФИНАЛЬНОЕ ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК
            this.updateButtonStates();
            
        } catch (error) {
            console.error('❌ Error restoring session:', error);
            // При ошибке очищаем всё
            this.clearSessionCompletely();
        }
    }

    // Метод для удаления конкретного отчета по ID из всех хранилищ
    deleteReportById(reportId) {
        console.log('🗑️ Deleting report by ID from all storages:', reportId);
    
        if (!reportId) {
            showError('ID отчета не указан');
            return;
        }
    
        if (confirm(`Удалить отчет #${reportId} из всех хранилищ?`)) {
            try {
                // 1. Удаляем из warehouse_reports
                const warehouseReports = JSON.parse(localStorage.getItem('warehouse_reports') || '[]');
                const updatedWarehouseReports = warehouseReports.filter(r => r.id !== reportId);
                localStorage.setItem('warehouse_reports', JSON.stringify(updatedWarehouseReports));
            
                // 2. Удаляем из appState
                const appReports = appState.getReports();
                const updatedAppReports = appReports.filter(r => r.id !== reportId);
                appState.saveReports(updatedAppReports);
            
                // 3. Удаляем из sent_sessions
                const sentSessions = JSON.parse(localStorage.getItem('honest_sign_sent_sessions') || '[]');
                const updatedSentSessions = sentSessions.filter(s => s.id !== reportId);
                localStorage.setItem('honest_sign_sent_sessions', JSON.stringify(updatedSentSessions));
            
                // 4. Обновляем интерфейс
                this.loadReportsHistory();
            
                showSuccess(`Отчет #${reportId} удален из всех хранилищ`, 4000);
            
            } catch (error) {
                console.error('❌ Error deleting report:', error);
                showError('Ошибка при удалении отчета');
            }
        }
    }

    clearSessionCompletely() {
        console.log('🗑️ Clearing session COMPLETELY');
        
        if (this.isScanning) {
            this.stopCamera();
        }
        
        // Полностью очищаем ВСЁ состояние
        appState.clearCurrentSession();
        this.selectedContractors = [];
        
        // Очищаем дополнительное хранилище контрагентов
        localStorage.removeItem('honest_sign_selected_contractors');
        
        // Обновляем интерфейс
        this.updateSelectedContractorsUI();
        this.updateUI();
        this.hideSessionStatus();
        this.hideSimulator();
        this.updateButtonStates();
        
        console.log('✅ Session completely cleared');
        showWarning('Сессия полностью очищена', 3000);
    }

    // Уведомления - ИСПРАВЛЕННЫЕ МЕТОДЫ
    checkNotifications() {
        const notifications = this.notificationManager.getWarehouseNotifications();
        const unreadCount = notifications.filter(n => !n.read).length;
        
        const countElement = document.getElementById('notificationCount');
        if (unreadCount > 0) {
            countElement.textContent = unreadCount;
            countElement.classList.remove('hidden');
        } else {
            countElement.classList.add('hidden');
        }
        return unreadCount;
    }

    showNotifications() {
        const notifications = JSON.parse(localStorage.getItem('warehouse_notifications') || '[]');
        const listElement = document.getElementById('notificationsList');
        const panel = document.getElementById('warehouseNotifications');
        
        if (!listElement || !panel) return;
    
        this.removeAllOverlays();    
    
        const overlay = document.createElement('div');
        overlay.className = 'notifications-overlay';
        overlay.id = 'notificationsOverlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.hideNotifications();
            }
        };
        document.body.appendChild(overlay);
    
        if (notifications.length === 0) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📧</span>
                    <p>Нет уведомлений от бухгалтерии</p>
                    <small>Уведомления появятся здесь после обработки отчетов</small>
                </div>
            `;
        } else {
            listElement.innerHTML = notifications.map(notif => `
                <div class="notification-item ${notif.read ? 'read' : 'unread'} ${notif.type || 'info'}">
                    <div class="notification-content">
                        <strong>${notif.message}</strong>
                        <p>Контрагент: ${notif.contractorName}</p>
                        <p>Кодов: ${notif.codeCount}</p>
                        <small>${new Date(notif.processedAt || notif.deletedAt).toLocaleString('ru-RU')}</small>
                    </div>
                    <div class="notification-actions">
                        ${notif.type === 'deleted' ? 
                            `<button class="btn btn-sm btn-danger" onclick="scannerManager.removeDeletedReport('${notif.reportId}')">
                                🗑️ Удалить
                            </button>` : 
                            ''
                        }
                        <button class="btn btn-sm btn-outline" onclick="scannerManager.markNotificationRead('${notif.id}')">
                            ${notif.read ? '✓ Прочитано' : 'Отметить'}
                        </button>
                    </div>
                </div>
            `).join('');
        }
    
        panel.classList.remove('hidden');
        
        const closeBtn = panel.querySelector('.notifications-header button');
        if (closeBtn) {
            closeBtn.onclick = () => this.hideNotifications();
        }
    }

    // НОВЫЙ МЕТОД: удаляем все оверлеи
    removeAllOverlays() {
        const overlays = document.querySelectorAll('.notifications-overlay');
        overlays.forEach(overlay => {
            overlay.remove();
        });
    }

    hideNotifications() {
        const panel = document.getElementById('warehouseNotifications');
        const overlay = document.querySelector('.notifications-overlay');
        
        if (panel) {
            panel.classList.add('hidden');
        }
        if (overlay) {
            overlay.remove();
        }
    }

    clearInvalidSession() {
        console.log('🔄 Clearing invalid session...');
        appState.clearCurrentSession();
        this.currentContractor = null;
        document.getElementById('contractorSelect').value = '';
        this.hideSessionStatus();
    }

    markNotificationRead(notificationId) {
        this.notificationManager.markAsRead(notificationId);
        this.checkNotifications();
        this.showNotifications(); // Обновляем отображение
        showSuccess('Уведомление отмечено как прочитанное', 2000);
    }
}

let scannerManager;
document.addEventListener('DOMContentLoaded', () => {
    scannerManager = new ScannerManager();
});
