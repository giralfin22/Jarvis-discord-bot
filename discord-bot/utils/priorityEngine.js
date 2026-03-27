const { GoogleCalendar } = require('../integrations/calendar');
const { SlackIntegration } = require('../integrations/slack');
const { ClaudeAI } = require('./claude');

class PriorityEngine {
  async getTopPriorities() {
    try {
      const cal = new GoogleCalendar();
      const slack = new SlackIntegration();
      const claude = new ClaudeAI();

      const [events, slackSummary] = await Promise.allSettled([
        cal.getTodayEvents(),
        slack.getDailySummary()
      ]);

      const calEvents = events.status === 'fulfilled' ? events.value : [];
      const slackData = slackSummary.status === 'fulfilled' ? slackSummary.value : '';

      return await claude.analyzePriorities([], calEvents, slackData);
    } catch (error) {
      console.error('Priority engine error:', error.message);
      return [
        'Check and respond to urgent client messages',
        'Review today\'s calendar and prepare for meetings',
        'Follow up on any pending deliverables',
        'Check in with your team on blockers',
        'Review and process new requests'
      ];
    }
  }
}

module.exports = { PriorityEngine };
