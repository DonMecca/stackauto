// ConfigManager: Manages electron-store config, API keys, prompts, strategies, logo path

let Store = null;

class ConfigManager {
  constructor() {
    this.store = null;
    this.ready = this.init();
  }

  async init() {
    if (!Store) {
      Store = (await import('electron-store')).default;
    }
    this.store = new Store();
  }

  async get(key) {
    await this.ready;
    return this.store.get(key);
  }

  async set(key, value) {
    await this.ready;
    this.store.set(key, value);
  }
}

module.exports = ConfigManager;
