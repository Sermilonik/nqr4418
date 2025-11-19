class ScannerManager {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.selectedContractors = [];
        this.allContractors = [];
        this.pdfGenerator = null;
        this.notificationManager = new NotificationManager();
        this.cleaningUp = false;

        this._stopInProgress = false;
        this._cleanupTimeout = null;
        
        // Сохраняем глобальную ссылку
        window.scannerManager = this;
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация ScannerManager');
        
        this.loadContractors();
        this.attachEventListeners();
        this.checkExistingSession();
       // this.checkNotifications();

        // ВОССТАНАВЛИВАЕМ СОСТОЯНИЕ КАМЕРЫ ПРИ ПОВТОРНОМ ЗАХОДЕ
        setTimeout(async () => {
            const cameraAvailable = await this.restoreCameraState();
            if (!cameraAvailable) {
                showWarning('📷 Камера требует перезагрузки страницы для работы', 5000);
            }
        }, 500);

        showSuccess('Складской модуль готов к работе', 3000);
    }

    // ЗАГРУЗКА КОНТРАГЕНТОВ
    loadContractors() {
        console.log('🔍 Загрузка контрагентов...');
        
        try {
            // Пробуем загрузить из localStorage
            const savedContractors = localStorage.getItem('honest_sign_contractors');
            console.log('- Данные в localStorage:', savedContractors);
            
            if (savedContractors) {
                this.allContractors = JSON.parse(savedContractors);
                
                // ПРОВЕРЯЕМ УНИКАЛЬНОСТЬ ID
                const uniqueIds = new Set(this.allContractors.map(c => c.id));
                if (uniqueIds.size !== this.allContractors.length) {
                    console.warn('⚠️ Обнаружены дублирующиеся ID, исправляем...');
                    this.fixDuplicateIds();
                }
                
                console.log('✅ Загружено контрагентов из хранилища:', this.allContractors.length);
            } else {
                // Если в хранилище нет данных, загружаем стандартные
                console.warn('⚠️ Нет сохраненных контрагентов, загружаем стандартные');
                this.loadDefaultContractors();
                // Сохраняем стандартные в хранилище
                this.saveContractors();
            }
            
            console.log('- Итоговое количество контрагентов:', this.allContractors.length);
            this.initContractorSearch();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки контрагентов:', error);
            this.loadDefaultContractors();
        }
    }

    // ИСПРАВЛЕНИЕ ДУБЛИРУЮЩИХСЯ ID
    fixDuplicateIds() {
        let maxId = Math.max(...this.allContractors.map(c => c.id || 0), 0);
        
        this.allContractors.forEach((contractor, index) => {
            // Проверяем дубликаты ID
            const duplicateIndex = this.allContractors.findIndex((c, i) => 
                i !== index && c.id === contractor.id
            );
            
            if (duplicateIndex !== -1) {
                maxId++;
                contractor.id = maxId;
                console.log(`🔄 Исправлен дублирующийся ID: ${contractor.name} -> ${contractor.id}`);
            }
        });
        
        this.saveContractors();
    }

    loadDefaultContractors() {
        const defaultContractors = [
            { id: 1, name: 'ООО "Ромашка"', category: 'Оптовый покупатель' },
            { id: 2, name: 'ИП Иванов', category: 'Розничная сеть' },
            { id: 3, name: 'ООО "Луч"', category: 'Дилер' },
            { id: 4, name: 'АО "Вектор"', category: 'Партнер' },
            { id: 5, name: 'ООО "Луч Саяны"', category: 'Дилер' }
        ];
        
        this.allContractors = defaultContractors;
        console.log('✅ Загружены стандартные контрагенты');
    }

    // ИНИЦИАЛИЗАЦИЯ ПОИСКА КОНТРАГЕНТОВ
    initContractorSearch() {
        const searchInput = document.getElementById('contractorSearch');
        const dropdown = document.getElementById('contractorDropdown');
        
        if (!searchInput || !dropdown) {
            console.error('❌ Элементы поиска не найдены');
            return;
        }

        console.log('🔍 Инициализация поиска контрагентов');

        // ПОИСК ПРИ ВВОДЕ
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                console.log('🔍 Поиск:', query);
                this.filterContractors(query);
            }, 300);
        });

        // ПОКАЗ СПИСКА ПРИ ФОКУСЕ
        searchInput.addEventListener('focus', () => {
            console.log('📱 Поле ввода получило фокус');
            const query = searchInput.value.trim();
            this.filterContractors(query || '');
            this.showDropdown();
        });

        // СКРЫТИЕ ПРИ КЛИКЕ ВНЕ
        document.addEventListener('click', (e) => {
            const isSearchInput = e.target === searchInput;
            const isInDropdown = dropdown.contains(e.target);
            const isDropdownItem = e.target.closest('.dropdown-item');
            
            if (!isSearchInput && !isInDropdown && !isDropdownItem) {
                this.hideDropdown();
            }
        });

        // СКРЫТИЕ ПРИ SCROLL
        window.addEventListener('scroll', () => {
            if (!dropdown.classList.contains('hidden')) {
                this.hideDropdown();
            }
        });

        console.log('✅ Поиск контрагентов инициализирован');
    }

    // ФИЛЬТРАЦИЯ КОНТРАГЕНТОВ
    filterContractors(query = '') {
        const dropdown = document.getElementById('contractorDropdown');
        if (!dropdown) return;

        console.log('🔍 Фильтрация контрагентов по запросу:', query);

        let filteredContractors = this.allContractors;
        
        if (query) {
            const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
            filteredContractors = this.allContractors.filter(contractor => {
                const searchText = (contractor.name + ' ' + contractor.category).toLowerCase();
                return searchTerms.some(term => searchText.includes(term));
            });
        }

        console.log('📊 Найдено контрагентов:', filteredContractors.length);

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
                
                return `
                    <div class="dropdown-item ${isSelected ? 'selected' : ''}" 
                        data-contractor-id="${contractor.id}"
                        onclick="window.handleContractorSelection(${contractor.id})">
                        <div class="contractor-info">
                            <div class="contractor-name">${contractor.name}</div>
                            <div class="contractor-category">${contractor.category}</div>
                        </div>
                        ${isSelected ? '<div class="selected-badge">✓ Выбран</div>' : ''}
                    </div>
                `;
            }).join('');
        }
        
        // ПОКАЗЫВАЕМ СПИСОК ЕСЛИ ЕСТЬ РЕЗУЛЬТАТЫ
        if (filteredContractors.length > 0) {
            this.showDropdown();
        }
    }

    // ОБРАБОТКА ВЫБОРА КОНТРАГЕНТА
    handleContractorSelection(contractorId) {
        console.log('🎯 Выбран контрагент ID:', contractorId);
        
        this.toggleContractor(contractorId);
        
        // ОЧИЩАЕМ ПОИСК И СКРЫВАЕМ СПИСОК
        document.getElementById('contractorSearch').value = '';
        this.hideDropdown();
    }

    // ДОБАВЛЕНИЕ/УДАЛЕНИЕ КОНТРАГЕНТА
    toggleContractor(contractorId) {
        console.log('🔄 Переключение контрагента:', contractorId);

        const contractor = this.allContractors.find(c => c.id === contractorId);
        if (!contractor) {
            console.error('❌ Контрагент не найден:', contractorId);
            return;
        }

        const isSelected = this.selectedContractors.some(c => c.id === contractorId);
        
        if (isSelected) {
            // УДАЛЯЕМ
            this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
            console.log('🗑️ Удален контрагент:', contractor.name);
        } else {
            // ДОБАВЛЯЕМ
            this.selectedContractors.push(contractor);
            console.log('✅ Добавлен контрагент:', contractor.name);
        }

        console.log('📋 Новый список выбранных:', this.selectedContractors);
        
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.updateSessionStatus();
        
        // СОХРАНЯЕМ В ХРАНИЛИЩЕ
        this.saveSelectedContractors();
    }

    // ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ВЫБРАННЫХ КОНТРАГЕНТОВ
    updateSelectedContractorsUI() {
        const container = document.getElementById('selectedContractors');
        const list = document.getElementById('contractorsList');
        const count = document.getElementById('selectedCount');
        
        if (!container || !list || !count) {
            console.error('❌ Элементы интерфейса не найдены');
            return;
        }

        count.textContent = this.selectedContractors.length;
        
        if (this.selectedContractors.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        
        list.innerHTML = this.selectedContractors.map(contractor => `
            <div class="contractor-tag">
                <span>${contractor.name}</span>
                <button class="btn btn-sm btn-danger" onclick="scannerManager.removeContractor(${contractor.id})">
                    ✕
                </button>
            </div>
        `).join('');
        
        console.log('✅ Интерфейс выбранных контрагентов обновлен');
    }

    // УДАЛЕНИЕ КОНКРЕТНОГО КОНТРАГЕНТА
    removeContractor(contractorId) {
        console.log('🗑️ Удаление контрагента:', contractorId);
        this.selectedContractors = this.selectedContractors.filter(c => c.id !== contractorId);
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.updateSessionStatus();
        this.saveSelectedContractors();
    }

    // ОЧИСТКА ВСЕХ КОНТРАГЕНТОВ
    clearContractors() {
        console.log('🧹 Очистка всех контрагентов');
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateButtonStates();
        this.updateSessionStatus();
        this.saveSelectedContractors();
        this.hideDropdown();
    }

    // СОХРАНЕНИЕ ВЫБРАННЫХ КОНТРАГЕНТОВ
    saveSelectedContractors() {
        const data = {
            contractorIds: this.selectedContractors.map(c => c.id),
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('honest_sign_selected_contractors', JSON.stringify(data));
        
        // ОБНОВЛЯЕМ СЕССИЮ
        if (this.selectedContractors.length > 0) {
            appState.startNewSession(this.selectedContractors.map(c => c.id));
        }
    }

    // ПОКАЗ/СКРЫТИЕ ВЫПАДАЮЩЕГО СПИСКА
    showDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
        }
    }

    hideDropdown() {
        const dropdown = document.getElementById('contractorDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    // ОБНОВЛЕНИЕ СТАТУСА СЕССИИ
    updateSessionStatus() {
        const session = appState.getCurrentSession();
        const statusCard = document.getElementById('sessionStatus');
        
        if (this.selectedContractors.length === 0) {
            statusCard.classList.add('hidden');
            return;
        }
        
        statusCard.classList.remove('hidden');
        document.getElementById('currentContractor').textContent = 
            this.selectedContractors.map(c => c.name).join(', ');
        document.getElementById('codesCount').textContent = session.scannedCodes.length;
        document.getElementById('sessionId').textContent = session.id;
    }

    // ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПОК
    updateButtonStates() {
        const hasContractors = this.selectedContractors.length > 0;
        const hasCodes = appState.getCurrentSession().scannedCodes.length > 0;
        
        document.getElementById('startCamera').disabled = !hasContractors;
        document.getElementById('generateReport').disabled = !hasContractors || !hasCodes;
        
        console.log('🔄 Состояние кнопок обновлено:', { hasContractors, hasCodes });
    }

    // УЛУЧШЕННЫЙ ЗАПУСК КАМЕРЫ ДЛЯ CHROME ANDROID
    async startCamera() {
        console.log('📷 Запускаем камеру в Chrome Android...');
        
        if (this.isScanning) {
            console.log('⚠️ Камера уже запущена');
            return;
        }

        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }

        try {
            // ПРОВЕРЯЕМ БРАУЗЕР
            const isChromeAndroid = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent);
            console.log('🌐 Браузер:', navigator.userAgent);
            console.log('📱 Chrome на Android:', isChromeAndroid);

            // ПРОВЕРЯЕМ ДОСТУПНОСТЬ БИБЛИОТЕКИ
            if (typeof Html5Qrcode === 'undefined') {
                await loadHtml5QrCode();
            }

            // Останавливаем предыдущую камеру
            await this.stopCamera();

            const container = document.getElementById('reader');
            if (!container) {
                throw new Error('Контейнер для камеры не найден');
            }

            // ОЧИЩАЕМ КОНТЕЙНЕР ДЛЯ CHROME
            container.innerHTML = '';
            
            this.scanner = new Html5Qrcode("reader");
            
            // ОСОБАЯ КОНФИГУРАЦИЯ ДЛЯ CHROME ANDROID
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_QR_CODE],
                videoConstraints: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "environment"
                }
            };

            console.log('🎯 Начинаем запуск камеры...');

            let cameraStarted = false;
            let lastError = null;

            // СПИСОК ПРИОРИТЕТОВ ДЛЯ CHROME ANDROID
            const cameraConfigs = [
                { facingMode: "environment", description: "Задняя камера" },
                { facingMode: "user", description: "Передняя камера" },
                { deviceId: "environment", description: "Задняя камера (по ID)" },
                { deviceId: "user", description: "Передняя камера (по ID)" }
            ];

            // ПОЛУЧАЕМ СПИСОК ДОСТУПНЫХ КАМЕР ДЛЯ CHROME
            if (isChromeAndroid) {
                try {
                    const devices = await Html5Qrcode.getCameras();
                    console.log('📸 Доступные камеры:', devices);
                    
                    // ДОБАВЛЯЕМ КОНКРЕТНЫЕ КАМЕРЫ В СПИСОК
                    devices.forEach(device => {
                        cameraConfigs.push({
                            deviceId: device.id,
                            description: `Камера: ${device.label || device.id}`
                        });
                    });
                } catch (error) {
                    console.log('⚠️ Не удалось получить список камер:', error);
                }
            }

            // ПРОБУЕМ ВСЕ ВАРИАНТЫ
            for (let i = 0; i < cameraConfigs.length; i++) {
                const cameraConfig = cameraConfigs[i];
                console.log(`🔄 Попытка ${i + 1}: ${cameraConfig.description}`);
                
                try {
                    if (cameraConfig.deviceId) {
                        // ЗАПУСК ПО ID КАМЕРЫ (для Chrome)
                        await this.scanner.start(
                            cameraConfig.deviceId,
                            config,
                            (decodedText) => {
                                console.log('✅ QR-код распознан:', decodedText);
                                this.onScanSuccess(decodedText);
                            },
                            (errorMessage) => {
                                // Игнорируем ошибки сканирования
                            }
                        );
                    } else {
                        // ЗАПУСК ПО facingMode
                        await this.scanner.start(
                            { facingMode: cameraConfig.facingMode },
                            config,
                            (decodedText) => {
                                console.log('✅ QR-код распознан:', decodedText);
                                this.onScanSuccess(decodedText);
                            },
                            (errorMessage) => {
                                // Игнорируем ошибки сканирования
                            }
                        );
                    }
                    
                    cameraStarted = true;
                    console.log(`✅ Успех: ${cameraConfig.description}`);
                    break;
                    
                } catch (error) {
                    lastError = error;
                    console.log(`❌ Не удалось: ${cameraConfig.description}`, error.message);
                    
                    // ОСТАНАВЛИВАЕМ ПРЕДЫДУЩУЮ ПОПЫТКУ
                    if (this.scanner) {
                        try {
                            await this.scanner.stop();
                        } catch (e) {
                            // Игнорируем ошибки остановки
                        }
                    }
                    
                    // ЖДЕМ ПЕРЕД СЛЕДУЮЩЕЙ ПОПЫТКОЙ
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (cameraStarted) {
                this.isScanning = true;
                
                // ОБНОВЛЯЕМ ИНТЕРФЕЙС
                document.getElementById('startCamera').classList.add('hidden');
                document.getElementById('stopCamera').classList.remove('hidden');
                
                // СКРЫВАЕМ ПЛЕЙСХОЛДЕР
                this.hideScannerPlaceholder();
                
                console.log('🎉 Камера успешно запущена в Chrome Android!');
                showSuccess('📷 Камера запущена! Наведите на QR-код', 3000);
                
            } else {
                throw lastError || new Error('Не удалось запустить ни одну камеру');
            }

        } catch (error) {
            console.error('❌ Финальная ошибка запуска камеры:', error);
            
            let message = this.getCameraErrorMessage(error);
            showError(message);
            
            // ПОКАЗЫВАЕМ ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ДЛЯ CHROME
            if (/Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)) {
                this.showChromeAndroidInstructions();
            }
            
            this.showSimulator();
        }
    }

    // СКРЫТИЕ ПЛЕЙСХОЛДЕРА
    hideScannerPlaceholder() {
        const overlay = document.querySelector('.scanner-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // ПОКАЗ ПЛЕЙСХОЛДЕРА
    showScannerPlaceholder() {
        const overlay = document.querySelector('.scanner-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    // ПОЛУЧЕНИЕ ЧЕЛОВЕКО-ЧИТАЕМОГО СООБЩЕНИЯ ОБ ОШИБКЕ
    getCameraErrorMessage(error) {
        if (error.message.includes('NotAllowedError')) {
            return `📷 Доступ к камере запрещен

Для разрешения доступа:
1. Нажмите на значок 🔒 в адресной строке
2. Выберите "Разрешить доступ к камере" 
3. Перезагрузите страницу

Или в настройках Chrome:
• Настройки → Конфиденциальность → Настройки сайта → Камера
• Разрешите доступ для этого сайта`;
                        
        } else if (error.message.includes('NotFoundError')) {
            return '📷 Камера не найдена на устройстве';
            
        } else if (error.message.includes('NotSupportedError')) {
            return '📷 Ваш браузер не поддерживает сканирование QR-кодов';
            
        } else if (error.message.includes('NotReadableError')) {
            return `📷 Камера занята другим приложением

Закройте другие приложения, использующие камеру:
• Другие браузеры
• Приложения камеры
• Видео-приложения`;
                        
        } else if (error.message.includes('OverconstrainedError')) {
            return '📷 Запрошенные настройки камеры не поддерживаются';
            
        } else {
            return `📷 Ошибка камеры: ${error.message}`;
        }
    }

    async stopCamera() {
        if (this._stopInProgress) {
            console.log('⚠️ Остановка камеры уже выполняется...');
            return;
        }
        
        if (this._cleanupTimeout) {
            clearTimeout(this._cleanupTimeout);
            this._cleanupTimeout = null;
        }

        console.log('🧹 Начинаем полную очистку камеры...');
        
        // ФЛАГ ОЧИСТКИ
        this.cleaningUp = true;
        this._stopInProgress = true;

        try {
            // 1. ОСТАНАВЛИВАЕМ СКАНЕР
            if (this.scanner) {
                console.log('🛑 Останавливаем сканер...');
                try {
                    await this.scanner.stop();
                } catch (error) {
                    console.log('⚠️ Мягкая остановка не сработала:', error.message);
                }
                
                // ОЧИЩАЕМ ССЫЛКУ
                this.scanner = null;
            }
            
            // 2. ОСТАНАВЛИВАЕМ ВСЕ ВИДЕО ПОТОКИ
            console.log('🎥 Останавливаем все видео потоки...');
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                try {
                    video.pause();
                    video.srcObject = null;
                    video.load();
                } catch (e) {
                    console.log('⚠️ Ошибка остановки видео:', e);
                }
            });
            
            // 3. ОЧИЩАЕМ КОНТЕЙНЕР
            console.log('🗑️ Очищаем контейнер...');
            const container = document.getElementById('reader');
            if (container) {
                const overlay = container.querySelector('.scanner-overlay');
                container.innerHTML = '';
                
                if (overlay) {
                    container.appendChild(overlay);
                    overlay.style.display = 'flex';
                } else {
                    container.innerHTML = `
                        <div class="scanner-overlay">
                            <span class="placeholder-icon">📷</span>
                            <p>Камера остановлена. Нажмите "Включить камеру"</p>
                            <div class="scanner-frame"></div>
                        </div>
                    `;
                }
            }
            
            // 4. СБРАСЫВАЕМ СОСТОЯНИЕ
            this.isScanning = false;
            this.scanner = null;
            
            // 5. ОБНОВЛЯЕМ ИНТЕРФЕЙС
            document.getElementById('startCamera').classList.remove('hidden');
            document.getElementById('stopCamera').classList.add('hidden');
            
            console.log('✅ Камера полностью очищена');
            
        } catch (error) {
            console.error('❌ Критическая ошибка при очистке камеры:', error);
        } finally {
            this.cleaningUp = false;
            this._stopInProgress = false;
        }
    }

    // ОБРАБОТКА УСПЕШНОГО СКАНИРОВАНИЯ
    onScanSuccess(decodedText) {
        if (this.selectedContractors.length === 0) {
            showError('❌ Сначала выберите контрагентов');
            return;
        }

        if (appState.hasCodeBeenScanned(decodedText)) {
            showWarning('⚠️ Этот код уже отсканирован');
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
        
        showSuccess(`✅ Код добавлен для ${this.selectedContractors.length} контрагентов`, 2000);
    }

    // ДОБАВЛЕНИЕ КОДА В СПИСОК
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

    // УДАЛЕНИЕ КОДА
    removeCode(code) {
        appState.removeScannedCode(code);
        this.updateUI();
        showWarning('Код удален', 2000);
    }

    // ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
    updateUI() {
        const codesCount = appState.getCurrentSession().scannedCodes.length;
        document.getElementById('totalCodes').textContent = codesCount;
        document.getElementById('codesCount').textContent = codesCount;
        
        this.updateButtonStates();
        this.updateSessionStatus();
        this.updateCodesList();
    }

    updateCodesList() {
        const codesList = document.getElementById('codesList');
        const codes = appState.getCurrentSession().scannedCodes;
        
        if (codes.length === 0) {
            codesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>Нет отсканированных кодов</p>
                    <small>Начните сканирование или используйте симулятор</small>
                </div>
            `;
        }
    }

    // ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ СОБЫТИЙ
    attachEventListeners() {
        console.log('🔧 Подключаем обработчики событий');
        
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera());
        document.getElementById('showSimulator').addEventListener('click', () => this.showSimulator());
        document.getElementById('generateReport').addEventListener('click', () => this.generateReport());
        document.getElementById('clearSession').addEventListener('click', () => this.clearSession());
        document.getElementById('addManualContractorBtn').addEventListener('click', () => {
            console.log('🔄 Кнопка "Добавить вручную" нажата');
            this.showAddContractorForm();
        });

        document.getElementById('importContractorsBtn').addEventListener('click', () => {
            console.log('🔄 Кнопка "Импорт из Excel/CSV" нажата');
            this.showImportForm();
        });

        console.log('✅ Обработчики событий подключены');
    }

    // ВОССТАНОВЛЕНИЕ СЕССИИ
    checkExistingSession() {
        try {
            // ВОССТАНАВЛИВАЕМ ВЫБРАННЫХ КОНТРАГЕНТОВ
            const saved = JSON.parse(localStorage.getItem('honest_sign_selected_contractors') || '{}');
            if (saved.contractorIds) {
                this.selectedContractors = saved.contractorIds.map(id => 
                    this.allContractors.find(c => c.id === id)
                ).filter(c => c);
                this.updateSelectedContractorsUI();
            }

            // ВОССТАНАВЛИВАЕМ ОТСКАНИРОВАННЫЕ КОДЫ
            const session = appState.getCurrentSession();
            if (session.scannedCodes.length > 0) {
                session.scannedCodes.forEach(code => this.addCodeToList(code));
                this.updateUI();
            }
            
            this.updateButtonStates();
            this.updateSessionStatus();
            
            console.log('✅ Сессия восстановлена');
            
        } catch (error) {
            console.error('❌ Ошибка восстановления сессии:', error);
        }
    }

    // СОЗДАНИЕ ОТЧЕТА
    async generateReport() {
        const session = appState.getCurrentSession();
        
        if (session.scannedCodes.length === 0) {
            showError('❌ Нет кодов для отчета');
            return;
        }

        if (this.selectedContractors.length === 0) {
            showError('❌ Нет выбранных контрагентов');
            return;
        }

        try {
            const report = {
                id: session.id,
                contractorName: this.selectedContractors.map(c => c.name).join(', '),
                contractors: this.selectedContractors,
                codes: session.scannedCodes,
                createdAt: new Date().toISOString(),
                status: 'pending'
            };

            // СОХРАНЯЕМ ОТЧЕТ
            appState.saveReport(report);
            
            showSuccess(`✅ Отчет создан! Кодов: ${session.scannedCodes.length}`, 5000);
            this.clearSession();
            
        } catch (error) {
            console.error('❌ Ошибка создания отчета:', error);
            showError('Ошибка создания отчета');
        }
    }

    // ОЧИСТКА СЕССИИ
    clearSession() {
        this.stopCamera();
        appState.clearCurrentSession();
        this.selectedContractors = [];
        this.updateSelectedContractorsUI();
        this.updateUI();
        showWarning('🗑️ Сессия очищена', 3000);
    }

    // СОХРАНЕНИЕ КОНТРАГЕНТОВ В ХРАНИЛИЩЕ
    saveContractors() {
        console.log('💾 Сохранение контрагентов в localStorage...');
        console.log('- Количество контрагентов:', this.allContractors.length);
        
        try {
            localStorage.setItem('honest_sign_contractors', JSON.stringify(this.allContractors));
            
            // Проверяем сохранение
            const saved = localStorage.getItem('honest_sign_contractors');
            const parsed = JSON.parse(saved);
            console.log('- Проверка сохранения:', parsed.length === this.allContractors.length ? '✅ Успешно' : '❌ Ошибка');
            console.log('- Сохранено контрагентов:', parsed.length);
            
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
        }
    }

    // ВОССТАНОВЛЕНИЕ КАМЕРЫ ПРИ ПОВТОРНОМ ЗАХОДЕ
    async restoreCameraState() {
        console.log('🔁 Проверяем состояние камеры...');
        
        try {
            // Проверяем поддержку mediaDevices
            if (!navigator.mediaDevices) {
                console.warn('⚠️ mediaDevices не поддерживается в этом браузере');
                addToConsole('❌ mediaDevices не поддерживается - используйте современный браузер');
                return false;
            }
            
            if (!navigator.mediaDevices.enumerateDevices) {
                console.warn('⚠️ enumerateDevices не поддерживается');
                addToConsole('❌ enumerateDevices не поддерживается');
                return false;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('📸 Доступные видеоустройства:', videoDevices.length);
            addToConsole(`📸 Найдено камер: ${videoDevices.length}`);
            
            if (videoDevices.length === 0) {
                console.warn('⚠️ Видеоустройства не найдены');
                addToConsole('❌ Камеры не найдены - проверьте разрешения');
                return false;
            }
            
            // Пробуем получить доступ к камере
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                
                // Останавливаем тестовый поток
                stream.getTracks().forEach(track => track.stop());
                
                console.log('✅ Камера доступна для запуска');
                addToConsole('✅ Камера доступна!');
                return true;
                
            } catch (error) {
                console.warn('⚠️ Нет разрешения на камеру:', error.message);
                addToConsole(`❌ Нет разрешения: ${error.message}`);
                
                // Показываем инструкции для мобильных
                if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                    this.showMobileCameraInstructions();
                }
                
                return false;
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки камеры:', error);
            addToConsole(`❌ Ошибка проверки: ${error.message}`);
            return false;
        }
    }
    
    // Добавьте метод для мобильных инструкций
    showMobileCameraInstructions() {
        const instructions = `
    <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 15px 0;">
        <h4 style="color: #155724; margin-top: 0;">📱 Как разрешить камеру на мобильном:</h4>
        <ol style="color: #155724; margin-bottom: 0;">
            <li>Нажмите на значок <strong>🔒</strong> в адресной строке</li>
            <li>Выберите <strong>"Разрешить"</strong> для доступа к камере</li>
            <li>Или в настройках браузера → Сайты → Камера</li>
            <li>Найдите этот сайт и разрешите доступ</li>
            <li><strong>Перезагрузите страницу</strong></li>
        </ol>
    </div>
        `;
        
        const scanControls = document.querySelector('.scan-controls');
        if (scanControls && !document.getElementById('mobileCameraInstructions')) {
            const instructionsDiv = document.createElement('div');
            instructionsDiv.id = 'mobileCameraInstructions';
            instructionsDiv.innerHTML = instructions;
            scanControls.parentNode.insertBefore(instructionsDiv, scanControls.nextSibling);
        }
    }

    // ИНСТРУКЦИИ ДЛЯ CHROME ANDROID
    showChromeAndroidInstructions() {
        const instructions = `
<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0;">
    <h4 style="color: #856404; margin-top: 0;">📱 Инструкция для Chrome на Android</h4>
    <ol style="color: #856404; margin-bottom: 0;">
        <li>Откройте <strong>Настройки Chrome</strong></li>
        <li>Перейдите в <strong>Настройки сайта</strong></li>
        <li>Выберите <strong>Камера</strong></li>
        <li>Разрешите доступ для этого сайта</li>
        <li>Перезагрузите страницу</li>
    </ol>
</div>
        `;
        
        // Добавляем инструкции под кнопками сканирования
        const scanControls = document.querySelector('.scan-controls');
        if (scanControls && !document.getElementById('chromeInstructions')) {
            const instructionsDiv = document.createElement('div');
            instructionsDiv.id = 'chromeInstructions';
            instructionsDiv.innerHTML = instructions;
            scanControls.parentNode.insertBefore(instructionsDiv, scanControls.nextSibling);
        }
    }
}

// ИНИЦИАЛИЗАЦИЯ
let scannerManager;
document.addEventListener('DOMContentLoaded', () => {
    scannerManager = new ScannerManager();
    console.log('✅ ScannerManager полностью инициализирован');
});
