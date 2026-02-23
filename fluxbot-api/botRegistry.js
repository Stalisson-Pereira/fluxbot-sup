const bots = new Map(); // key: deviceId, value: { platform, client }

export function registerBot(deviceId, instance) {
    bots.set(deviceId, instance);
}

export function getBot(deviceId) {
    return bots.get(deviceId);
}

export function unregisterBot(deviceId) {
    bots.delete(deviceId);
}

export function listBots() {
    return Array.from(bots.entries());
}
