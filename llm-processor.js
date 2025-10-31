// llm-processor.js

const DEBUG = true;

function log(...args) {
    if (DEBUG) console.log('[CharacterPhone]', ...args);
}

// ==========================================
// LLM PROCESSOR CLASS
// ==========================================
class LLMProcessor {
    constructor(context) {
        this.context = context;
    }

    /**
     * Generate INITIAL phone data (first time)
     */
    async generatePhoneData(characterId) {
        log('[LLMProcessor] Generating INITIAL phone data for character:', characterId);
        
        try {
            const characterInfo = this.getCharacterInfo(characterId);
            const chatHistory = this.getChatHistory(20);
            const worldInfo = await this.getRelevantWorldInfo();
            
            const prompt = this.buildGenerationPrompt(characterInfo, chatHistory, worldInfo);
            
            const result = await this.callLLM(prompt);
            const phoneData = this.parsePhoneData(result);
            
            return phoneData;
            
        } catch (error) {
            console.error('[LLMProcessor] Failed to generate phone data:', error);
            throw error;
        }
    }

    /**
     * 🆕 NEW: Generate INCREMENTAL updates (keeps old data)
     */
    async generateIncrementalUpdate(characterId, existingPhoneData, lastUpdateMessageIndex) {
        log('[LLMProcessor] Generating INCREMENTAL update from message index:', lastUpdateMessageIndex);
        
        try {
            const characterInfo = this.getCharacterInfo(characterId);
            
            // Get ONLY NEW messages since last update
            const newMessages = this.getNewMessages(lastUpdateMessageIndex);
            
            if (!newMessages || newMessages.length === 0) {
                log('[LLMProcessor] No new messages since last update');
                return null; // No updates needed
            }
            
            log('[LLMProcessor] Found', newMessages.length, 'new messages to analyze');
            
            const worldInfo = await this.getRelevantWorldInfo();
            
            // Build INCREMENTAL prompt
            const prompt = this.buildIncrementalPrompt(
                characterInfo, 
                newMessages, 
                worldInfo,
                existingPhoneData
            );
            
            const result = await this.callLLM(prompt);
            const updates = this.parseIncrementalUpdates(result);
            
            return updates;
            
        } catch (error) {
            console.error('[LLMProcessor] Failed to generate incremental update:', error);
            throw error;
        }
    }

