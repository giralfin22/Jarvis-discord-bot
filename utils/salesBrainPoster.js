const { EmbedBuilder } = require('discord.js');

const SECTIONS = [
  {
    title: '🧠 KYLE RAWSON SALES BRAIN | Who Kyle Is',
    color: '#5865F2',
    body: [
      '**3 Roles:**',
      '- Closer for **AIPA** (Kyran mentorship) $4,800/6mo or $3,500 upfront',
      '- Closer for **Summit Boost** (Sam & Evan) $1,500/mo + ad spend',
      '- Runs **3AM Closing** $500/mo + 10% per sale',
      '',
      '**Cash collected: $1M+** | Contractor niche specialist'
    ].join('\n')
  },
  {
    title: '💰 Recent Closes March/Feb 2026',
    color: '#57F287',
    body: [
      '**SUMMIT BOOST:**',
      '- Jonathen Weeks $1,500/mo land clearing VA',
      '- John Wolf (Cornerstone) $2,500/mo land clearing',
      '- Jared $750 trial close mulching',
      '- Baron Beebe $100 deposit locked 75mi area',
      '- Amilcar $997/mo irrigation 30 leads guarantee',
      '',
      '**AIPA:**',
      '- Aidan Sierra $4,800/6mo at $800/mo',
      '- Rakesh & Siddeshwar $4,800/6mo at $800/mo'
    ].join('\n')
  },
  {
    title: '🎯 Core Sales Framework',
    color: '#FEE75C',
    body: [
      '**THE FLOW:**',
      '1. PAIN - what is not working right now',
      '2. DESIRED OUTCOME - where do they want to be in 90 days',
      '3. SOLUTION - present offer as the bridge',
      '4. TEMP CHECK - on a 1-10 how ready are you',
      '5. PRICE - only after temp check clears non-price objections',
      '',
      '**Logical vs Emotional:**',
      'High revenue ($10k+/mo) = Logical: systems ROI scalability',
      'Smaller prospect = Emotional: immediate wins quick transformation'
    ].join('\n')
  },
  {
    title: '🔥 Objection Handling',
    color: '#ED4245',
    body: [
      '**Too expensive** - Break it down: $1,500 service + $750 ad spend. Never drop price first',
      '**Need to think about it** - Temp check 1-10. What stops you from being a 10? Handle THAT',
      '**Ads do not work** - Never argue. Ask what happened, let them self-realize',
      '**No money** - If real = disqualify. If fear = what would it take to find it',
      '**Bad past experience** - Tell me exactly what happened, then show what is different'
    ].join('\n')
  },
  {
    title: '💡 Pricing Tactics',
    color: '#EB459E',
    body: [
      '- Quote full price upfront on setting calls ($2-3k/mo) to filter tire-kickers',
      '- Trial close: $750 for 2 weeks for skeptical prospects',
      '- Deposit to lock area: $100 locks 75-mile radius, creates urgency',
      '- 3-month discount: $1,000/mo x3 vs $1,500/mo rolling',
      '- Payment plan: $800/mo vs $3,500 upfront lowers barrier',
      '- Guarantee: X leads/month or work free until hit'
    ].join('\n')
  },
  {
    title: '📋 Setting Call Rules + KPI Targets',
    color: '#4285F4',
    body: [
      '- Pre-qualify budget on setting call, mention $2k/mo upfront',
      '- Book max 2 days out, further = follow-up only',
      '- Decision maker must be on call, no silent partners',
      '- Never mention bi-weekly payments',
      '',
      '**KPI TARGETS:**',
      '- Show rate: 60-65%',
      '- Close rate: 35-40%',
      '- Benchmark: 26 booked / 50% show / 38% close = $5k/week'
    ].join('\n')
  },
  {
    title: '👥 3AM Closing Client Intel',
    color: '#FF6B35',
    body: [
      '**Strive Online (Ishaan):** Joao closes, Helena expanding. 2-day booking rule.',
      '**InstantAppointment AI (Pranshu):** Younes active. Caden PAUSED - 0 from 10+ calls.',
      '**Simplifi (Matt & Anthony):** Anthony closes. $1,500 + $500/close offer.',
      '**MountLeader Media (Rob):** Tilesh closes. Underperforming - monitor.'
    ].join('\n')
  },
  {
    title: '🚀 Kyle Core Principles',
    color: '#9B59B6',
    body: [
      '1. It needs to make sense - never force a deal',
      '2. Vibe sales over hard closing - trust then trial then scale',
      '3. Stay on the line on stalled deals until yes or no',
      '4. Clean disqualification saves time',
      '5. Face in ads = much higher close rates',
      '6. Lifetime value: 2yr client = $30k+',
      '7. Never argue objections - ask until they see it',
      '8. Analogies work: Facebook ads are the gas, we are the car',
      '9. Refundable deposit overcomes I will think about it',
      '10. SMS max 100/day to avoid bans'
    ].join('\n')
  }
];

async function postSalesBrain(client) {
  const CALL_NOTES_ID = '1487223469362909344';
  const SALES_BRAIN_ID = '1487223468331368542';
  try {
    const cn = client.channels.cache.get(CALL_NOTES_ID);
    if (!cn) { console.log('call-notes channel not found'); return; }
    await cn.send('# KYLE RAWSON SALES BRAIN\nCompiled from 40+ Fathom recordings - March & February 2026\nAsk Jarvis anything with /ask in any channel\n---');
    for (const s of SECTIONS) {
      const embed = new EmbedBuilder()
        .setTitle(s.title)
        .setColor(s.color)
        .setDescription(s.body)
        .setFooter({ text: 'Jarvis Sales Brain | Built from Kyle raw calls' });
      await cn.send({ embeds: [embed] });
      await new Promise(r => setTimeout(r, 600));
    }
    const sb = client.channels.cache.get(SALES_BRAIN_ID);
    if (sb) {
      const embed = new EmbedBuilder()
        .setTitle('Sales Brain Loaded - Ask Me Anything')
        .setColor('#5865F2')
        .setDescription('I have been trained on Kyle sales methodology from 40+ real calls.\n\nTry asking:\n- How do I handle I need to think about it\n- What is the best way to present pricing\n- How do I qualify on the setting call\n- What would Kyle say to someone who says ads do not work\n\nUse /ask in any channel')
        .setTimestamp();
      await sb.send({ embeds: [embed] });
    }
    console.log('Sales Brain posted to Jarvis HQ');
  } catch(e) {
    console.error('Sales brain post error:', e.message);
  }
}

module.exports = { postSalesBrain };
