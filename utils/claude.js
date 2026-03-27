const Anthropic = require('@anthropic-ai/sdk');

class ClaudeAI {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.systemPrompt = `You are a smart, concise executive assistant for a business owner.
You help with prioritizing tasks, writing SOPs, answering business questions, organizing their day, and coaching their team.
Keep responses practical, clear, and under 400 words unless writing a full SOP.
Format nicely for Discord using bullet points and bold text.`;
  }

  async ask(question, context = '') {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 1024, system: this.systemPrompt,
        messages: [{ role: 'user', content: context ? 'Context: ' + context + '\n\nQuestion: ' + question : question }]
      });
      return message.content[0].text;
    } catch (error) { console.error('Claude AI error:', error.message); return 'I encountered an error. Please try again.'; }
  }

  async generateSOP(topic) {
    return await this.ask('Create a detailed SOP for: "' + topic + '". Format with Purpose, Who this is for, Steps, Quality checks, Common mistakes to avoid.');
  }

  async analyzePriorities(tasks, calendarEvents, slackMessages) {
    const prompt = 'Based on: CALENDAR: ' + JSON.stringify(calendarEvents) + ' SLACK: ' + JSON.stringify(slackMessages) + ' Return ONLY a numbered list of 5 clear actionable priorities for today.';
    const response = await this.ask(prompt);
    return response.split('\n').filter(line => /^\d+\./.test(line.trim())).map(line => line.replace(/^\d+\.\s*/, '').trim()).slice(0, 5);
  }
}

module.exports = { ClaudeAI };