    getCharacterInfo(characterId) {
        console.log('[LLMProcessor] Getting character info...');
        console.log('[LLMProcessor] characterId param:', characterId);
        console.log('[LLMProcessor] context.characterId:', this.context.characterId);
        
        const context = this.context;
        
        let actualCharId = characterId;
        
        if (actualCharId === undefined || actualCharId === null) {
            actualCharId = context.characterId;
        }
        
        if (actualCharId === undefined || actualCharId === null) {
            console.log('[LLMProcessor] characterId is undefined, trying alternative methods...');
            
            if (context.name2 && context.characters) {
                const foundIndex = context.characters.findIndex(c => 
                    c.name === context.name2 || 
                    c.avatar === context.name2
                );
                
                if (foundIndex !== -1) {
                    actualCharId = foundIndex;
                    console.log('[LLMProcessor] Found character by name2, index:', actualCharId);
                }
            }
            
            if ((actualCharId === undefined || actualCharId === null) && 
                context.characters && context.characters.length > 0 &&
                (context.groupId === null || context.groupId === undefined)) {
                actualCharId = 0;
                console.log('[LLMProcessor] Using first character, index:', actualCharId);
            }
        }
        
        console.log('[LLMProcessor] Final character ID to use:', actualCharId);
        
        if (!context.characters || context.characters.length === 0) {
            console.error('[LLMProcessor] No characters available in context');
            throw new Error('No characters available');
        }
        
        console.log('[LLMProcessor] Total characters available:', context.characters.length);
        console.log('[LLMProcessor] Character names:', context.characters.map(c => c.name));
        
        if (actualCharId === undefined || actualCharId === null) {
            console.error('[LLMProcessor] Could not determine character ID');
            throw new Error('Could not determine character ID');
        }
        
        const char = context.characters[actualCharId];
        
        if (!char) {
            console.error('[LLMProcessor] Character not found at index:', actualCharId);
            console.error('[LLMProcessor] Available characters:', 
                context.characters.map((c, idx) => `[${idx}]: ${c.name}`));
            throw new Error('Character not found at index: ' + actualCharId);
        }
        
        console.log('[LLMProcessor] Found character:', char.name);
        console.log('[LLMProcessor] Character object keys:', Object.keys(char));
        
        const getData = (field) => {
            const value = char[field] || char.data?.[field] || '';
            if (value) {
                console.log(`[LLMProcessor] Found ${field}, length:`, value.length);
            }
            return value;
        };
        
        const info = {
            name: char.name || char.data?.name || 'Unknown Character',
            description: getData('description'),
            personality: getData('personality'),
            scenario: getData('scenario'),
            first_mes: getData('first_mes'),
            mes_example: getData('mes_example'),
            creator_notes: getData('creator_notes'),
            system_prompt: getData('system_prompt'),
            post_history_instructions: getData('post_history_instructions'),
            tags: getData('tags') || []
        };
        
        console.log('[LLMProcessor] Character info extracted:', {
            name: info.name,
            hasDescription: info.description.length > 0,
            hasPersonality: info.personality.length > 0,
            hasScenario: info.scenario.length > 0,
            descLength: info.description.length,
            persLength: info.personality.length,
            scenarioLength: info.scenario.length
        });
        
        if (info.name === 'SillyTavern System' || 
            info.name === 'System' ||
            info.name.toLowerCase().includes('system') ||
            info.name.toLowerCase().includes('tavern')) {
            console.error('[LLMProcessor] ERROR: Got system character instead of real character!');
            throw new Error('Cannot generate phone data for system character: ' + info.name);
        }
        
        if (info.description.length === 0 && info.personality.length === 0 && info.scenario.length === 0) {
            console.warn('[LLMProcessor] WARNING: Character has no description, personality, or scenario!');
            console.warn('[LLMProcessor] Character data might be incomplete');
        }
        
        return info;
    }

    getChatHistory(messageCount = 20) {
        const context = this.context;
        
        console.log('[LLMProcessor] Getting chat history...');
        console.log('[LLMProcessor] Total messages in chat:', context.chat?.length || 0);
        
        if (!context.chat || context.chat.length === 0) {
            console.log('[LLMProcessor] No chat history available');
            return [];
        }
        
        const userName = context.name1 || 'User';
        const charName = context.name2 || 'Character';
        
        console.log('[LLMProcessor] User name:', userName);
        console.log('[LLMProcessor] Character name:', charName);
        
        const recentMessages = context.chat.slice(-messageCount);
        
        const formatted = recentMessages.map((msg, idx) => {
            const isUser = msg.is_user || false;
            const sender = isUser ? userName : charName;
            const content = msg.mes || '';
            
            return `[${sender}]: ${content}`;
        });
        
        console.log('[LLMProcessor] Formatted', formatted.length, 'messages');
        
        return formatted;
    }

    /**
     * 🆕 NEW: Get only NEW messages since last update
     */
    getNewMessages(lastMessageIndex) {
        const context = this.context;
        
        if (!context.chat || context.chat.length === 0) {
            return [];
        }
        
        const currentLastIndex = context.chat.length - 1;
        
        if (lastMessageIndex >= currentLastIndex) {
            log('[LLMProcessor] No new messages (lastIndex:', lastMessageIndex, ', current:', currentLastIndex, ')');
            return [];
        }
        
        const newMessages = context.chat.slice(lastMessageIndex + 1);
        
        const userName = context.name1 || 'User';
        const charName = context.name2 || 'Character';
        
        const formatted = newMessages.map((msg) => {
            const isUser = msg.is_user || false;
            const sender = isUser ? userName : charName;
            const content = msg.mes || '';
            
            return `[${sender}]: ${content}`;
        });
        
        log('[LLMProcessor] Got', formatted.length, 'new messages since index', lastMessageIndex);
        
        return formatted;
    }

