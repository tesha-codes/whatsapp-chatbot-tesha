const openai = require("../../config/openai");
const functions = require("./tools/functions");
const TaskManager = require("./tasks");
const AccountManager = require("./account");
const BillingManager = require("./billing");
const ChatHistoryManager = require("../../utils/chatHistory");
const CHAT_TEMPLATES = require("./chatFlows");

class ChatHandler {
  constructor(phone, userId) {
    this.phone = phone;
    this.userId = userId;
    this.taskManager = new TaskManager(userId);
    this.accountManager = new AccountManager(userId);
    this.billingManager = new BillingManager(userId);
  }

  async processMessage(message) {
    try {
      // 1. Get chat history
      const chatHistory = await ChatHistoryManager.get(this.phone);

      // 2. Generate OpenAI response
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          // System message to set context
          {
            role: "system",
            content:
              "You are Tesha, a WhatsApp chatbot assistant for service providers. You help with tasks, profile management, and billing inquiries.",
          },
          ...chatHistory,
          { role: "user", content: message },
        ],
        functions,
        function_call: "auto",
      });

      const response = completion.choices[0].message;

      // 3. Handle function calls if any
      let responseText;
      if (response.function_call) {
        const result = await this.handleFunctionCall(response.function_call);
        responseText = this.formatResponseFromTemplate(result);
      } else {
        responseText = response.content;
      }

      // 4. Store the conversation in history
      await ChatHistoryManager.append(this.phone, message, responseText);

      return responseText;
    } catch (error) {
      console.error("Error processing message:", error);
      return "I apologize, but I encountered an error. Please try again.";
    }
  }

  async handleFunctionCall(functionCall) {
    const { name, arguments: args } = functionCall;
    const params = JSON.parse(args);

    try {
      switch (name) {
        case "view_tasks_overview":
          const overview = await this.taskManager.getTasksOverview();
          return {
            type: "TASK_OVERVIEW",
            data: overview,
          };

        case "view_tasks_by_status":
          const tasks = await this.taskManager.getTasksByStatus(params.status);
          return {
            type: "TASK_LIST",
            data: tasks,
          };

        case "view_task_details":
          const task = await this.taskManager.getTaskDetails(params.taskId);
          return {
            type: "TASK_DETAILS",
            data: task,
          };

        case "view_profile":
          const profile = await this.accountManager.getProfile();
          return {
            type: "PROFILE_VIEW",
            data: profile,
          };

        case "update_profile":
          const updatedProfile = await this.accountManager.updateProfile(
            params.field,
            params.value
          );
          return {
            type: "PROFILE_UPDATE",
            data: updatedProfile,
          };

        case "delete_account":
          if (params.confirmation) {
            await this.accountManager.deleteAccount(params.reason);
            return {
              type: "ACCOUNT_DELETED",
              data: { reason: params.reason },
            };
          }
          return {
            type: "DELETE_CONFIRMATION_NEEDED",
            data: { reason: params.reason },
          };

        default:
          throw new Error(`Unknown function: ${name}`);
      }
    } catch (error) {
      console.error(`Error handling function ${name}:`, error);
      throw error;
    }
  }

  formatResponseFromTemplate(result) {
    switch (result.type) {
      case "TASK_OVERVIEW":
        return CHAT_TEMPLATES.TASK_OVERVIEW(result.data);

      case "TASK_LIST":
        return CHAT_TEMPLATES.TASK_LIST(result.data);

      case "TASK_DETAILS":
        return CHAT_TEMPLATES.TASK_DETAILS(result.data);

      case "PROFILE_VIEW":
        return CHAT_TEMPLATES.PROFILE_VIEW(result.data);

      case "PROFILE_UPDATE":
        return `✅ Successfully updated ${result.data.field} to: ${result.data.value}`;

      case "ACCOUNT_DELETED":
        return `Account has been successfully deleted.\nReason: ${result.data.reason}`;

      case "DELETE_CONFIRMATION_NEEDED":
        return `⚠️ To confirm account deletion, please reply with "CONFIRM DELETE".\nReason given: ${result.data.reason}`;

      default:
        return JSON.stringify(result.data);
    }
  }

  // Helper method to extract intent from message
  async extractIntent(message) {
    const lowercaseMessage = message.toLowerCase();

    if (lowercaseMessage.includes("task")) return "TASKS";
    if (lowercaseMessage.includes("profile")) return "PROFILE";
    if (lowercaseMessage.includes("delete account")) return "DELETE_ACCOUNT";
    if (
      lowercaseMessage.includes("bill") ||
      lowercaseMessage.includes("payment")
    )
      return "BILLING";

    return "GENERAL";
  }
}

module.exports = ChatHandler;
