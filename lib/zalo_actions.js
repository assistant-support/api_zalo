// /lib/zalo_actions.js
import { ZaloManager } from './zalo_manager.js';
import { ThreadType, DestType } from 'zca-js';

// Tất cả action đều đi qua đây để dễ kiểm soát & chỉnh sửa
export const ZaloActions = {
    async getFriends(id) {
        const r = ZaloManager.instance()._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        return r.api.getAllFriends();
    },

    async findUserByPhone(id, phone) {
        const r = ZaloManager.instance()._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        return r.api.findUser(phone);
    },

    async getRecentMessages(id, threadId, limit = 50) {
        const r = ZaloManager.instance()._getOrCreate(id);
        return r.getRecentMessages(threadId, limit);
    },

    async sendText(id, threadId, text, opts = {}) {
        const r = ZaloManager.instance()._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        return r.api.sendMessage({ msg: text, ...opts }, threadId, ThreadType.User);
    },

    async sendAttachments(id, threadId, filePaths = []) {
        const r = ZaloManager.instance()._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        return r.api.sendMessage({ msg: '', attachments: filePaths }, threadId, ThreadType.User);
    },

    async typing(id, threadId) {
        const r = ZaloManager.instance()._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        return r.api.sendTypingEvent({ type: ThreadType.User, destType: DestType.User }, threadId);
    },

    async seen(id, threadId, messages = []) {
        const r = ZaloManager.instance()._getOrCreate(id);
        if (!r.api) throw new Error('account not online');
        // messages: [{ msgId, cliMsgId, uidFrom, idTo, msgType, st, at, cmd, ts }]
        return r.api.sendSeenEvent(messages, threadId, ThreadType.User);
    },
};
