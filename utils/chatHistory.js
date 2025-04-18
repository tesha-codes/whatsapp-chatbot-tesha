const { getSession, setSession, redisHelper } = require("./redis");

const CHAT_HISTORY_TTL = 24 * 60 * 60; // 24 hours
const METADATA_TTL = 12 * 60 * 60; // 12 hours

class ChatHistoryManager {
  static async get(phone) {
    const key = `chat:${phone}`;
    const history = await getSession(key);

    try {
      return history.messages ? JSON.parse(history.messages) : [];
    } catch (e) {
      console.error("Error parsing chat history:", e);
      return [];
    }
  }

  static async append(phone, userMessage, botResponse) {
    const key = `chat:${phone}`;
    const history = await this.get(phone);

    const updatedHistory = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: botResponse },
    ].slice(-10); // limit to 10 messages

    await setSession(
      key,
      { messages: JSON.stringify(updatedHistory) },
      CHAT_HISTORY_TTL
    );
  }

  static async clear(phone) {
    const key = `chat:${phone}`;
    await setSession(key, { messages: JSON.stringify([]) }, CHAT_HISTORY_TTL);
  }
  // phone chat meta data
  static async storeMetadata(phone, key, data) {
    try {
      const metadataKey = `chat:metadata:${phone}`;

      // Get existing metadata if any
      let metadata = {};
      const existingData = await redisHelper.get(metadataKey);

      if (existingData) {
        try {
          metadata = JSON.parse(existingData);
        } catch (parseError) {
          console.error("Error parsing metadata:", parseError);
        }
      }

      // Update with new data
      metadata[key] = data;

      // Store in Redis with 12 hour expiry
      await redisHelper.set(
        metadataKey,
        JSON.stringify(metadata),
        "EX",
        METADATA_TTL || 43200 // 12 hours in seconds
      );

      return true;
    } catch (error) {
      console.error(`Failed to store metadata (${key}):`, error);
      return false;
    }
  }

  static async getMetadata(phone, key = null) {
    try {
      const metadataKey = `chat:metadata:${phone}`;
      const data = await redisHelper.get(metadataKey);

      if (!data) {
        return key ? null : {};
      }

      try {
        const metadata = JSON.parse(data);
        return key ? metadata[key] : metadata;
      } catch (parseError) {
        console.error("Error parsing metadata:", parseError);
        return key ? null : {};
      }
    } catch (error) {
      console.error(`Failed to get metadata${key ? ` (${key})` : ""}:`, error);
      return key ? null : {};
    }
  }
}

module.exports = ChatHistoryManager;
