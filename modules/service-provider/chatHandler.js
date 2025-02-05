const openai = require("../../config/openai");
const tools = require("./tools/functions");
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
      // TODO: content moderation
      // TODO: rate limit
      // : get chat history
      const chatHistory = await ChatHistoryManager.get(this.phone);
      // debug
      console.log("chatHistory", chatHistory);
      const messages = [
        {
          role: "system",
          content:
            "You are Tesha, a WhatsApp chatbot assistant for service providers. " +
            "You help with tasks, profile management, and billing inquiries. " +
            "Use formal but friendly language.",
        },
        ...chatHistory,
        { role: "user", content: message },
      ];

      // Generate OpenAI response
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages,
        tools,
        tool_choice: "auto",
      });

      const response = completion.choices[0].message;
      let responseText = response.content || "";
      const toolCalls = response.tool_calls || [];
      const toolResults = [];

      // Process tool calls in parallel
      if (toolCalls.length > 0) {
        const processingPromises = toolCalls.map(async (toolCall) => {
          try {
            const result = await this.handleToolCall(toolCall);
            toolResults.push(result);

            // Add tool response to message history
            messages.push({
              role: "tool",
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
            });

            return result;
          } catch (error) {
            console.error(`Tool call ${toolCall.id} failed:`, error);
            return {
              error: "Internal service error",
              tool: toolCall.function.name,
            };
          }
        });

        await Promise.all(processingPromises);
      }

      // Format final response
      if (toolResults.length > 0) {
        responseText = this.formatToolResults(toolResults);
      }
      // Update conversation history
      await ChatHistoryManager.append(this.phone, message, responseText);
      return responseText;

    } catch (error) {
      console.error("Error processing message:", error);
      return (
        "🚫 I apologize, but I encountered a technical issue while processing your request. " +
        "This could be temporary - please try again in a few moments. " +
        "If the problem persists, you can:\n" +
        "1️⃣ Send your message again\n" +
        "2️⃣ Try rephrasing your request\n" +
        "3️⃣ Contact support if issues continue"
      );
    }
  }

  async handleToolCall(toolCall) {
    const { name, arguments: args } = toolCall.function;
    let params;

    try {
      params = JSON.parse(args);
      this.validateToolCall(name, params);
    } catch (error) {
      throw new Error(`Invalid parameters for ${name}: ${error.message}`);
    }

    try {
      switch (name) {
        case "view_tasks_overview":
          return {
            type: "TASK_OVERVIEW",
            data: await this.taskManager.getTasksOverview(),
          };

        case "view_tasks_by_status":
          return {
            type: "TASK_LIST",
            data: await this.taskManager.getTasksByStatus(params.status),
          };

        case "view_task_details":
          return {
            type: "TASK_DETAILS",
            data: await this.taskManager.getTaskDetails(params.taskId),
          };

        case "update_task_status":
          return {
            type: "TASK_UPDATE",
            data: await this.taskManager.updateTaskStatus(
              params.taskId,
              params.newStatus
            ),
          };

        case "view_profile":
          return {
            type: "PROFILE_VIEW",
            data: await this.accountManager.getProfile(),
          };

        case "update_profile":
          return {
            type: "PROFILE_UPDATE",
            data: await this.accountManager.updateProfile(
              params.field,
              params.value
            ),
          };

        case "delete_account":
          if (params.confirmation) {
            await this.accountManager.deleteAccount(params.reason);
            return { type: "ACCOUNT_DELETED", data: { reason: params.reason } };
          }
          return {
            type: "DELETE_CONFIRMATION_NEEDED",
            data: { reason: params.reason },
          };

        case "view_billing_history":
          return {
            type: "BILLING_HISTORY",
            data: await this.billingManager.getHistory(),
          };

        default:
          throw new Error(`Unsupported tool: ${name}`);
      }
    } catch (error) {
      console.error(`Tool execution error (${name}):`, error);
      throw new Error(`Service unavailable for ${name}`);
    }
  }

  validateToolCall(name, params) {
    switch (name) {
      case "update_profile":
        if (params.field === "address" && params.value.length < 10) {
          throw new Error("Address must be at least 10 characters");
        }
        if (
          params.field === "gender" &&
          !["male", "female", "other"].includes(params.value.toLowerCase())
        ) {
          throw new Error("Invalid gender value");
        }
        break;

      case "delete_account":
        if (params.reason.length < 10) {
          throw new Error("Deletion reason must be at least 10 characters");
        }
        break;

      case "update_task_status":
        if (!params.taskId.match(/^task_\d{4}_[a-f0-9]{8}$/)) {
          throw new Error("Invalid task ID format");
        }
        break;
    }
  }

  formatToolResults(results) {
    return results
      .map((result) => {
        if (result.error) {
          return `⚠️ Error: ${result.error}`;
        }
        try {
          return this.formatResponseFromTemplate(result);
        } catch (formatError) {
          console.error("Response formatting failed:", formatError);
          return CHAT_TEMPLATES.ERROR_MESSAGE;
        }
      })
      .join("\n\n");
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
        return `Account deleted successfully.\nReason: ${result.data.reason}`;

      case "DELETE_CONFIRMATION_NEEDED":
        return `⚠️ Confirm deletion by replying "CONFIRM DELETE".\nReason: ${result.data.reason}`;

      case "BILLING_HISTORY":
        return CHAT_TEMPLATES.BILLING_HISTORY(result.data);

      default:
        return "I've completed your request. Is there anything else I can help with?";
    }
  }
}

module.exports = ChatHandler;
