const express = require('express');
const Redis = require('ioredis');
const KeyManager = require('./KeyManager');
const KeyRepository = require('./KeyRepository');
const logger = require('./logger');

const app = express();
const redis = new Redis();
const keyRepository = new KeyRepository(redis);
const keyManager = new KeyManager(keyRepository);

app.use(express.json());
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

/*creates 2 entries in redis
- first is for status i.e availabale or blocked
- second is for createdAt timestamp to fetch key info later on
*/
app.post('/keys', async (req, res) => {
    try {
        const keyId = await keyManager.generateKey();
        res.status(201).json({ keyId });
    } catch (error) {
        logger.error('Error generating key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/*fetches all available keys in from redis
and then selects one randomly and then blocks that key in redis
by marking it's status as blocked and storing blockedtime of key 
in a new key in redis
*/
app.get('/keys', async (req, res) => {
    try {
        const keyId = await keyManager.getAvailableKey();
        res.status(200).json({ keyId });
    } catch (error) {
        if (error.message === 'No available keys') {
            res.status(404).json({"msg" : "No available keys"});
        } else {
            logger.error('Error getting available key:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


/* 
    simply fetches all info from redis for a key and returns
*/
app.get('/keys/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const keyInfo = await keyManager.getKeyInfo(id);
        res.status(200).json(keyInfo);
    } catch (error) {
        if (error.message === 'Key not found') {
            res.status(404).json({});
        } else {
            logger.error('Error getting key info:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


/* 
    simply deletes all info from redis for a key
*/
app.delete('/keys/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await keyManager.deleteKey(id);
        res.status(200).json({ message: 'Key deleted successfully' });
    } catch (error) {
        if (error.message === 'Key not found') {
            res.status(404).json({});
        } else {
            logger.error('Error deleting key:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


/* 
    unblocks a key by marking a key's status as available in redis
    deletes the blockedAt timestamp from redis if it exists 

    we can also separately handle the case when this key is already 
    unblocked, i have not separately handled it, we can send already
    unblocked in that case
*/
app.put('/keys/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await keyManager.unblockKey(id);
        res.status(200).json({ message: 'Key unblocked successfully' });
    } catch (error) {
        if (error.message === 'Key not found') {
            res.status(404).json({});
        } else {
            logger.error('Error unblocking key:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


/* 
    resets the ttl of a key only for available keys
*/
app.put('/keepalive/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await keyManager.keepAlive(id);
        res.status(200).json({ message: 'Key keep-alive successful' });
    } catch (error) {
        if (error.message === 'Key not found') {
            res.status(404).json({});
        } else {
            logger.error('Error keeping key alive:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});


/* periodically unblocks all blocked keys, by marking them as available
    deleting their blocked time
*/
setInterval(() => {
    keyManager.autoReleaseBlockedKeys().catch(error => {
        logger.error('Error auto-releasing blocked keys:', error);
    });
}, KeyManager.BLOCK_EXPIRATION * 1000);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});