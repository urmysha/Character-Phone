// character-phone-extension.js

// Dòng này rất quan trọng. Nó "nhập khẩu" class LLMProcessor từ tệp chúng ta vừa tạo.
import { LLMProcessor } from './llm-processor.js';

const DEBUG = true;

function log(...args) {
    if (DEBUG) console.log('[CharacterPhone]', ...args);
}

// ==========================================
// MAIN EXTENSION CLASS
// ==========================================
class CharacterPhoneExtension {
    constructor() {
        this.context = null;
        this.llmProcessor = null;
        this.phoneData = null;
        this.currentCharacterId = null;
        this.phoneButton = null;
        this.isPhoneOpen = false;
        this.isGeneratingData = false;
        this.lastGeneratedCharacterId = null;
        this.lastGenerationTime = null;
        this.cachedMetadata = null;
    }

    async init() {
        log('Initializing Character Phone Extension v7.0...');
        
        try {
            this.context = SillyTavern.getContext();
            
            if (!this.context) {
                throw new Error('Failed to get SillyTavern context');
            }
            
            log('Context obtained successfully');
            log('Context keys:', Object.keys(this.context));
            
            // Ở đây, nó sử dụng LLMProcessor đã được nhập khẩu
            this.llmProcessor = new LLMProcessor(this.context);
            log('LLM Processor initialized');
            
            this.createPhoneButton();
            this.registerEventListeners();
            
            log('✅ Character Phone Extension initialized successfully!');
            log('🆕 Version 7.0 - Incremental Update (NO Auto-Updater)');
            
        } catch (error) {
            console.error('[CharacterPhone] Failed to initialize extension:', error);
            console.error('[CharacterPhone] Error details:', error.stack);
        }
    }

    getCharacterName() {
        const { name2, characters, characterId } = this.context;
        
        if (name2) {
            return name2;
        }
        
        if (characterId !== undefined && characterId !== null && characters && characters[characterId]) {
            return characters[characterId].name || characters[characterId].data?.name || 'Character';
        }
        
        if (this.currentCharacterId !== null && characters && characters[this.currentCharacterId]) {
            return characters[this.currentCharacterId].name || 'Character';
        }
        
        return 'Character';
    }

    createPhoneButton() {
        log('Creating phone button...');
        
        const existingButton = document.getElementById('character-phone-button');
        if (existingButton) {
            log('Button already exists, removing old one');
            existingButton.remove();
        }
        
        const container = document.querySelector('#form_sheld');
        
        if (container) {
            this.createInlineButton();
        } else {
            this.createFloatingButton();
        }
    }

