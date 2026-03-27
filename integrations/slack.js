const { WebClient } = require('@slack/web-api');

class SlackIntegration {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.urgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'help', 'blocked', 'down', 'broken'];
  }

  async getDailySummary() {
    try {
      const channelsResp = await this.client.conversations.list({ types: 'public_channel,private_channel', limit: 20 });
      const channels = channelsResp.channels.filter(c => !c.is_archived);
      const summaryLines = [];
      const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      for (const channel of channels.slice(0, 5)) {
        try {
          const history = await this.client.conversations.history({ channel: channel.id, oldest: since.toString(), limit: 10 });
          if ((history.messages || []).length > 0) summaryLines.push('**#' + channel.name + '** - ' + history.messages.length + ' message(s)');
        } catch (e) {}
      }
      return summaryLines.length > 0 ? summaryLines.join('\n') : 'No significant Slack activity in the last 24 hours.';
    } catch (error) { return 'Unable to fetch Slack summary.'; }
  }

  async getUrgentMessages() {
    try {
      const channelsResp = await this.client.conversations.list({ types: 'public_channel,private_channel', limit: 20 });
      const channels = channelsResp.channels.filter(c => !c.is_archived);
      const urgentMessages = [];
      const since = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);
      for (const channel of channels.slice(0, 10)) {
        try {
          const history = await this.client.conversations.history({ channel: channel.id, oldest: since.toString(), limit: 20 });
          for (const msg of (history.messages || [])) {
            if (msg.bot_id) continue;
            if (this.urgentKeywords.some(kw => (msg.text || '').toLowerCase().includes(kw))) {
              let userName = 'Unknown';
              try { const u = await this.client.users.info({ user: msg.user }); userName = u.user && u.user.real_name || 'Unknown'; } catch (_) {}
              urgentMessages.push({ text: msg.text, user: userName, channel: channel.name });
            }
          }
        } catch (e) {}
      }
      return urgentMessages;
    } catch (error) { return []; }
  }
}

module.exports = { SlackIntegration };