const { getSession, setSession } = require("./redis");

const CHAT_HISTORY_TTL = 24 * 60 * 60; // 24 hours

class ChatHistoryManager {
  static async get(phone) {
    const key = `chat:${phone}`;
    const history = await getSession(key);
    return history?.messages || [];
  }

  static async append(phone, userMessage, botResponse) {
    const key = `chat:${phone}`;
    const history = await this.get(phone);

    const updatedHistory = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: botResponse },
    ].slice(-10); // Keep last 10 messages

    await setSession(
      key,
      {
        messages: updatedHistory,
      },
      CHAT_HISTORY_TTL
    );
  }

  static async clear(phone) {
    const key = `chat:${phone}`;
    await setSession(key, { messages: [] }, CHAT_HISTORY_TTL);
  }
}

module.exports = ChatHistoryManager;