    createInlineButton() {
        log('Creating inline phone button in bottom toolbar...');
        
        const container = document.querySelector('#form_sheld');
        if (!container) {
            log('Container #form_sheld not found, falling back to floating button');
            this.createFloatingButton();
            return;
        }
        
        const button = document.createElement('div');
        button.id = 'character-phone-button';
        button.className = 'character-phone-inline-btn';
        button.title = 'Character Phone';
        button.innerHTML = `<i class="fa-solid fa-mobile-screen-button"></i>`;
        
        const self = this;
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[CharacterPhone] Phone button clicked!');
            
            try {
                if (self.isPhoneOpen) {
                    self.closePhone();
                } else {
                    await self.openPhone();
                }
            } catch (error) {
                console.error('[CharacterPhone] Error handling phone button click:', error);
                toastr.error('Failed to open phone', 'Character Phone');
            }
        });
        
        if (container.firstChild) {
            container.insertBefore(button, container.firstChild);
        } else {
            container.appendChild(button);
        }
        
        this.phoneButton = button;
        log('Phone button created successfully in bottom toolbar');
    }

    createFloatingButton() {
        log('Creating floating phone button as fallback...');
        
        const button = document.createElement('div');
        button.id = 'character-phone-button';
        button.className = 'character-phone-floating-btn';
        button.title = 'Character Phone';
        button.innerHTML = `<i class="fa-solid fa-mobile-screen-button"></i>`;
        
        const self = this;
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[CharacterPhone] Phone button clicked!');
            
            try {
                if (self.isPhoneOpen) {
                    self.closePhone();
                } else {
                    await self.openPhone();
                }
            } catch (error) {
                console.error('[CharacterPhone] Error handling phone button click:', error);
                toastr.error('Failed to open phone', 'Character Phone');
            }
        });
        
        document.body.appendChild(button);
        this.phoneButton = button;
        log('Floating phone button created');
    }

    registerEventListeners() {
        log('Registering event listeners...');
        
        const { eventSource, event_types } = this.context;
        
        setInterval(() => {
            const button = document.getElementById('character-phone-button');
            if (!button) {
                log('⚠️ Phone button missing! Recreating...');
                this.createPhoneButton();
            }
        }, 2000);
        
        eventSource.on(event_types.CHAT_CHANGED, () => {
            log('Chat changed, resetting phone data');
            this.phoneData = null;
            this.currentCharacterId = null;
            this.closePhone();
            
            this.clearLocalStorageCache();
            
            setTimeout(() => {
                this.createPhoneButton();
            }, 500);
        });
        
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => {
            const newCharId = this.context.characterId;
            if (this.currentCharacterId !== null && 
                this.currentCharacterId !== newCharId) {
                log('Character changed, resetting phone data');
                this.phoneData = null;
                this.currentCharacterId = null;
                this.closePhone();
                
                setTimeout(() => {
                    this.createPhoneButton();
                }, 500);
            }
        });
        
        eventSource.on(event_types.MESSAGE_RECEIVED, () => {
            log('Message received, may need to update phone data');
            
            if (!document.getElementById('character-phone-button')) {
                log('Button missing after message, recreating...');
                this.createPhoneButton();
            }
        });
        
        log('Event listeners registered');
    }

    
    async openPhone() {
        log('Opening phone...');
        
        const context = this.context;
        
        this.context = SillyTavern.getContext();
        
        log('Full context check:', {
            characterId: this.context.characterId,
            charactersLength: this.context.characters?.length,
            groupId: this.context.groupId,
            chatId: this.context.chatId,
            name2: this.context.name2,
            charactersAvailable: this.context.characters?.map(c => c.name)
        });
        
        let charId = this.context.characterId;
        
        if (this.isPhoneOpen && this.currentCharacterId === charId && this.phoneData) {
            log('Phone already open for this character, just rendering...');
            this.renderPhoneUI();
            return;
        }
        
        if (this.phoneData && this.currentCharacterId === charId) {
            log('Phone data already loaded for current character');
            this.renderPhoneUI();
            this.isPhoneOpen = true;
            return;
        }
        
        if (charId !== undefined && charId !== null && charId !== '') {
            log('Using characterId from context:', charId);
            this.currentCharacterId = charId;
            await this.loadPhoneData();
            this.renderPhoneUI();
            this.isPhoneOpen = true;
            return;
        }
        
        if (context.groupId === null || context.groupId === undefined) {
            if (context.characters && context.characters.length > 0) {
                charId = 0;
                
                if (context.name2) {
                    const foundIndex = context.characters.findIndex(c => c.name === context.name2);
                    if (foundIndex !== -1) {
                        charId = foundIndex;
                        log('Found character by name2:', context.name2, 'at index:', charId);
                    }
                }
                
                this.currentCharacterId = charId;
                log('Using character at index:', charId);
                await this.loadPhoneData();
                this.renderPhoneUI();
                this.isPhoneOpen = true;
                return;
            }
        }
        
        if (context.groupId !== null && context.groupId !== undefined) {
            toastr.warning('Character Phone does not support group chats yet.', 'Character Phone');
            log('User is in group chat (groupId:', context.groupId, ')');
            return;
        }
        
        log('Could not determine current character after all attempts');
        toastr.warning('Please select a character first by opening a chat!', 'Character Phone');
    }

    closePhone() {
        const phoneModal = document.getElementById('character-phone-modal');
        if (phoneModal) {
            phoneModal.remove();
        }
        this.isPhoneOpen = false;
        log('Phone closed');
    }

    async loadPhoneData() {
        const { chatMetadata, characterId } = this.context;
        
        log('Loading phone data...');
        log('Current characterId:', characterId);
        log('Chat metadata keys:', Object.keys(chatMetadata || {}));
        
        if (chatMetadata && chatMetadata['character_phone']) {
            const cachedMetadata = chatMetadata['character_phone'];
            
            const verifyCharId = characterId !== undefined && characterId !== null ? characterId : this.currentCharacterId;
            if (cachedMetadata.character_id === verifyCharId) {
                log('✅ Loading existing phone data from cache (verified match)');
                
                if (cachedMetadata.phone_data) {
                    this.phoneData = cachedMetadata.phone_data;
                    this.cachedMetadata = cachedMetadata;
                    return;
                } else if (cachedMetadata.messages !== undefined) {
                    this.phoneData = cachedMetadata;
                    this.cachedMetadata = { character_id: verifyCharId, phone_data: cachedMetadata };
                    return;
                }
            } else {
                log('WARNING: Metadata character_id mismatch!');
                log('Metadata character_id:', cachedMetadata.character_id);
                log('Current character_id:', verifyCharId);
                log('Ignoring cached data and regenerating...');
            }
        }
        
        const localBackup = this.loadFromLocalStorage();
        if (localBackup && localBackup.phone_data) {
            const backupCharId = localBackup.phone_data.character_id || localBackup.character_id;
            const verifyCharId = characterId !== undefined && characterId !== null ? characterId : this.currentCharacterId;
            
            if (backupCharId === verifyCharId) {
                log('Restoring phone data from localStorage backup (verified match)');
                
                this.phoneData = localBackup.phone_data.phone_data || localBackup.phone_data;
                
                if (localBackup.history && localBackup.history.length > 0) {
                    const historyKey = 'character_phone' + '_history';
                    chatMetadata[historyKey] = localBackup.history;
                    log('Restored history from localStorage:', localBackup.history.length, 'versions');
                }
                
                await this.savePhoneData();
                return;
            } else {
                log('WARNING: localStorage character_id mismatch!');
                log('Backup character_id:', backupCharId);
                log('Current character_id:', verifyCharId);
            }
        }
        
        log('No valid phone data found, generating initial data...');
        await this.generateInitialPhoneData();
    }

    async generateInitialPhoneData() {
        if (this.isGeneratingData) {
            log('⚠️ Generation already in progress, skipping...');
            return;
        }
        
        if (this.lastGeneratedCharacterId === this.currentCharacterId &&
            this.lastGenerationTime &&
            (Date.now() - this.lastGenerationTime) < 5000) {
            log('⚠️ Character data generated recently, skipping regeneration');
            return;
        }
        
        this.isGeneratingData = true;
        
        try {
            console.log('='.repeat(50));
            console.log('[CharacterPhone] GENERATING INITIAL PHONE DATA');
            console.log('[CharacterPhone] Character ID:', this.currentCharacterId);
            console.log('[CharacterPhone] Context character ID:', this.context.characterId);
            console.log('[CharacterPhone] Character name:', this.getCharacterName());
            console.log('='.repeat(50));
            
            toastr.info('Generating phone data using AI... This may take 10-30 seconds.', 'Character Phone', { 
                timeOut: 5000,
                progressBar: true 
            });
            
            if (this.llmProcessor) {
                log('Using LLM Processor to generate phone data');
                this.phoneData = await this.llmProcessor.generatePhoneData(this.currentCharacterId);
                
                console.log('[CharacterPhone] Phone data generated successfully via LLM');
                console.log('[CharacterPhone] Generated data character_id:', this.phoneData.character_id);
                console.log('[CharacterPhone] Messages count:', this.phoneData.phone_data.messages.length);
                console.log('[CharacterPhone] Notes count:', this.phoneData.phone_data.notes.length);
                
                this.lastGeneratedCharacterId = this.currentCharacterId;
                this.lastGenerationTime = Date.now();
                
            } else {
                log('LLM Processor not available, using dummy data');
                this.phoneData = this.createDummyPhoneData();
                this.lastGeneratedCharacterId = this.currentCharacterId;
                this.lastGenerationTime = Date.now();
            }
            
            await this.savePhoneData();
            
            toastr.success('Phone data generated successfully!', 'Character Phone', { timeOut: 2000 });
            
        } catch (error) {
            console.error('[CharacterPhone] Failed to generate phone data:', error);
            console.error('[CharacterPhone] Error stack:', error.stack);
            toastr.error('Failed to generate AI data. Using fallback.', 'Character Phone');
            
            this.phoneData = this.createDummyPhoneData();
            this.lastGeneratedCharacterId = this.currentCharacterId;
            this.lastGenerationTime = Date.now();
            await this.savePhoneData();
        } finally {
            this.isGeneratingData = false;
        }
    }

    /**
     * 🆕 NEW: Generate INCREMENTAL update (keeps old data + adds new)
     */
    async generateIncrementalUpdate() {
        log('🔄 Starting INCREMENTAL update...');
        
        if (!this.phoneData || !this.phoneData.phone_data) {
            log('❌ No existing phone data, cannot do incremental update');
            toastr.error('No existing data to update', 'Character Phone');
            return;
        }
        
        if (this.isGeneratingData) {
            log('⚠️ Generation already in progress');
            return;
        }
        
        this.isGeneratingData = true;
        
        try {
            const lastMessageIndex = this.phoneData.phone_data.timeline?.last_message_index || 0;
            const currentMessageIndex = this.context.chat ? this.context.chat.length - 1 : 0;
            
            log('📊 Message index check:');
            log('  - Last update at message:', lastMessageIndex);
            log('  - Current message index:', currentMessageIndex);
            
            if (currentMessageIndex <= lastMessageIndex) {
                log('✅ No new messages since last update');
                toastr.info('No new messages to analyze', 'Character Phone', { timeOut: 2000 });
                return;
            }
            
            toastr.info('Analyzing new messages for updates...', 'Character Phone', { 
                timeOut: 5000,
                progressBar: true 
            });
            
            const updates = await this.llmProcessor.generateIncrementalUpdate(
                this.currentCharacterId,
                this.phoneData,
                lastMessageIndex
            );
            
            if (!updates || !updates.has_updates) {
                log('✅ No relevant updates found in new messages');
                toastr.info('No new updates detected', 'Character Phone', { timeOut: 2000 });
                
                // Update message index even if no updates
                this.phoneData.phone_data.timeline.last_message_index = currentMessageIndex;
                await this.savePhoneData();
                return;
            }
            
            log('✅ Found updates! Applying...');
            
            // Apply updates
            this.applyIncrementalUpdates(updates);
            
            // Update timeline
            this.phoneData.phone_data.timeline.last_message_index = currentMessageIndex;
            this.phoneData.phone_data.timeline.last_sync = new Date().toISOString();
            
            await this.savePhoneData();
            
            // Refresh UI if phone is open
            if (this.isPhoneOpen) {
                this.renderPhoneUI();
            }
            
            toastr.success('Phone data updated!', 'Character Phone', { timeOut: 2000 });
            
            log('📱 Update summary:');
            log('  - New messages:', updates.new_messages?.length || 0);
            log('  - New searches:', updates.new_browser_history?.length || 0);
            log('  - New transactions:', updates.new_transactions?.length || 0);
            log('  - New notes:', updates.new_notes?.length || 0);
            log('  - New locations:', updates.new_locations?.length || 0);
            
        } catch (error) {
            console.error('[CharacterPhone] Failed to generate incremental update:', error);
            toastr.error('Failed to update phone data', 'Character Phone');
        } finally {
            this.isGeneratingData = false;
        }
    }

    /**
     * 🆕 NEW: Apply incremental updates to existing data
     */
    applyIncrementalUpdates(updates) {
        log('[CharacterPhone] Applying incremental updates...');
        
        // Add new messages
        if (updates.new_messages && updates.new_messages.length > 0) {
            updates.new_messages.forEach(newMsg => {
                // Check if contact already exists
                const existingMsg = this.phoneData.phone_data.messages.find(
                    m => m.contact_name.toLowerCase() === newMsg.contact_name.toLowerCase()
                );
                
                if (existingMsg) {
                    // Append to existing thread
                    existingMsg.thread.push(...newMsg.thread);
                    existingMsg.last_message_time = newMsg.last_message_time;
                    existingMsg.unread_count += newMsg.unread_count;
                    log('  ✅ Updated existing conversation with:', newMsg.contact_name);
                } else {
                    // Add as new conversation
                    newMsg.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    this.phoneData.phone_data.messages.push(newMsg);
                    log('  ✅ Added new conversation with:', newMsg.contact_name);
                }
            });
        }
        
        // Add new browser history
        if (updates.new_browser_history && updates.new_browser_history.length > 0) {
            updates.new_browser_history.forEach(search => {
                search.id = `browse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.phoneData.phone_data.browser_history.push(search);
                log('  ✅ Added browser search:', search.title);
            });
        }
        
        // Add new transactions
        if (updates.new_transactions && updates.new_transactions.length > 0) {
            updates.new_transactions.forEach(trans => {
                trans.id = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.phoneData.phone_data.wallet.transactions.push(trans);
                
                // Update balance
                this.phoneData.phone_data.wallet.balance += trans.amount;
                
                log('  ✅ Added transaction:', trans.note, '-', trans.amount);
            });
        }
        
        // Add new notes
        if (updates.new_notes && updates.new_notes.length > 0) {
            updates.new_notes.forEach(note => {
                note.id = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.phoneData.phone_data.notes.push(note);
                log('  ✅ Added note:', note.title);
            });
        }
        
        // Add new locations
        if (updates.new_locations && updates.new_locations.length > 0) {
            updates.new_locations.forEach(loc => {
                loc.id = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.phoneData.phone_data.location_history.push(loc);
                log('  ✅ Added location:', loc.from, '→', loc.to);
            });
        }
        
        log('[CharacterPhone] ✅ All updates applied successfully');
    }

    createDummyPhoneData() {
        const now = new Date().toISOString();
        
        console.log('[CharacterPhone] Creating dummy data...');
        console.log('[CharacterPhone] currentCharacterId:', this.currentCharacterId);
        console.log('[CharacterPhone] context.characterId:', this.context.characterId);
        
        const charName = this.getCharacterName();
        
        log('Creating dummy data for character:', charName);
        
        if (charName === 'Character' || 
            charName === 'SillyTavern System' || 
            charName.includes('System')) {
            console.warn('[CharacterPhone] WARNING: Using fallback/system name for dummy data!');
        }
        
        const dummyData = {
            messages: [
                {
                    id: "msg_001",
                    contact_name: "Friend",
                    contact_type: "npc",
                    thread: [
                        { sender: "Friend", content: "Hey! How are you?", timestamp: now, read: true },
                        { sender: charName, content: "I'm good, thanks!", timestamp: now, read: true }
                    ],
                    last_message_time: now,
                    unread_count: 0
                }
            ],
            browser_history: [
                { id: "browse_001", url: "www.example.com", title: "Example Search", timestamp: now, reason: "Looking for information", category: "general" }
            ],
            wallet: {
                balance: 1000.00,
                currency: "USD",
                transactions: [
                    { id: "trans_001", type: "expense", amount: -50.00, category: "food", merchant: "Coffee Shop", note: "Morning coffee", timestamp: now, location: "Downtown" }
                ]
            },
            notes: [
                { id: "note_001", title: "Todo", content: "Remember to check messages", created_at: now, updated_at: now, category: "personal", pinned: false }
            ],
            location_history: [
                { id: "loc_001", from: "Home", to: "Work", departure_time: now, arrival_time: now, travel_mode: "car", purpose: "Commute", route: ["Home", "Work"] }
            ]
        };
        
        return {
            character_id: this.currentCharacterId,
            phone_data: {
                ...dummyData,
                phone_settings: {
                    theme: 'dark',
                    wallpaper: 'default',
                    last_opened: now
                },
                timeline: {
                    current_time: now,
                    last_sync: now,
                    last_message_index: this.context.chat ? this.context.chat.length - 1 : 0
                }
            }
        };
    }

    async savePhoneData() {
        const { chatMetadata, saveMetadata } = this.context;
        
        if (!this.phoneData) {
            log('No phone data to save');
            return;
        }
        
        log('Saving phone data to chat metadata...');
        
        const metadataToSave = {
            character_id: this.currentCharacterId || this.context.characterId,
            phone_data: this.phoneData,
            generated_at: new Date().toISOString(),
            version: 1
        };
        
        chatMetadata['character_phone'] = metadataToSave;
        
        const historyKey = 'character_phone' + '_history';
        if (!chatMetadata[historyKey]) {
            chatMetadata[historyKey] = [];
        }
        
        const historyEntry = {
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(this.phoneData)),
            version: chatMetadata[historyKey].length + 1
        };
        
        chatMetadata[historyKey].push(historyEntry);
        
        if (chatMetadata[historyKey].length > 10) {
            chatMetadata[historyKey] = chatMetadata[historyKey].slice(-10);
        }
        
        try {
            await saveMetadata();
            log('✅ Phone data saved successfully with version:', historyEntry.version);
            this.saveToLocalStorage();
        } catch (error) {
            console.error('[CharacterPhone] Failed to save metadata:', error);
        }
    }

    saveToLocalStorage() {
        try {
            const { characterId } = this.context;
            const key = `character_phone_${characterId}`;
            
            const dataToSave = {
                phone_data: this.phoneData,
                history: this.loadPhoneDataHistory(),
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(key, JSON.stringify(dataToSave));
            log('Phone data backed up to localStorage');
        } catch (error) {
            console.error('[CharacterPhone] Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const { characterId } = this.context;
            const key = `character_phone_${characterId}`;
            
            const saved = localStorage.getItem(key);
            if (saved) {
                const data = JSON.parse(saved);
                log('Phone data loaded from localStorage backup');
                return data;
            }
        } catch (error) {
            console.error('[CharacterPhone] Failed to load from localStorage:', error);
        }
        
        return null;
    }

    clearLocalStorageCache() {
        try {
            if (this.currentCharacterId !== null) {
                const key = `character_phone_${this.currentCharacterId}`;
                localStorage.removeItem(key);
                log('Cleared localStorage cache for character:', this.currentCharacterId);
            }
        } catch (error) {
            console.error('[CharacterPhone] Failed to clear localStorage:', error);
        }
    }

    loadPhoneDataHistory() {
        const { chatMetadata } = this.context;
        const historyKey = 'character_phone' + '_history';
        
        let history = [];
        
        if (chatMetadata[historyKey] && chatMetadata[historyKey].length > 0) {
            history = chatMetadata[historyKey];
        }
        
        if (history.length === 0) {
            const localBackup = this.loadFromLocalStorage();
            if (localBackup && localBackup.history && localBackup.history.length > 0) {
                history = localBackup.history;
                log('Loaded history from localStorage backup:', history.length, 'versions');
            }
        }
        
        return history;
    }

    async restorePhoneDataVersion(versionIndex) {
        const history = this.loadPhoneDataHistory();
        
        if (versionIndex < 0 || versionIndex >= history.length) {
            toastr.error('Invalid version index', 'Character Phone');
            return;
        }
        
        const version = history[versionIndex];
        this.phoneData = JSON.parse(JSON.stringify(version.data));
        
        log('Restored phone data from version:', version.version);
        toastr.success(`Restored to version ${version.version}`, 'Character Phone', { timeOut: 2000 });
        
        if (this.isPhoneOpen) {
            this.renderPhoneUI();
        }
    }

    sortByTimestamp(array, timestampField = 'timestamp') {
        return array.sort((a, b) => {
            const timeA = new Date(a[timestampField]).getTime();
            const timeB = new Date(b[timestampField]).getTime();
            return timeB - timeA;
        });
    }

    sortByTimestampOldest(array, timestampField = 'timestamp') {
        return array.sort((a, b) => {
            const timeA = new Date(a[timestampField]).getTime();
            const timeB = new Date(b[timestampField]).getTime();
            return timeA - timeB;
        });
    }

    renderPhoneUI() {
        log('Rendering phone UI...');
        
        this.closePhone();
        
        const modal = document.createElement('div');
        modal.id = 'character-phone-modal';
        modal.className = 'character-phone-modal';
        
        modal.innerHTML = `
            <div class="phone-modal-backdrop" onclick="window.characterPhone.closePhone()"></div>
            <div class="phone-container">
                <div class="phone-frame">
                    <div class="phone-header">
                        <div class="phone-status-bar">
                            <span class="phone-time">${this.getCurrentTime()}</span>
                            <div class="phone-status-icons">
                                <span>📶</span>
                                <span>🔋</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="phone-screen" id="phone-screen">
                        ${this.renderHomeScreen()}
                    </div>
                    
                    <div class="phone-controls">
                        <button class="phone-home-btn" onclick="window.characterPhone.showHomeScreen()">
                            <div class="home-indicator"></div>
                        </button>
                    </div>
                </div>
                
                <button class="phone-close-btn" onclick="window.characterPhone.closePhone()">
                    ✕
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        log('Phone UI rendered successfully');
    }

    renderHomeScreen() {
        if (!this.phoneData || !this.phoneData.phone_data) {
            log('⚠️ phoneData not ready, showing placeholder');
            return `
                <div style="padding: 20px; text-align: center; color: #999;">
                    <p>Loading phone data...</p>
                </div>
            `;
        }
        
        const notesCount = this.phoneData.phone_data.notes ? this.phoneData.phone_data.notes.length : 0;
        const historyCount = this.loadPhoneDataHistory().length;
        
        const apps = [
            { id: 'messages', icon: '💬', label: 'Messages', badge: this.getUnreadMessagesCount() },
            { id: 'browser', icon: '🌐', label: 'Browser', badge: 0 },
            { id: 'wallet', icon: '💳', label: 'Wallet', badge: 0 },
            { id: 'notes', icon: '📝', label: 'Notes', badge: notesCount },
            { id: 'maps', icon: '🗺️', label: 'Maps', badge: 0 },
            { id: 'settings', icon: '⚙️', label: 'Settings', badge: 0 },
            { id: 'history', icon: '🕐', label: 'History', badge: historyCount },
            { id: 'update', icon: '🔄', label: 'Update', badge: 0, isAction: true }
        ];
        
        let appsHTML = apps.map(app => `
            <div class="phone-app" onclick="window.characterPhone.openApp('${app.id}')">
                <div class="app-icon">
                    <span class="app-icon-emoji">${app.icon}</span>
                    ${app.badge > 0 ? `<span class="app-badge">${app.badge}</span>` : ''}
                </div>
                <div class="app-label">${app.label}</div>
            </div>
        `).join('');
        
        return `
            <div class="phone-homescreen">
                <div class="phone-wallpaper"></div>
                ${this.renderClockWidget()}
                <div class="app-grid">
                    ${appsHTML}
                </div>
            </div>
        `;
    }

        renderClockWidget() {
        const now = new Date();

        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdayName = weekdays[now.getDay()];

        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = months[now.getMonth()];
        const day = now.getDate();
        const year = now.getFullYear();

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        return `
            <div class="phone-clock-widget">
                <div class="clock-date">
                <div class="clock-weekday">${weekdayName}</div>
                <div class="clock-full-date">${monthName} ${day}, ${year}</div>
            </div>
            <div class="clock-time-display">
                <div class="clock-time">${hours}:${minutes}</div>
            </div>
    </div>
`;
}

    showHomeScreen() {
        const screen = document.getElementById('phone-screen');
        if (screen) {
            screen.innerHTML = this.renderHomeScreen();
        }
    }

    openApp(appId) {
        if (!this.phoneData || !this.phoneData.phone_data) {
            log('⚠️ phoneData not ready for app:', appId);
            toastr.warning('Phone data still loading...', 'Character Phone', { timeOut: 2000 });
            return;
        }
        
        log(`Opening app: ${appId}`);
        
        const screen = document.getElementById('phone-screen');
        if (!screen) return;
        
        let appContent = '';
        
        switch(appId) {
            case 'messages':
                appContent = this.renderMessagesApp();
                break;
            case 'browser':
                appContent = this.renderBrowserApp();
                break;
            case 'wallet':
                appContent = this.renderWalletApp();
                break;
            case 'notes':
                appContent = this.renderNotesApp();
                break;
            case 'maps':
                appContent = this.renderMapsApp();
                break;
            case 'settings':
                appContent = this.renderSettingsApp();
                break;
            case 'history':
                appContent = this.renderHistoryApp();
                break;
            case 'update':
                this.refreshPhoneData();
                return;
            default:
                appContent = '<div class="app-container"><p style="color: white; padding: 20px;">App not implemented yet</p></div>';
        }
        
        screen.innerHTML = appContent;
    }

    renderMessagesApp() {
        if (!this.phoneData?.phone_data?.messages) {
            return '<div class="app-container"><p style="color: #999; padding: 20px;">No messages</p></div>';
        }
        
        const messages = this.phoneData.phone_data.messages;
        
        const sortedMessages = this.sortByTimestamp([...messages], 'last_message_time');
        
        let messagesHTML = sortedMessages.map(msg => {
            const lastMsg = msg.thread[msg.thread.length - 1];
            return `
                <div class="message-item" onclick="window.characterPhone.openMessageThread('${msg.id}')">
                    <div class="message-avatar">${msg.contact_name.charAt(0)}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-contact">${msg.contact_name}</span>
                            <span class="message-time">${this.formatTime(lastMsg.timestamp)}</span>
                        </div>
                        <div class="message-preview">${lastMsg.content}</div>
                    </div>
                    ${msg.unread_count > 0 ? `<span class="message-unread-badge">${msg.unread_count}</span>` : ''}
                    <button class="message-delete-btn" 
                            onclick="event.stopPropagation(); window.characterPhone.deleteMessage('${msg.id}')">
                        x️
                    </button>
                </div>
            `;
        }).join('');
        
        return `
            <div class="app-container messages-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>Messages</h2>
                </div>
                <div class="app-content">
                    ${messagesHTML}
                </div>
            </div>
        `;
    }

    async openMessageThread(messageId) {
        const message = this.phoneData.phone_data.messages.find(m => m.id === messageId);
        if (!message) return;
        
        // ✅ THÊM: Mark as read
        if (message.unread_count > 0) {
            log('📖 Marking conversation as read:', message.contact_name);
            message.unread_count = 0;
    
            // Mark all messages in thread as read
            message.thread.forEach(msg => {
                if (msg.read === false) {
                    msg.read = true;
                }
            });
    
            // Save immediately
            await this.savePhoneData();
    
            // Update home screen badge if visible
            this.updateHomeScreenBadge();
        }
        
        const charName = this.getCharacterName();
        const contactName = message.contact_name;
        
        const threadHTML = message.thread.map(msg => {
            const isFromChar = msg.sender === charName;
            return `
                <div class="message-bubble ${isFromChar ? 'sent' : 'received'}">
                    <div class="message-bubble-sender">${msg.sender}</div>
                    <div class="message-bubble-content">${msg.content}</div>
                    <div class="message-bubble-time">${this.formatTime(msg.timestamp)}</div>
                </div>
            `;
        }).join('');
        
        const screen = document.getElementById('phone-screen');
        screen.innerHTML = `
            <div class="app-container message-thread">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.openApp('messages')">←</button>
                    <h2>${contactName}</h2>
                </div>
                <div class="app-content thread-content">
                    ${threadHTML}
                </div>
            </div>
        `;
    }

    updateHomeScreenBadge() {
        // Update Messages app badge on home screen
        const totalUnread = this.getUnreadMessagesCount();

        // Find Messages icon and update badge
        const homeScreen = document.getElementById('phone-screen');
        if (!homeScreen) return;

        const messagesApp = homeScreen.querySelector('[onclick*="messages"]');
        if (!messagesApp) return;

        // Remove old badge
        const oldBadge = messagesApp.querySelector('.app-badge');
        if (oldBadge) {
            oldBadge.remove();
        }

        // Add new badge if unread > 0
        if (totalUnread > 0) {
            const badge = document.createElement('div');
            badge.className = 'app-badge';
            badge.textContent = totalUnread;
            messagesApp.style.position = 'relative';
            messagesApp.appendChild(badge);
        }

        log('📊 Updated home screen badge:', totalUnread);
    }

        async deleteMessage(messageId) {
            // 1. Confirm trước khi xóa
            const message = this.phoneData.phone_data.messages.find(m => m.id === messageId);
            if (!message) return;

            const confirmed = confirm(`Delete conversation with ${message.contact_name}?`);
            if (!confirmed) return;

            // 2. Xóa message khỏi array
            this.phoneData.phone_data.messages = this.phoneData.phone_data.messages.filter(
                m => m.id !== messageId
            );

            // 3. Save data
            await this.savePhoneData();

            // 4. Refresh UI
            this.openApp('messages');

            // 5. Toast notification
            toastr.success(`Deleted conversation with ${message.contact_name}`, 'Character Phone', { 
            timeOut: 2000 
            });

            log('✅ Deleted message:', messageId);
    }

    renderBrowserApp() {
        if (!this.phoneData?.phone_data?.browser_history) {
            return '<div class="app-container"><p style="color: #999; padding: 20px;">No browser history</p></div>';
        }
        
        const history = this.phoneData.phone_data.browser_history;
        
        const sortedHistory = this.sortByTimestamp([...history], 'timestamp');
        
        let historyHTML = sortedHistory.map(item => `
            <div class="browser-item">
                <div class="browser-icon">🌐</div>
                <div class="browser-content">
                    <div class="browser-title">${item.title}</div>
                    <div class="browser-url">${item.url}</div>
                    <div class="browser-meta">
                        <span class="browser-time">${this.formatTime(item.timestamp)}</span>
                        <span class="browser-category">${item.category}</span>
                    </div>
                    ${item.reason ? `<div class="browser-reason">${item.reason}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        return `
            <div class="app-container browser-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>Browser History</h2>
                </div>
                <div class="app-content">
                    ${historyHTML}
                </div>
            </div>
        `;
    }

    renderWalletApp() {
        if (!this.phoneData?.phone_data?.wallet) {
            return '<div class="app-container"><p style="color: #999; padding: 20px;">No wallet data</p></div>';
        }
        
        const wallet = this.phoneData.phone_data.wallet;
        const transactions = wallet.transactions || [];
        
        const sortedTransactions = this.sortByTimestamp([...transactions], 'timestamp');
        
        const currencySymbol = {
            'VND': '₫',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥'
        }[wallet.currency] || wallet.currency;
        
        let transactionsHTML = sortedTransactions.map(trans => {
            const isExpense = trans.type === 'expense';
            return `
                <div class="wallet-transaction ${isExpense ? 'expense' : 'income'}">
                    <div class="transaction-icon">${isExpense ? '💸' : '💰'}</div>
                    <div class="transaction-content">
                        <div class="transaction-merchant">${trans.merchant}</div>
                        <div class="transaction-note">${trans.note}</div>
                        <div class="transaction-meta">
                            <span class="transaction-category">${trans.category}</span>
                            <span class="transaction-time">${this.formatTime(trans.timestamp)}</span>
                        </div>
                    </div>
                    <div class="transaction-amount ${isExpense ? 'negative' : 'positive'}">
                        ${trans.amount > 0 ? '+' : ''}${trans.amount.toFixed(2).replace(/\.00$/, '')} ${currencySymbol}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="app-container wallet-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>Wallet</h2>
                </div>
                <div class="app-content">
                    <div class="wallet-balance-card">
                        <div class="balance-label">Current Balance</div>
                        <div class="balance-amount">${wallet.balance.toFixed(2).replace(/\.00$/, '')} ${currencySymbol}</div>
                        <div class="balance-currency">${wallet.currency}</div>
                    </div>
                    
                    <div class="wallet-transactions-header">
                        <h3>Recent Transactions</h3>
                    </div>
                    
                    ${transactionsHTML}
                </div>
            </div>
        `;
    }

    renderNotesApp() {
        if (!this.phoneData?.phone_data?.notes) {
            return '<div class="app-container"><p style="color: #999; padding: 20px;">No notes</p></div>';
        }
        
        const notes = this.phoneData.phone_data.notes;
        
        const sortedNotes = this.sortByTimestamp([...notes], 'updated_at');
        
        let notesHTML = sortedNotes.map(note => `
            <div class="note-item" onclick="window.characterPhone.openNoteDetail('${note.id}')">
                <div class="note-header">
                    <div class="note-title">${note.title}</div>
                    ${note.pinned ? '<span class="note-pin">📌</span>' : ''}
                </div>
                <div class="note-preview">${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}</div>
                <div class="note-meta">
                    <span class="note-time">${this.formatTime(note.updated_at)}</span>
                    <span class="note-category">${note.category}</span>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="app-container notes-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>Notes</h2>
                </div>
                <div class="app-content">
                    ${notesHTML}
                </div>
            </div>
        `;
    }

    openNoteDetail(noteId) {
        console.log('[CharacterPhone] Opening note detail:', noteId);
        console.log('[CharacterPhone] Available notes:', this.phoneData.phone_data.notes.map(n => n.id));
        
        const note = this.phoneData.phone_data.notes.find(n => n.id === noteId);
        
        if (!note) {
            console.error('[CharacterPhone] Note not found:', noteId);
            console.log('[CharacterPhone] Available notes:', this.phoneData.phone_data.notes.map(n => n.id));
            toastr.error('Note not found', 'Character Phone');
            return;
        }
        
        console.log('[CharacterPhone] Note found:', note.title);
        
        const screen = document.getElementById('phone-screen');
        screen.innerHTML = `
            <div class="app-container note-detail">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.openApp('notes')">←</button>
                    <h2>Note</h2>
                </div>
                <div class="app-content">
                    <div class="note-detail-container">
                        <div class="note-detail-header">
                            <h3>${note.title}</h3>
                            ${note.pinned ? '<span class="note-pin-large">📌 Pinned</span>' : ''}
                        </div>
                        <div class="note-meta">
                            <span>${this.formatTime(note.updated_at)}</span>
                            <span class="note-category">${note.category}</span>
                        </div>
                        <div class="note-content-full">${note.content.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderMapsApp() {
        if (!this.phoneData?.phone_data?.location_history) {
            return '<div class="app-container"><p style="color: #999; padding: 20px;">No location history</p></div>';
        }
        
        const locations = this.phoneData.phone_data.location_history;
        
        const sortedLocations = this.sortByTimestamp([...locations], 'arrival_time');
        
        let locationsHTML = sortedLocations.map(loc => `
            <div class="location-item">
                <div class="location-icon">📍</div>
                <div class="location-content">
                    <div class="location-route">
                        <span class="location-from">${loc.from}</span>
                        <span class="location-arrow">→</span>
                        <span class="location-to">${loc.to}</span>
                    </div>
                    <div class="location-meta">
                        <span class="location-mode">${this.getModeEmoji(loc.travel_mode)} ${loc.travel_mode}</span>
                        <span class="location-time">${this.formatTime(loc.arrival_time)}</span>
                    </div>
                    <div class="location-purpose">${loc.purpose}</div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="app-container maps-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>Location History</h2>
                </div>
                <div class="app-content">
                    ${locationsHTML}
                </div>
            </div>
        `;
    }

    renderSettingsApp() {
        return `
            <div class="app-container settings-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>Settings</h2>
                </div>
                <div class="app-content">
                    <div class="settings-section">
                        <h3 class="settings-header">💱 Currency</h3>
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Wallet Currency</div>
                                <div class="setting-description">
                                    Choose currency for wallet transactions
                                </div>
                            </div>
                            <select class="setting-select" 
                                    onchange="window.characterPhone.changeCurrency(this.value)">
                                <option value="VND" ${this.phoneData.phone_data.wallet.currency === 'VND' ? 'selected' : ''}>VND (₫)</option>
                                <option value="USD" ${this.phoneData.phone_data.wallet.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                                <option value="EUR" ${this.phoneData.phone_data.wallet.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                                <option value="GBP" ${this.phoneData.phone_data.wallet.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                                <option value="JPY" ${this.phoneData.phone_data.wallet.currency === 'JPY' ? 'selected' : ''}>JPY (¥)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 class="settings-header">🎨 Theme</h3>
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Phone Theme</div>
                                <div class="setting-description">
                                    Choose phone appearance
                                </div>
                            </div>
                            <select class="setting-select"
                                    onchange="window.characterPhone.changeTheme(this.value)">
                                <option value="dark" ${this.phoneData.phone_data.phone_settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${this.phoneData.phone_data.phone_settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 class="settings-header">ℹ️ About</h3>
                        <div class="setting-info-box">
                            <strong>Character Phone Extension</strong><br>
                            Version 7.0 - Incremental Update<br><br>
                            Created for SillyTavern<br>
                            🆕 Now with smart incremental updates!<br><br>
                            Click "Update" 🔄 to analyze new messages<br>
                            and add new data without losing old content
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async changeCurrency(currency) {
        this.phoneData.phone_data.wallet.currency = currency;
        await this.savePhoneData();
        toastr.success(`Currency changed to ${currency}`, 'Character Phone', { timeOut: 2000 });
        log('Currency changed to:', currency);
    }

    async changeTheme(theme) {
        this.phoneData.phone_data.phone_settings.theme = theme;
        await this.savePhoneData();
        toastr.success(`Theme changed to ${theme}`, 'Character Phone', { timeOut: 2000 });
        log('Theme changed to:', theme);
    }

    renderHistoryApp() {
        const history = this.loadPhoneDataHistory();
        
        if (history.length === 0) {
            return `
                <div class="app-container history-app">
                    <div class="app-header">
                        <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                        <h2>History</h2>
                    </div>
                    <div class="app-content">
                        <div class="empty-state">
                            <div class="empty-icon">📜</div>
                            <div class="empty-text">No history yet</div>
                            <div class="empty-subtext">Phone data versions will appear here</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const historyHTML = history.slice().reverse().map((entry, idx) => {
            const actualIndex = history.length - 1 - idx;
            const date = new Date(entry.timestamp);
            const isCurrentVersion = actualIndex === history.length - 1;
            
            return `
                <div class="history-item ${isCurrentVersion ? 'current-version' : ''}" 
                     onclick="window.characterPhone.restorePhoneDataVersion(${actualIndex})">
                    <div class="history-icon">
                        ${isCurrentVersion ? '📱' : '🕐'}
                    </div>
                    <div class="history-content">
                        <div class="history-header">
                            <span class="history-version">Version ${entry.version}</span>
                            ${isCurrentVersion ? '<span class="current-badge">Current</span>' : ''}
                        </div>
                        <div class="history-time">${this.formatDateTime(entry.timestamp)}</div>
                        <div class="history-stats">
                            ${entry.data.phone_data.messages.length} messages • 
                            ${entry.data.phone_data.notes.length} notes • 
                            ${entry.data.phone_data.wallet.transactions.length} transactions
                        </div>
                    </div>
                    ${!isCurrentVersion ? '<div class="history-restore">↻ Restore</div>' : ''}
                </div>
            `;
        }).join('');
        
        return `
            <div class="app-container history-app">
                <div class="app-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2>History</h2>
                </div>
                <div class="app-content">
                    <div class="history-info">
                        <p>📌 Tap any version to restore it</p>
                    </div>
                    ${historyHTML}
                </div>
            </div>
        `;
    }

    /**
     * 🆕 CHANGED: Now calls incremental update instead of full regeneration
     */
    async refreshPhoneData() {
        log('🔄 Refresh button clicked - Running incremental update...');
        
        if (!this.phoneData || !this.phoneData.phone_data) {
            log('❌ No existing data, generating initial data instead');
            
            this.closePhone();
            toastr.info('Generating initial phone data...', 'Character Phone', { timeOut: 2000 });
            
            this.phoneData = null;
            await this.generateInitialPhoneData();
            
            this.renderPhoneUI();
            this.isPhoneOpen = true;
            return;
        }
        
        // Run incremental update
        await this.generateIncrementalUpdate();
        
        // Refresh UI if phone is still open
        if (this.isPhoneOpen) {
            this.renderPhoneUI();
            this.isPhoneOpen = true;
        }
    }

    getUnreadMessagesCount() {
        if (!this.phoneData || !this.phoneData.phone_data || !this.phoneData.phone_data.messages) {
            return 0;
        }
        return this.phoneData.phone_data.messages.reduce((sum, msg) => sum + msg.unread_count, 0);
    }

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        if (diff < 60000) {
            return 'Just now';
        }
        
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }
        
        if (date.toDateString() === now.toDateString()) {
            const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            if (diff < 43200000) {
                return timeStr;
            }
            return `Today, ${timeStr}`;
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        
        if (diff < 604800000) {
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return weekdays[date.getDay()];
        }
        
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
        
        return date.toLocaleDateString('en-US', { 
            year: 'numeric',
            month: 'short', 
            day: 'numeric' 
        });
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        }
        
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        
        if (date.toDateString() === now.toDateString()) {
            return 'Today at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + 
               date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    getModeEmoji(mode) {
        const emojis = {
            walk: '🚶',
            car: '🚗',
            bike: '🚴',
            transit: '🚇'
        };
        return emojis[mode] || '🚶';
    }
}

// Dòng này cũng rất quan trọng, "xuất khẩu" class chính của extension.
export { CharacterPhoneExtension };