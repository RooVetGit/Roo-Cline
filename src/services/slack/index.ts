import * as vscode from 'vscode'

export interface SlackConfig {
  webhookUrl: string
  enabled: boolean
}

export class SlackNotifier {
  public readonly config: SlackConfig

  constructor(config: SlackConfig) {
    console.log("Creating new SlackNotifier instance with config:", {
      enabled: config.enabled,
      hasWebhookUrl: !!config.webhookUrl,
      webhookUrlLength: config.webhookUrl?.length
    });
    this.config = config;
  }

  private async sendMessage(text: string): Promise<void> {
    console.log("SlackNotifier.sendMessage called with:", {
      text,
      config: {
        enabled: this.config.enabled,
        hasWebhookUrl: !!this.config.webhookUrl,
        webhookUrlLength: this.config.webhookUrl?.length
      }
    });
    
    if (!this.config.enabled) {
      console.log("Slack notifications are disabled in config");
      return;
    }
    
    if (!this.config.webhookUrl) {
      console.log("No Slack webhook URL configured in config");
      return;
    }

    try {
      console.log("Preparing Slack webhook request...");
      const body = JSON.stringify({ text });
      console.log("Request body prepared:", { bodyLength: body.length });
      
      console.log("Sending request to Slack webhook...");
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      })

      console.log("Received response from Slack webhook:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Slack API error response:", {
          status: response.status,
          statusText: response.statusText,
          responseText,
          webhookUrlLength: this.config.webhookUrl.length,
          messageLength: text.length
        });
        throw new Error(`Failed to send Slack message: ${response.statusText} (${response.status})`);
      }

      console.log("Successfully sent Slack message:", {
        messageLength: text.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      vscode.window.showErrorMessage(`Failed to send Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't throw - we don't want Slack errors to interrupt the main flow
    }
  }

  async notifyTaskComplete(taskDescription: string): Promise<void> {
    await this.sendMessage(`✅ Task Complete: ${taskDescription}`)
  }

  async notifyUserInputNeeded(question: string): Promise<void> {
    await this.sendMessage(`❓ User Input Received: ${question}`)
  }

  async notifyTaskFailed(error: string): Promise<void> {
    await this.sendMessage(`❌ Task Failed: ${error}`)
  }
}