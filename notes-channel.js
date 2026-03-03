// Notes channel that stores messages locally using IndexedDB
class NotesChannel {
  constructor() {
    this.db = null;
    this.initialised = false;
    this.messagesKey = 'notes_messages';
    this.storageName = 'notes_channel_data';
  }

  async init() {
    if (this.initialised) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('originChats_notes', 1);

      request.onerror = (event) => {
        console.error('Error opening notes database', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialised = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storageName)) {
          db.createObjectStore(this.storageName, { keyPath: 'key' });
        }
      };
    });
  }

  async saveMessage(content, user = 'you') {
    await this.init();
    const transaction = this.db.transaction([this.storageName], 'readwrite');
    const store = transaction.objectStore(this.storageName);
    const timestamp = Math.floor(Date.now() / 1000); // Use seconds for compatibility
    const msg = {
      key: `msg_${Date.now()}`, // Keep key unique with ms
      content,
      user,
      timestamp,
      _isNew: true
    };
    store.put(msg);
    return msg;
  }

  async deleteMessage(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storageName], 'readwrite');
      const store = transaction.objectStore(this.storageName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getAllMessages() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storageName], 'readonly');
      const store = transaction.objectStore(this.storageName);
      const request = store.getAll();
      request.onsuccess = () => {
        const msgs = request.result || [];
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async clearMessages() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storageName], 'readwrite');
      const store = transaction.objectStore(this.storageName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }
}

const notesChannel = new NotesChannel();

window.notesChannel = notesChannel;
