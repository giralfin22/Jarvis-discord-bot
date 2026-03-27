const Anthropic = require('@anthropic-ai/sdk');
class ClaudeAI {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.systemPrompt = 'You are a smart executive assistant. Help with priorities, SOPs, business questions. Be concise and format for Discord.';
  }
  async ask(q) {
    try {
      const msg = await this.client.messages.create({ model:'claude-sonnet-4-20250514', max_tokens:1024, system:this.systemPrompt, messages:[{role:'user',content:q}] });
      return msg.content[0].text;
    } catch(e) { return 'Error: '+e.message; }
  }
  async generateSOP(topic) { return this.ask('Create a detailed SOP for: "'+topic+'". Format: Purpose, Who this is for, Steps, Quality checks, Common mistakes.'); }
  async analyzePriorities(tasks, events, slack) {
    const r = await this.ask('Based on CALENDAR: '+JSON.stringify(events)+' SLACK: '+JSON.stringify(slack)+' Give ONLY a numbered list of 5 clear priorities for today.');
    return r.split('\n').filter(l=>/^\d+\./.test(l.trim())).map(l=>l.replace(/^\d+\.\s*/,'')).slice(0,5);
  }
}
module.exports = { ClaudeAI };