    async getRelevantWorldInfo() {
        try {
            const context = this.context;
            
            if (!context.world_info || !context.world_info.entries) {
                console.log('[LLMProcessor] No world info available');
                return [];
            }
            
            const entries = context.world_info.entries || [];
            
            const relevantEntries = entries
                .filter(entry => entry && entry.content)
                .slice(0, 5)
                .map(entry => ({
                    key: entry.key || entry.keys?.[0] || 'Unknown',
                    content: entry.content || ''
                }));
            
            console.log('[LLMProcessor] Found', relevantEntries.length, 'world info entries');
            
            return relevantEntries;
            
        } catch (error) {
            console.error('[LLMProcessor] Failed to get world info:', error);
            return [];
        }
    }

    buildGenerationPrompt(characterInfo, chatHistory, worldInfo) {
        const characterName = characterInfo.name;
        
        const worldInfoText = worldInfo.length > 0
            ? worldInfo.map(entry => `- ${entry.key}: ${entry.content}`).join('\n')
            : 'No additional world information available.';
        
        const chatHistoryText = chatHistory.length > 0
            ? chatHistory.join('\n')
            : 'No chat history available yet.';
        
        const currentDate = new Date().toISOString().split('T')[0];
        
        const prompt = `You are a specialized AI assistant that generates realistic smartphone data for fictional characters.

Generate realistic smartphone data for the character: ${characterName}

⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. This is ${characterName}'s PERSONAL phone (not the user's phone)
2. The RECENT CHAT below is between ${characterName} and a USER - DO NOT copy these messages into the phone!
3. You must CREATE NEW, SEPARATE conversations that ${characterName} had with OTHER people (NPCs, friends, family, etc.)
4. Think: "What OTHER conversations would ${characterName} have on their phone, BESIDES their chat with the user?"

CHARACTER INFO:
Name: ${characterName}
Description: ${characterInfo.description || 'N/A'}
Personality: ${characterInfo.personality || 'N/A'}
Scenario: ${characterInfo.scenario || 'N/A'}

WORLD INFO:
${worldInfoText}

RECENT CHAT (between ${characterName} and USER - for context ONLY):
${chatHistoryText}

CURRENT DATE: ${currentDate}

---

YOUR TASK: Create ${characterName}'s phone data.

🚨 EXTREMELY IMPORTANT - DO NOT MAKE THIS MISTAKE:
❌ WRONG: Copying the chat above (between ${characterName} and User) into phone messages
✅ CORRECT: Creating NEW conversations with DIFFERENT people (NPCs, friends, family, colleagues)

Example of CORRECT approach:
- If ${characterName} is a student → messages with classmates, teachers, parents
- If ${characterName} is a worker → messages with colleagues, boss, clients
- If ${characterName} has friends → messages with those friends
- Create realistic NPCs based on ${characterName}'s life and personality

Create phone data including:

1. MESSAGES (2-3 text conversations with NPCs/contacts that ${characterName} knows)
⚠️ CRITICAL: These are conversations with OTHER PEOPLE, not with the user!

Examples of WHO ${characterName} might text:
- Best friend/childhood friend
- Family members (mom, dad, siblings)
- Colleagues/coworkers
- Romantic interest (if applicable)
- Neighbors, classmates, etc.

Examples of CORRECT messages format:
{
  "contact_name": "Mom",
  "thread": [
    {"sender": "Mom", "content": "Did you eat lunch yet?", "timestamp": "...", "read": true},
    {"sender": "${characterName}", "content": "Not yet, I'll eat soon", "timestamp": "...", "read": true}
  ]
}

Examples of WRONG (DO NOT DO THIS):
❌ Using the User's name as contact
❌ Copying conversation content from the RECENT CHAT above
❌ Creating messages about topics ONLY discussed with the user

- Create 2-3 SEPARATE conversations with DIFFERENT contacts
- Each conversation should have 2-4 messages
- Messages where sender is "${characterName}" are messages SENT by ${characterName}
- Messages where sender is the contact name are messages RECEIVED by ${characterName}
- Use character name "${characterName}" EXACTLY as the sender
- Recent timestamps (past few days)

2. BROWSER HISTORY (3-4 searches)
- What would ${characterName} search for based on their personality?
- Include URLs, titles, reasons
- Recent searches

3. WALLET (Balance + 5-6 transactions)
- Realistic balance for ${characterName}'s status
- Recent transactions with notes
- Both expenses and income
- Use appropriate currency (VND for Vietnam, USD for US, etc.)

4. NOTES (2-3 notes)
- Todo lists, reminders, thoughts that ${characterName} would write
- Reflect ${characterName}'s current concerns and personality

5. LOCATION HISTORY (2-3 trips)
- Recent places ${characterName} visited
- Include times and purposes
- Realistic travel modes

OUTPUT ONLY VALID JSON with this structure:

{
  "messages": [
    {
      "id": "msg_001",
      "contact_name": "Contact Name",
      "contact_type": "npc",
      "thread": [
        {"sender": "Contact", "content": "Text", "timestamp": "${currentDate}T10:00:00Z", "read": true}
      ],
      "last_message_time": "${currentDate}T10:00:00Z",
      "unread_count": 0
    }
  ],
  "browser_history": [
    {"id": "browse_001", "url": "www.example.com", "title": "Title", "timestamp": "${currentDate}T14:00:00Z", "reason": "Why", "category": "news"}
  ],
  "wallet": {
    "balance": 1000.00,
    "currency": "USD",
    "transactions": [
      {"id": "trans_001", "type": "expense", "amount": -50.00, "category": "food", "merchant": "Shop", "note": "Note", "timestamp": "${currentDate}T12:00:00Z", "location": "City"}
    ]
  },
  "notes": [
    {"id": "note_001", "title": "Title", "content": "Content", "created_at": "2025-10-25T08:00:00Z", "updated_at": "${currentDate}T09:00:00Z", "category": "personal", "pinned": false}
  ],
  "location_history": [
    {"id": "loc_001", "from": "Home", "to": "Work", "departure_time": "${currentDate}T08:00:00Z", "arrival_time": "${currentDate}T08:30:00Z", "travel_mode": "car", "purpose": "Commute", "route": ["Home", "Street", "Work"]}
  ]
}

CRITICAL RULES:
- Output ONLY the JSON object, no markdown, no explanations
- Use realistic, character-appropriate content
- All timestamps must be valid ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
- Make timestamps realistic and logical:
  * Most recent items from today (${currentDate})
  * Yesterday items from previous day
  * Older items 2-7 days ago
  * For notes: created_at should be older, updated_at more recent
- Keep content consistent with ${characterName}'s personality
- Make it feel like real phone data from a real person
- Use currency/locations appropriate to the story setting`;

        return prompt;
    }

