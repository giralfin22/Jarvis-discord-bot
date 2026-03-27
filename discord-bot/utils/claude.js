const Anthropic = require('@anthropic-ai/sdk');

class ClaudeAI {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.systemPrompt = `You are a smart, concise executive assistant for a business owner. 
You help with:
- Prioritizing tasks and client work
- Writing SOPs (Standard Operating Procedures)  
- Answering business questions
- Organizing their day
- Coaching their team

Keep responses practical, clear, and under 400 words unless writing a full SOP.
Format nicely for Discord (use bullet points, bold text, etc).`;
  }

  async ask(question, context = '') {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: context ? `Context: ${context}\n\nQuestion: ${question}` : question
          }
        ]
      });
      return message.content[0].text;
    } catch (error) {
      console.error('Claude AI error:', error.message);
      return 'I encountered an error. Please try again.';
    }
  }

  async generateSOP(topic, context = '') {
    const prompt = `Create a detailed SOP (Standard Operating Procedure) for: "${topic}"
${context ? `\nAdditional context: ${context}` : ''}

Format it as:
**Purpose:** [one line]
**Who this is for:** [role/team]
**Steps:**
1. [Step with details]
2. ...
**Quality checks:** [what to verify]
**Common mistakes to avoid:** [2-3 bullets]`;

    return await this.ask(prompt);
  }

  async analyzePriorities(tasks, calendarEvents, slackMessages) {
    const prompt = `Based on the following information, identify the TOP 5 priorities for today:

TASKS: ${JSON.stringify(tasks)}
CALENDAR: ${JSON.stringify(calendarEvents)}
SLACK ACTIVITY: ${JSON.stringify(slackMessages)}

Return ONLY a numbered list of 5 clear, actionable priorities. Be specific.`;

    const response = await this.ask(prompt);
    // Parse the numbered list into array
    return response.split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 5);
  }
}

module.exports = { ClaudeAI };
