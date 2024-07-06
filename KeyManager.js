const KeyGenerator = require('./KeyGenerator');

class KeyManager {
    static KEY_EXPIRATION = 300; // hardcoded time for test
    static BLOCK_EXPIRATION = 15; // hardcoded time for test

    constructor(keyRepository) {
        this.keyRepository = keyRepository;
    }

    async generateKey() {
        const keyId = KeyGenerator.generate();
        await this.keyRepository.createKey(keyId);
        return keyId;
    }

    async getAvailableKey() {
        const availableKeys = await this.keyRepository.getAvailableKeys();
        if (availableKeys.length === 0) {
            throw new Error('No available keys');
        }
        const keyId = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        await this.keyRepository.blockKey(keyId);
        return keyId;
    }

    async getKeyInfo(keyId) {
        const [status, blockedAt, createdAt] = await this.keyRepository.getKeyInfo(keyId);
        if (!status) {
            throw new Error('Key not found');
        }
        return {
            isBlocked: status === 'blocked',
            blockedAt: blockedAt ? parseInt(blockedAt) : null,
            createdAt: parseInt(createdAt)
        };
    }

    async deleteKey(keyId) {
        const result = await this.keyRepository.deleteKey(keyId);
        if (result === 0) {
            throw new Error('Key not found');
        }
    }

    async unblockKey(keyId) {
        const status = await this.keyRepository.getKeyStatus(keyId);
        if (status === null || status === 'available') {
            throw new Error('Key not found');
        }
        await this.keyRepository.unblockKey(keyId);
    }

    async keepAlive(keyId) {
        const result = await this.keyRepository.extendKeyExpiration(keyId);
        if (result === 0) {
            throw new Error('Key not found');
        }
    }

    async autoReleaseBlockedKeys() {
        const keys = await this.keyRepository.redis.keys('key:*');
        for (const key of keys) {
            const status = await this.keyRepository.getKeyStatus(key);
            if(status == 'available') continue;
            const keyId = key.split(':')[1];
            await this.keyRepository.unblockKey(keyId);
        }
    }
}

module.exports = KeyManager;