    /**
     * 🆕 NEW: Build prompt for INCREMENTAL updates only
     */
    buildIncrementalPrompt(characterInfo, newMessages, worldInfo, existingPhoneData) {
        const characterName = characterInfo.name;
        
        const worldInfoText = worldInfo.length > 0
            ? worldInfo.map(entry => `- ${entry.key}: ${entry.content}`).join('\n')
            : 'No additional world information available.';
        
        const newMessagesText = newMessages.join('\n');
        
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Summarize existing data
        const existingSummary = `
EXISTING PHONE DATA SUMMARY:
- Messages: ${existingPhoneData.phone_data.messages.length} conversations
  Contacts: ${existingPhoneData.phone_data.messages.map(m => m.contact_name).join(', ')}
- Browser History: ${existingPhoneData.phone_data.browser_history.length} searches
- Wallet Balance: ${existingPhoneData.phone_data.wallet.balance} ${existingPhoneData.phone_data.wallet.currency}
- Notes: ${existingPhoneData.phone_data.notes.length} notes
- Location History: ${existingPhoneData.phone_data.location_history.length} trips
`;
        
        const prompt = `You are analyzing NEW chat messages to find updates for ${characterName}'s phone.

CHARACTER: ${characterName}
PERSONALITY: ${characterInfo.personality || 'N/A'}

${existingSummary}

NEW MESSAGES TO ANALYZE (between ${characterName} and USER):
${newMessagesText}

WORLD INFO:
${worldInfoText}

---

⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY:

The NEW MESSAGES above are conversations between ${characterName} and the USER.
These are for CONTEXT ONLY - DO NOT copy them into phone messages!

YOUR TASK: Analyze the NEW messages above and identify if there are ANY new:
1. 💬 Messages/Conversations via text message that ${characterName} had with someone
2. 🌐 Things ${characterName} searched on the internet
3. 💰 Money transactions (spending or receiving money)
4. 📝 Notes/reminders ${characterName} made
5. 📍 Places ${characterName} visited

RULES:
- ONLY add NEW information explicitly mentioned in the NEW messages
- If nothing relevant found, return empty arrays
- DO NOT duplicate existing data
- DO NOT regenerate old data
- Keep format consistent with existing data
- Use realistic timestamps (today: ${currentDate})

OUTPUT FORMAT (JSON):
{
  "has_updates": true/false,
  "new_messages": [
    {
      "contact_name": "Name",
      "contact_type": "npc",
      "thread": [
        {"sender": "${characterName}", "content": "...", "timestamp": "${currentDate}T14:00:00Z", "read": true}
		{"sender": "Name", "content": "...", "timestamp": "${currentDate}T14:05:00Z", "read": false}
      ],
      "last_message_time": "${currentDate}T14:00:00Z",
	  
    }
  ],
  "new_browser_history": [
    {"url": "...", "title": "...", "timestamp": "${currentDate}T15:00:00Z", "reason": "...", "category": "..."}
  ],
  "new_transactions": [
    {"type": "expense", "amount": -50.00, "category": "food", "merchant": "...", "note": "...", "timestamp": "${currentDate}T16:00:00Z", "location": "..."}
  ],
  "new_notes": [
    {"title": "...", "content": "...", "created_at": "${currentDate}T17:00:00Z", "updated_at": "${currentDate}T17:00:00Z", "category": "personal", "pinned": false}
  ],
  "new_locations": [
    {"from": "...", "to": "...", "departure_time": "${currentDate}T18:00:00Z", "arrival_time": "${currentDate}T18:30:00Z", "travel_mode": "...", "purpose": "...", "route": ["...", "..."]}
  ]
}

IMPORTANT:
- Set "has_updates": false if NO relevant information found
- All arrays can be empty []
- Output ONLY JSON, no markdown, no explanations
- Be conservative - only add clear, explicit information`;

        return prompt;
    }

