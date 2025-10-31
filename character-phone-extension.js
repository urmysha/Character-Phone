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
                // Calculate unread count from thread (messages with read: false)
                const unreadInThread = newMsg.thread.filter(msg => msg.read === false).length;

                // Check if contact already exists
                const existingMsg = this.phoneData.phone_data.messages.find(
                    m => m.contact_name.toLowerCase() === newMsg.contact_name.toLowerCase()
                );

                if (existingMsg) {
                    // Append to existing thread
                    existingMsg.thread.push(...newMsg.thread);
                    existingMsg.last_message_time = newMsg.last_message_time;
                    existingMsg.unread_count = (existingMsg.unread_count || 0) + unreadInThread;
                    log('  ✅ Updated existing conversation with:', newMsg.contact_name, `(+${unreadInThread} unread)`);
                } else {
                    // Add as new conversation with calculated unread_count
                    newMsg.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    newMsg.unread_count = unreadInThread;
                    this.phoneData.phone_data.messages.push(newMsg);
                    log('  ✅ Added new conversation with:', newMsg.contact_name, `(${unreadInThread} unread)`);
                }
            });
        }

        // Add new browser history (mark as unread)
        if (updates.new_browser_history && updates.new_browser_history.length > 0) {
            updates.new_browser_history.forEach(search => {
                search.id = `browse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                search.is_new = true; // 🆕 Mark as unread
                this.phoneData.phone_data.browser_history.push(search);
                log('  ✅ Added browser search:', search.title);
            });
        }

        // Add new transactions (mark as unread)
        if (updates.new_transactions && updates.new_transactions.length > 0) {
            updates.new_transactions.forEach(trans => {
                trans.id = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                trans.is_new = true; // 🆕 Mark as unread
                this.phoneData.phone_data.wallet.transactions.push(trans);

                // Update balance
                this.phoneData.phone_data.wallet.balance += trans.amount;

                log('  ✅ Added transaction:', trans.note, '-', trans.amount);
            });
        }

        // Add new notes (mark as unread)
        if (updates.new_notes && updates.new_notes.length > 0) {
            updates.new_notes.forEach(note => {
                note.id = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                note.is_new = true; // 🆕 Mark as unread
                this.phoneData.phone_data.notes.push(note);
                log('  ✅ Added note:', note.title);
            });
        }

        // Add new locations (mark as unread)
        if (updates.new_locations && updates.new_locations.length > 0) {
            updates.new_locations.forEach(loc => {
                loc.id = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                loc.is_new = true; // 🆕 Mark as unread
                this.phoneData.phone_data.location_history.push(loc);
                log('  ✅ Added location:', loc.from, '→', loc.to);
            });
        }

        // Add new Instagram posts (mark as unread)
        if (updates.new_instagram_posts && updates.new_instagram_posts.length > 0) {
            // Initialize instagram_posts array if it doesn't exist
            if (!this.phoneData.phone_data.instagram_posts) {
                this.phoneData.phone_data.instagram_posts = [];
            }

            updates.new_instagram_posts.forEach(post => {
                post.id = `ig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                post.is_new = true; // 🆕 Mark as unread
                this.phoneData.phone_data.instagram_posts.unshift(post); // Add to beginning (newest first)
                log('  ✅ Added Instagram post:', post.type, '-', post.caption ? post.caption.substring(0, 30) : 'no caption');
            });

            // Update posts count
            if (this.phoneData.phone_data.instagram_profile) {
                this.phoneData.phone_data.instagram_profile.posts_count = this.phoneData.phone_data.instagram_posts.length;
            }
        }

        // Add new Instagram stories (mark as unread)
        if (updates.new_instagram_stories && updates.new_instagram_stories.length > 0) {
            // Initialize instagram_stories array if it doesn't exist
            if (!this.phoneData.phone_data.instagram_stories) {
                this.phoneData.phone_data.instagram_stories = [];
            }

            updates.new_instagram_stories.forEach(story => {
                story.id = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                story.is_new = true; // 🆕 Mark as unread
                // Set expiry to 24 hours from now
                const now = new Date();
                const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                story.expires_at = expiry.toISOString();

                this.phoneData.phone_data.instagram_stories.push(story);
                log('  ✅ Added Instagram story:', story.text_overlay || 'visual story');
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
            ],
            instagram_posts: [
                {
                    id: "ig_001",
                    type: "photo",
                    images: [
                        { image_url: null, image_description: "A cozy coffee shop scene with warm lighting" }
                    ],
                    caption: "My favorite spot ☕✨",
                    likes: 142,
                    liked_by_user: false,
                    comments_count: 8,
                    comments_list: [
                        { username: "bestfriend", text: "Love this place! ☕", timestamp: now },
                        { username: "coffee_lover", text: "Looks cozy! 😍", timestamp: now }
                    ],
                    timestamp: now,
                    music: null,
                    is_new: false
                },
                {
                    id: "ig_002",
                    type: "text",
                    images: [],
                    caption: "Sometimes silence speaks louder than words 🌙",
                    likes: 95,
                    liked_by_user: false,
                    comments_count: 5,
                    comments_list: [
                        { username: "friend", text: "So deep 💭", timestamp: now }
                    ],
                    timestamp: now,
                    music: { title: "Midnight", artist: "Chill Artist" },
                    is_new: false
                }
            ],
            instagram_stories: [
                {
                    id: "story_001",
                    image_url: null,
                    image_description: "A morning coffee selfie",
                    text_overlay: "Good morning! ☕✨",
                    timestamp: now,
                    views: 124,
                    is_new: false
                }
            ],
            instagram_profile: {
                username: charName.toLowerCase().replace(/\s+/g, '_'),
                display_name: charName,
                avatar_url: null,
                bio: "Living my best life 🌟",
                posts_count: 2,
                followers: 486,
                following: 312
            }
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

        // 🆕 Use unread count functions for badges
        const apps = [
            { id: 'messages', icon: '💬', label: 'Messages', badge: this.getUnreadMessagesCount() },
            { id: 'instagram', icon: '📸', label: 'Instagram', badge: this.getUnreadInstagramCount() },
            { id: 'browser', icon: '🌐', label: 'Browser', badge: this.getUnreadBrowserCount() },
            { id: 'wallet', icon: '💳', label: 'Wallet', badge: this.getUnreadWalletCount() },
            { id: 'notes', icon: '📝', label: 'Notes', badge: this.getUnreadNotesCount() },
            { id: 'maps', icon: '🗺️', label: 'Maps', badge: this.getUnreadMapsCount() },
            { id: 'settings', icon: '⚙️', label: 'Settings', badge: 0 },
            { id: 'history', icon: '🕐', label: 'History', badge: 0 }, // No badge for history
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
            case 'instagram':
                this.markAppAsRead('instagram'); // 🆕 Mark Instagram posts as read
                appContent = this.renderInstagramApp();
                break;
            case 'browser':
                this.markAppAsRead('browser'); // 🆕 Mark browser items as read
                appContent = this.renderBrowserApp();
                break;
            case 'wallet':
                this.markAppAsRead('wallet'); // 🆕 Mark wallet items as read
                appContent = this.renderWalletApp();
                break;
            case 'notes':
                this.markAppAsRead('notes'); // 🆕 Mark notes as read
                appContent = this.renderNotesApp();
                break;
            case 'maps':
                this.markAppAsRead('maps'); // 🆕 Mark location items as read
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
            <div class="browser-item ${item.is_new ? 'item-unread' : ''}">
                <div class="browser-icon">🌐</div>
                <div class="browser-content">
                    <div class="browser-title">
                        ${item.title}
                        ${item.is_new ? '<span class="new-indicator">🔴</span>' : ''}
                    </div>
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
                <div class="wallet-transaction ${isExpense ? 'expense' : 'income'} ${trans.is_new ? 'item-unread' : ''}">
                    <div class="transaction-icon">${isExpense ? '💸' : '💰'}</div>
                    <div class="transaction-content">
                        <div class="transaction-merchant">
                            ${trans.merchant}
                            ${trans.is_new ? '<span class="new-indicator">🔴</span>' : ''}
                        </div>
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
            <div class="note-item ${note.is_new ? 'item-unread' : ''}" onclick="window.characterPhone.openNoteDetail('${note.id}')">
                <div class="note-header">
                    <div class="note-title">
                        ${note.title}
                        ${note.is_new ? '<span class="new-indicator">🔴</span>' : ''}
                    </div>
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
            <div class="location-item ${loc.is_new ? 'item-unread' : ''}">
                <div class="location-icon">📍</div>
                <div class="location-content">
                    <div class="location-route">
                        <span class="location-from">${loc.from}</span>
                        <span class="location-arrow">→</span>
                        <span class="location-to">
                            ${loc.to}
                            ${loc.is_new ? '<span class="new-indicator">🔴</span>' : ''}
                        </span>
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

    renderInstagramApp() {
        if (!this.phoneData?.phone_data?.instagram_posts) {
            return '<div class="app-container"><p style="color: #999; padding: 20px;">No Instagram data</p></div>';
        }

        const posts = this.phoneData.phone_data.instagram_posts;
        const stories = this.phoneData.phone_data.instagram_stories || [];
        const profile = this.phoneData.phone_data.instagram_profile || {
            username: 'user',
            display_name: this.getCharacterName(),
            avatar_url: null,
            bio: '',
            posts_count: posts.length,
            followers: 0,
            following: 0
        };

        // Stories HTML
        const storiesHTML = stories.length > 0 ? `
            <div class="ig-stories-container">
                <div class="ig-stories-scroll">
                    ${stories.map(story => {
                        const isNew = story.is_new === true;
                        return `
                            <div class="ig-story ${isNew ? 'ig-story-unread' : ''}" onclick="window.characterPhone.viewStory('${story.id}')">
                                <div class="ig-story-avatar ${profile.avatar_url ? '' : 'ig-avatar-placeholder'}">
                                    ${profile.avatar_url ?
                                        `<img src="${profile.avatar_url}" alt="${profile.display_name}">` :
                                        `<span>${profile.display_name.charAt(0).toUpperCase()}</span>`
                                    }
                                </div>
                                <div class="ig-story-label">${profile.display_name}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        const sortedPosts = this.sortByTimestamp([...posts], 'timestamp');

        const postsHTML = sortedPosts.map(post => {
            const isNewPost = post.is_new === true;
            const hasImage = post.type === 'photo';
            const hasMusic = post.music && post.music.title;
            const images = post.images || [];
            const hasMultipleImages = images.length > 1;
            const isLiked = post.liked_by_user === true;
            const commentsCount = post.comments_count || 0;
            const commentsList = post.comments_list || [];

            // Render carousel or single image
            const imageContent = hasImage ? (
                hasMultipleImages ? `
                    <div class="ig-carousel" data-post-id="${post.id}">
                        <div class="ig-carousel-track">
                            ${images.map((img, idx) => `
                                <div class="ig-carousel-slide ${idx === 0 ? 'active' : ''}">
                                    ${img.image_url ?
                                        `<img src="${img.image_url}" class="ig-post-image" alt="Post" ondblclick="window.characterPhone.likePost('${post.id}')">` :
                                        `<div class="ig-image-placeholder" onclick="window.characterPhone.uploadCarouselImage(event, '${post.id}', ${idx})">
                                            <div class="ig-image-description">${img.image_description || 'No image'}</div>
                                            <div class="ig-camera-overlay-large">📷 Click to upload</div>
                                        </div>`
                                    }
                                </div>
                            `).join('')}
                        </div>
                        ${hasMultipleImages ? `
                            <button class="ig-carousel-prev" onclick="window.characterPhone.prevCarouselImage('${post.id}')">‹</button>
                            <button class="ig-carousel-next" onclick="window.characterPhone.nextCarouselImage('${post.id}')">›</button>
                            <div class="ig-carousel-dots">
                                ${images.map((_, idx) => `<span class="ig-dot ${idx === 0 ? 'active' : ''}"></span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : (
                    images[0]?.image_url ?
                        `<div class="ig-post-image-container" ondblclick="window.characterPhone.likePost('${post.id}')">
                            <img src="${images[0].image_url}" class="ig-post-image" alt="Post">
                        </div>` :
                        `<div class="ig-post-image-container" onclick="window.characterPhone.uploadPostImage(event, '${post.id}')">
                            <div class="ig-image-placeholder">
                                <div class="ig-image-description">${images[0]?.image_description || 'No image'}</div>
                                <div class="ig-camera-overlay-large">📷 Click to upload</div>
                            </div>
                        </div>`
                )
            ) : `<div class="ig-text-post" ondblclick="window.characterPhone.likePost('${post.id}')"><p>${post.caption}</p></div>`;

            return `
                <div class="ig-post ${isNewPost ? 'ig-post-unread' : ''}" data-post-id="${post.id}">
                    <!-- Post Header -->
                    <div class="ig-post-header">
                        <div class="ig-post-user">
                            <div class="ig-avatar-small ${profile.avatar_url ? '' : 'ig-avatar-placeholder'}"
                                 onclick="window.characterPhone.uploadInstagramAvatar(event)">
                                ${profile.avatar_url ?
                                    `<img src="${profile.avatar_url}" alt="${profile.display_name}">` :
                                    `<span>${profile.display_name.charAt(0).toUpperCase()}</span>`
                                }
                                <div class="ig-camera-overlay">📷</div>
                            </div>
                            <span class="ig-username">${profile.display_name}</span>
                        </div>
                        <button class="ig-options-btn">⋯</button>
                    </div>

                    <!-- Post Image/Content with Like Animation -->
                    <div class="ig-post-media" data-post-id="${post.id}">
                        ${imageContent}
                        <div class="ig-like-animation">❤️</div>
                    </div>

                    <!-- Post Actions -->
                    <div class="ig-post-actions">
                        <div class="ig-action-buttons">
                            <button class="ig-action-btn ig-like-btn ${isLiked ? 'liked' : ''}" onclick="window.characterPhone.likePost('${post.id}')">
                                <svg width="24" height="24" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </button>
                            <button class="ig-action-btn" onclick="window.characterPhone.toggleComments('${post.id}')">
                                <svg width="24" height="24" viewBox="0 0 24 24">
                                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="none" stroke="currentColor" stroke-width="2"/>
                                </svg>
                            </button>
                            <button class="ig-action-btn">
                                <svg width="24" height="24" viewBox="0 0 24 24">
                                    <path d="M21 4L12 13 3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                        <button class="ig-action-btn">
                            <svg width="24" height="24" viewBox="0 0 24 24">
                                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="none" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>

                    <!-- Post Info -->
                    <div class="ig-post-info">
                        <div class="ig-likes">${post.likes.toLocaleString()} likes</div>
                        ${hasImage && post.caption ?
                            `<div class="ig-caption">
                                <span class="ig-username-bold">${profile.display_name}</span>
                                ${post.caption}
                            </div>` : ''
                        }
                        ${commentsCount > 0 ?
                            `<div class="ig-comments-link" onclick="window.characterPhone.toggleComments('${post.id}')">
                                View all ${commentsCount} comments
                            </div>` : ''
                        }
                        <div class="ig-timestamp">${this.formatTime(post.timestamp)}</div>
                        ${hasMusic ?
                            `<div class="ig-music">
                                <span class="ig-music-icon">🎵</span>
                                ${post.music.title} • ${post.music.artist}
                            </div>` : ''
                        }
                    </div>

                    <!-- Comments Section (collapsible) -->
                    ${commentsList.length > 0 ? `
                        <div class="ig-comments-section" id="comments-${post.id}" style="display: none;">
                            ${commentsList.map(comment => `
                                <div class="ig-comment">
                                    <div class="ig-comment-avatar">${comment.username.charAt(0).toUpperCase()}</div>
                                    <div class="ig-comment-content">
                                        <span class="ig-comment-username">${comment.username}</span>
                                        <span class="ig-comment-text">${comment.text}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        return `
            <div class="app-container instagram-app">
                <!-- Instagram Header -->
                <div class="ig-header">
                    <button class="app-back-btn" onclick="window.characterPhone.showHomeScreen()">←</button>
                    <h2 class="ig-logo">Instagram</h2>
                    <div class="ig-header-actions">
                        <button class="ig-header-btn">➕</button>
                        <button class="ig-header-btn">❤️</button>
                        <button class="ig-header-btn">✉️</button>
                    </div>
                </div>

                <!-- Profile Section (Mini) -->
                <div class="ig-profile-mini">
                    <div class="ig-avatar ${profile.avatar_url ? '' : 'ig-avatar-placeholder'}"
                         onclick="window.characterPhone.uploadInstagramAvatar(event)">
                        ${profile.avatar_url ?
                            `<img src="${profile.avatar_url}" alt="${profile.display_name}">` :
                            `<span>${profile.display_name.charAt(0).toUpperCase()}</span>`
                        }
                        <div class="ig-camera-overlay">📷</div>
                    </div>
                    <div class="ig-profile-info">
                        <div class="ig-display-name">${profile.display_name}</div>
                        <div class="ig-username-gray">@${profile.username}</div>
                    </div>
                    <div class="ig-profile-stats">
                        <div class="ig-stat">
                            <div class="ig-stat-number" style="color: #000;">${profile.posts_count}</div>
                            <div class="ig-stat-label">posts</div>
                        </div>
                        <div class="ig-stat">
                            <div class="ig-stat-number" style="color: #000;">${profile.followers}</div>
                            <div class="ig-stat-label">followers</div>
                        </div>
                        <div class="ig-stat">
                            <div class="ig-stat-number" style="color: #000;">${profile.following}</div>
                            <div class="ig-stat-label">following</div>
                        </div>
                    </div>
                </div>

                <!-- Stories -->
                ${storiesHTML}

                <!-- Feed -->
                <div class="ig-feed">
                    ${postsHTML || '<div class="ig-empty-state">No posts yet</div>'}
                </div>

                <!-- Hidden file input for uploads -->
                <input type="file" id="ig-upload-input" accept="image/*" style="display: none;"
                       onchange="window.characterPhone.handleImageUpload(event)">
            </div>
        `;
    }

    // Upload Instagram avatar
    async uploadInstagramAvatar(event) {
        event.stopPropagation();
        this.currentUploadTarget = 'avatar';
        document.getElementById('ig-upload-input').click();
    }

    // Upload post image
    async uploadPostImage(event, postId) {
        event.stopPropagation();
        this.currentUploadTarget = postId;
        document.getElementById('ig-upload-input').click();
    }

    // Handle image upload
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target.result;

            if (this.currentUploadTarget === 'avatar') {
                // Update avatar
                if (this.phoneData.phone_data.instagram_profile) {
                    this.phoneData.phone_data.instagram_profile.avatar_url = imageData;
                }
                log('✅ Instagram avatar updated');
            } else if (typeof this.currentUploadTarget === 'object' && this.currentUploadTarget.type === 'carousel') {
                // Update carousel image
                const post = this.phoneData.phone_data.instagram_posts.find(
                    p => p.id === this.currentUploadTarget.postId
                );
                if (post && post.images && post.images[this.currentUploadTarget.imageIndex]) {
                    post.images[this.currentUploadTarget.imageIndex].image_url = imageData;
                    log('✅ Instagram carousel image updated:', post.id, 'index:', this.currentUploadTarget.imageIndex);
                }
            } else {
                // Update single post image (legacy support)
                const post = this.phoneData.phone_data.instagram_posts.find(
                    p => p.id === this.currentUploadTarget
                );
                if (post) {
                    if (post.images && post.images.length > 0) {
                        post.images[0].image_url = imageData;
                    } else {
                        post.image_url = imageData; // Legacy
                    }
                    log('✅ Instagram post image updated:', post.id);
                }
            }

            // Save and re-render
            await this.savePhoneData();
            this.openApp('instagram');
        };

        reader.readAsDataURL(file);
        event.target.value = ''; // Reset input
    }

    // 🆕 Like a post (toggle like + animation)
    async likePost(postId) {
        const post = this.phoneData.phone_data.instagram_posts.find(p => p.id === postId);
        if (!post) return;

        // Toggle like
        post.liked_by_user = !post.liked_by_user;
        post.likes += post.liked_by_user ? 1 : -1;

        // Show like animation
        const postEl = document.querySelector(`[data-post-id="${postId}"] .ig-like-animation`);
        if (postEl) {
            postEl.classList.add('show');
            setTimeout(() => postEl.classList.remove('show'), 1000);
        }

        // Update button
        const likeBtn = document.querySelector(`[data-post-id="${postId}"] .ig-like-btn`);
        if (likeBtn) {
            if (post.liked_by_user) {
                likeBtn.classList.add('liked');
                likeBtn.querySelector('path').setAttribute('fill', 'currentColor');
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('path').setAttribute('fill', 'none');
            }
        }

        // Update likes count
        const likesEl = document.querySelector(`[data-post-id="${postId}"] .ig-likes`);
        if (likesEl) {
            likesEl.textContent = `${post.likes.toLocaleString()} likes`;
        }

        await this.savePhoneData();
        log(`${post.liked_by_user ? '❤️' : '🤍'} Post ${postId}`);
    }

    // 🆕 Toggle comments visibility
    toggleComments(postId) {
        const commentsEl = document.getElementById(`comments-${postId}`);
        if (!commentsEl) return;

        const isVisible = commentsEl.style.display !== 'none';
        commentsEl.style.display = isVisible ? 'none' : 'block';
        log(`${isVisible ? 'Hide' : 'Show'} comments for ${postId}`);
    }

    // 🆕 View Instagram story
    async viewStory(storyId) {
        const story = this.phoneData.phone_data.instagram_stories.find(s => s.id === storyId);
        if (!story) return;

        // Mark story as read
        story.is_new = false;

        // Show story viewer (simple fullscreen overlay)
        const profile = this.phoneData.phone_data.instagram_profile;
        const storyHTML = `
            <div class="ig-story-viewer" onclick="window.characterPhone.closeStoryViewer()">
                <div class="ig-story-header">
                    <div class="ig-story-user-info">
                        <div class="ig-story-user-avatar">${profile.display_name.charAt(0).toUpperCase()}</div>
                        <span>${profile.display_name}</span>
                        <span class="ig-story-time">${this.formatTime(story.timestamp)}</span>
                    </div>
                    <button class="ig-story-close" onclick="window.characterPhone.closeStoryViewer()">✕</button>
                </div>
                <div class="ig-story-content">
                    ${story.image_url ?
                        `<img src="${story.image_url}" alt="Story">` :
                        `<div class="ig-story-placeholder">
                            <p>${story.image_description || story.text_overlay}</p>
                        </div>`
                    }
                    ${story.text_overlay ? `<div class="ig-story-text">${story.text_overlay}</div>` : ''}
                </div>
                <div class="ig-story-footer">
                    <div class="ig-story-views">👁️ ${story.views} views</div>
                </div>
            </div>
        `;

        // Add to DOM
        const viewer = document.createElement('div');
        viewer.innerHTML = storyHTML;
        document.body.appendChild(viewer.firstElementChild);

        await this.savePhoneData();
        log(`📖 Viewed story: ${storyId}`);
    }

    // 🆕 Close story viewer
    closeStoryViewer() {
        const viewer = document.querySelector('.ig-story-viewer');
        if (viewer) {
            viewer.remove();
            this.openApp('instagram'); // Refresh to update unread status
        }
    }

    // 🆕 Next carousel image
    nextCarouselImage(postId) {
        const carousel = document.querySelector(`[data-post-id="${postId}"] .ig-carousel`);
        if (!carousel) return;

        const slides = carousel.querySelectorAll('.ig-carousel-slide');
        const dots = carousel.querySelectorAll('.ig-dot');
        let currentIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));

        slides[currentIndex].classList.remove('active');
        dots[currentIndex].classList.remove('active');

        currentIndex = (currentIndex + 1) % slides.length;

        slides[currentIndex].classList.add('active');
        dots[currentIndex].classList.add('active');
    }

    // 🆕 Previous carousel image
    prevCarouselImage(postId) {
        const carousel = document.querySelector(`[data-post-id="${postId}"] .ig-carousel`);
        if (!carousel) return;

        const slides = carousel.querySelectorAll('.ig-carousel-slide');
        const dots = carousel.querySelectorAll('.ig-dot');
        let currentIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));

        slides[currentIndex].classList.remove('active');
        dots[currentIndex].classList.remove('active');

        currentIndex = (currentIndex - 1 + slides.length) % slides.length;

        slides[currentIndex].classList.add('active');
        dots[currentIndex].classList.add('active');
    }

    // 🆕 Upload carousel image
    async uploadCarouselImage(event, postId, imageIndex) {
        event.stopPropagation();
        this.currentUploadTarget = { type: 'carousel', postId, imageIndex };
        document.getElementById('ig-upload-input').click();
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

    // 🆕 Count unread browser history items
    getUnreadBrowserCount() {
        if (!this.phoneData || !this.phoneData.phone_data || !this.phoneData.phone_data.browser_history) {
            return 0;
        }
        return this.phoneData.phone_data.browser_history.filter(item => item.is_new === true).length;
    }

    // 🆕 Count unread wallet transactions
    getUnreadWalletCount() {
        if (!this.phoneData || !this.phoneData.phone_data || !this.phoneData.phone_data.wallet?.transactions) {
            return 0;
        }
        return this.phoneData.phone_data.wallet.transactions.filter(trans => trans.is_new === true).length;
    }

    // 🆕 Count unread notes
    getUnreadNotesCount() {
        if (!this.phoneData || !this.phoneData.phone_data || !this.phoneData.phone_data.notes) {
            return 0;
        }
        return this.phoneData.phone_data.notes.filter(note => note.is_new === true).length;
    }

    // 🆕 Count unread locations
    getUnreadMapsCount() {
        if (!this.phoneData || !this.phoneData.phone_data || !this.phoneData.phone_data.location_history) {
            return 0;
        }
        return this.phoneData.phone_data.location_history.filter(loc => loc.is_new === true).length;
    }

    // 🆕 Count unread Instagram posts
    getUnreadInstagramCount() {
        if (!this.phoneData || !this.phoneData.phone_data || !this.phoneData.phone_data.instagram_posts) {
            return 0;
        }
        return this.phoneData.phone_data.instagram_posts.filter(post => post.is_new === true).length;
    }

    // 🆕 Mark all items in an app as read
    async markAppAsRead(appId) {
        if (!this.phoneData || !this.phoneData.phone_data) {
            return;
        }

        let hasUnread = false;

        switch(appId) {
            case 'browser':
                if (this.phoneData.phone_data.browser_history) {
                    this.phoneData.phone_data.browser_history.forEach(item => {
                        if (item.is_new === true) {
                            item.is_new = false;
                            hasUnread = true;
                        }
                    });
                }
                break;

            case 'wallet':
                if (this.phoneData.phone_data.wallet?.transactions) {
                    this.phoneData.phone_data.wallet.transactions.forEach(trans => {
                        if (trans.is_new === true) {
                            trans.is_new = false;
                            hasUnread = true;
                        }
                    });
                }
                break;

            case 'notes':
                if (this.phoneData.phone_data.notes) {
                    this.phoneData.phone_data.notes.forEach(note => {
                        if (note.is_new === true) {
                            note.is_new = false;
                            hasUnread = true;
                        }
                    });
                }
                break;

            case 'maps':
                if (this.phoneData.phone_data.location_history) {
                    this.phoneData.phone_data.location_history.forEach(loc => {
                        if (loc.is_new === true) {
                            loc.is_new = false;
                            hasUnread = true;
                        }
                    });
                }
                break;

            case 'instagram':
                if (this.phoneData.phone_data.instagram_posts) {
                    this.phoneData.phone_data.instagram_posts.forEach(post => {
                        if (post.is_new === true) {
                            post.is_new = false;
                            hasUnread = true;
                        }
                    });
                }
                break;
        }

        // Save if there were unread items
        if (hasUnread) {
            await this.savePhoneData();
            log(`📖 Marked ${appId} items as read`);
        }
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