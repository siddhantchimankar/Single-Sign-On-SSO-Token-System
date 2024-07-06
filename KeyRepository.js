const KeyManager = require('./KeyManager');

class KeyRepository {
    constructor(redisClient) {
        this.redis = redisClient;
    }

    async createKey(keyId) {
        await this.redis.multi()
            .set(`key:${keyId}`, 'available')
            .expire(`key:${keyId}`, KeyManager.KEY_EXPIRATION)
            .set(`key:${keyId}:createdAt`, Date.now())
            .exec();
    }

    async getKeyStatus(keyId) {
        return this.redis.get(`key:${keyId}`);
    }

    async setKeyStatus(keyId, status) {
        await this.redis.set(`key:${keyId}`, status);
    }

    async deleteKey(keyId) {
        return this.redis.del(`key:${keyId}`, `key:${keyId}:blockedAt`, `key:${keyId}:createdAt`);
    }

    async getAvailableKeys() {
        const keys = await this.redis.keys('key:*');
        const availableKeys = await Promise.all(keys.map(async (key) => {
            const status = await this.redis.get(key);
            return status === 'available' ? key.split(':')[1] : null;
        }));
        return availableKeys.filter(Boolean);
    }

    async blockKey(keyId) {
        await this.redis.multi()
            .set(`key:${keyId}`, 'blocked')
            .expire(`key:${keyId}:blocked`, KeyManager.BLOCK_EXPIRATION)
            .set(`key:${keyId}:blockedAt`, Date.now())
            .exec();
    }

    async unblockKey(keyId) {
        await this.redis.multi()
            .set(`key:${keyId}`, 'available')
            .expire(`key:${keyId}`, KeyManager.KEY_EXPIRATION)      //we can change this if we want
            .del(`key:${keyId}:blockedAt`)
            .exec();
    }

    // async extendKeyExpiration(keyId) {
    //     return this.redis.expire(`key:${keyId}`, KeyManager.KEY_EXPIRATION);
    // }

    async extendKeyExpiration(keyId) {
        const status = await this.redis.get(`key:${keyId}`);
        if (status === 'available') {
            return this.redis.expire(`key:${keyId}`, KeyManager.KEY_EXPIRATION);
        }
        return 0;
    }

    async getKeyInfo(keyId) {
        return this.redis.mget(`key:${keyId}`, `key:${keyId}:blockedAt`, `key:${keyId}:createdAt`);
    }
}

module.exports = KeyRepository;