    async callLLM(prompt) {
        log('[LLMProcessor] Calling LLM via generateQuietPrompt...');
        
        const { generateQuietPrompt } = this.context;
        
        if (!generateQuietPrompt) {
            throw new Error('generateQuietPrompt function not available in context');
        }
        
        try {
            const result = await generateQuietPrompt({
                quietPrompt: prompt,
                quietToLoud: false,
            });
            
            log('[LLMProcessor] LLM response received, length:', result?.length || 0);
            
            if (typeof result === 'string') {
                log('[LLMProcessor] Response preview:', result.substring(0, 200));
            }
            
            return result;
            
        } catch (error) {
            console.error('[LLMProcessor] LLM call failed:', error);
            throw error;
        }
    }

    parsePhoneData(llmResponse) {
        try {
            log('[LLMProcessor] Parsing LLM response...');
            
            if (typeof llmResponse === 'string') {
                console.log('[LLMProcessor] Raw LLM response length:', llmResponse.length);
                console.log('[LLMProcessor] Raw LLM response (first 500 chars):', llmResponse.substring(0, 500));
            }
            
            let data = llmResponse;
            
            if (typeof llmResponse === 'string') {
                let cleaned = llmResponse.trim();
                
                console.log('[LLMProcessor] Cleaning LLM response...');
                
                cleaned = cleaned.replace(/```json\n?/gi, '');
                cleaned = cleaned.replace(/```\n?/g, '');
                cleaned = cleaned.trim();
                
                const jsonMatch = cleaned.match(/\{[\s\S]*\}(?=\s*$|\s*[\n\r])/);
                if (jsonMatch) {
                    cleaned = jsonMatch[0];
                    console.log('[LLMProcessor] Extracted JSON from response');
                }
                
                cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
                
                cleaned = this.fixJsonQuotes(cleaned);
                cleaned = this.fixJsonArrayCommas(cleaned);
                cleaned = this.fixJsonNewlines(cleaned);
                
                console.log('[LLMProcessor] Cleaned JSON (first 300 chars):', cleaned.substring(0, 300));
                
                try {
                    data = JSON.parse(cleaned);
                    console.log('[LLMProcessor] JSON parsed successfully');
                } catch (parseError) {
                    console.error('[LLMProcessor] JSON parse error:', parseError.message);
					console.log('--- TOÀN BỘ CHUỖI JSON BỊ LỖI ---');
                    console.log(cleaned); 
                    console.error('[LLMProcessor] Error position:', parseError.message.match(/position (\d+)/)?.[1]);
                    
                    try {
                        cleaned = this.aggressiveJsonRepair(cleaned);
                        data = JSON.parse(cleaned);
                        console.log('[LLMProcessor] JSON parsed successfully after aggressive repair');
                    } catch (finalError) {
                        console.error('[LLMProcessor] Final JSON parse failed:', finalError.message);
                        console.error('[LLMProcessor] Failed JSON string (first 500 chars):', cleaned.substring(0, 500));
                        throw new Error('Failed to parse LLM response as JSON: ' + parseError.message);
                    }
                }
            }
            
            const requiredFields = ['messages', 'browser_history', 'wallet', 'notes', 'location_history'];
            const missingFields = requiredFields.filter(field => !data[field]);

            if (missingFields.length > 0) {
                console.error('[LLMProcessor] Missing required fields:', missingFields);
                console.error('[LLMProcessor] Available fields:', Object.keys(data));
                throw new Error('Invalid phone data structure from LLM. Missing: ' + missingFields.join(', '));
            }

            if (data.messages && data.messages.length > 0) {
                const characterInfo = this.getCharacterInfo(this.context.characterId);
                const charName = characterInfo.name;
                
                console.log('[LLMProcessor] Validating messages are from character:', charName);
                
                const firstMessage = data.messages[0];
                if (firstMessage && firstMessage.thread && firstMessage.thread.length > 0) {
                    const firstSender = firstMessage.thread[0].sender;
                    
                    if (firstSender.toLowerCase().includes('user') || 
                        firstSender.toLowerCase().includes('you')) {
                        console.warn('[LLMProcessor] WARNING: Messages appear to be from user perspective, not character!');
                        console.warn('[LLMProcessor] This might indicate LLM misunderstood the prompt');
                    }
                }
            }

            console.log('[LLMProcessor] Phone data validation passed');
            
            const now = new Date().toISOString();
            
            return {
                character_id: this.context.characterId,
                phone_data: {
                    ...data,
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
            
        } catch (error) {
            console.error('[LLMProcessor] Failed to parse phone data:', error);
            console.error('[LLMProcessor] Raw response:', llmResponse);
            throw new Error('Failed to parse LLM response: ' + error.message);
        }
    }

    /**
     * 🆕 NEW: Parse INCREMENTAL updates from LLM
     */
    parseIncrementalUpdates(llmResponse) {
        try {
            log('[LLMProcessor] Parsing incremental updates...');
            
            let data = llmResponse;
            
            if (typeof llmResponse === 'string') {
                let cleaned = llmResponse.trim();
                
                cleaned = cleaned.replace(/```json\n?/gi, '');
                cleaned = cleaned.replace(/```\n?/g, '');
                cleaned = cleaned.trim();
                
                const jsonMatch = cleaned.match(/\{[\s\S]*\}(?=\s*$|\s*[\n\r])/);
                if (jsonMatch) {
                    cleaned = jsonMatch[0];
                }
                
                cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
                
                try {
                    data = JSON.parse(cleaned);
                    console.log('[LLMProcessor] Incremental updates parsed successfully');
                } catch (parseError) {
                    console.error('[LLMProcessor] Failed to parse incremental updates:', parseError);
                    throw new Error('Failed to parse incremental updates: ' + parseError.message);
                }
            }
            
            // Validate structure
            if (!data.hasOwnProperty('has_updates')) {
                console.warn('[LLMProcessor] Missing has_updates field, assuming false');
                data.has_updates = false;
            }
            
            if (!data.has_updates) {
                log('[LLMProcessor] No updates detected by LLM');
                return null;
            }
            
            log('[LLMProcessor] Updates detected:', {
                new_messages: data.new_messages?.length || 0,
                new_browser_history: data.new_browser_history?.length || 0,
                new_transactions: data.new_transactions?.length || 0,
                new_notes: data.new_notes?.length || 0,
                new_locations: data.new_locations?.length || 0
            });
            
            return data;
            
        } catch (error) {
            console.error('[LLMProcessor] Failed to parse incremental updates:', error);
            return null;
        }
    }

    fixJsonQuotes(json) {
        try {
            const stringRegex = /"([^"\\]|\\.)*"/g;
            let stringIndex = 0;
            const strings = [];
            
            let result = json.replace(stringRegex, (match) => {
                strings[stringIndex] = match;
                return `__STRING_${stringIndex++}__`;
            });
            
            result = result.replace(/__STRING_(\d+)__/g, (match, index) => {
                let str = strings[parseInt(index)];
                return str;
            });
            
            return result;
        } catch (e) {
            console.warn('[LLMProcessor] fixJsonQuotes failed:', e);
            return json;
        }
    }

