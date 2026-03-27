const { GoogleCalendar } = require('../integrations/calendar');
const { SlackIntegration } = require('../integrations/slack');
const { ClaudeAI } = require('./claude');
class PriorityEngine {
  async getTopPriorities() {
    try {
      const cal = new GoogleCalendar(); const slack = new SlackIntegration(); const claude = new ClaudeAI();
      const [events, slackSummary] = await Promise.allSettled([cal.getTodayEvents(), slack.getDailySummary()]);
      return await claude.analyzePriorities([], events.status==='fulfilled'?events.value:[], slackSummary.status==='fulfilled'?slackSummary.value:'');
    } catch(e) { return ['Check urgent client messages','Review calendar','Follow up on deliverables','Check team blockers','Process new requests']; }
  }
}
module.exports = { PriorityEngine };