    fixJsonArrayCommas(json) {
        try {
            json = json.replace(/\}\s*\{/g, '},{');
            json = json.replace(/\}\s*\[/g, '},{');
            json = json.replace(/\]\s*\{/g, '},{');
            json = json.replace(/\]\s*\[/g, '],[');
            return json;
        } catch (e) {
            console.warn('[LLMProcessor] fixJsonArrayCommas failed:', e);
            return json;
        }
    }

    fixJsonNewlines(json) {
        try {
            const lines = json.split('\n');
            let inString = false;
            let result = '';
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let quoteCount = 0;
                
                for (let j = 0; j < line.length; j++) {
                    if (line[j] === '"' && (j === 0 || line[j-1] !== '\\')) {
                        quoteCount++;
                    }
                }
                
                if (quoteCount % 2 === 1) {
                    inString = !inString;
                }
                
                result += line;
                
                if (!inString && i < lines.length - 1) {
                    result += '\n';
                } else if (inString && i < lines.length - 1) {
                    result += '\\n';
                }
            }
            
            return result;
        } catch (e) {
            console.warn('[LLMProcessor] fixJsonNewlines failed:', e);
            return json;
        }
    }

    aggressiveJsonRepair(json) {
        try {
            console.log('[LLMProcessor] Applying aggressive JSON repair...');
            let repaired = json;
            
            repaired = repaired.replace(/\}'$/g, '}');
            repaired = repaired.replace(/\]'$/g, ']');
            repaired = repaired.replace(/": "([^"]*)\n([^"]*)" /g, '": "$1 $2" ');
            
            const openBraces = (repaired.match(/\{/g) || []).length;
            const closeBraces = (repaired.match(/\}/g) || []).length;
            if (openBraces > closeBraces) {
                repaired += '}'.repeat(openBraces - closeBraces);
                console.log('[LLMProcessor] Added missing closing braces');
            }
            
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;
            if (openBrackets > closeBrackets) {
                repaired += ']'.repeat(openBrackets - closeBrackets);
                console.log('[LLMProcessor] Added missing closing brackets');
            }
            
            repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
            repaired = repaired.replace(/": "([^"]*)  +([^"]*)"/g, '": "$1 $2"');
            
            return repaired;
        } catch (e) {
            console.warn('[LLMProcessor] aggressiveJsonRepair failed:', e);
            return json;
        }
    }
}

// Dòng này rất quan trọng. Nó "xuất khẩu" class LLMProcessor để các tệp khác có thể sử dụng.
export { LLMProcessor };