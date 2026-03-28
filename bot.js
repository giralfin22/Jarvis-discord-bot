require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ChannelType } = require('discord.js');
const { GoogleCalendar } = require('./integrations/calendar');
const { SlackIntegration } = require('./integrations/slack');
const { PriorityEngine } = require('./utils/priorityEngine');
const { SOPManager } = require('./utils/sopManager');
const { ClaudeAI } = require('./utils/claude');
const { postSalesBrain } = require('./utils/salesBrainPoster');
const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages]
});

const JARVIS_HQ_GUILD = '1487216341592051804';

const HQ_CHANNELS = [
  { name: 'daily-brief', topic: 'AI morning briefing every day at 8am', category: 'KYLE COMMAND CENTER' },
  { name: 'priorities', topic: 'Daily top priorities', category: 'KYLE COMMAND CENTER' },
  { name: 'calendar-tracker', topic: 'Upcoming calls from Google Calendar', category: 'KYLE COMMAND CENTER' },
  { name: 'reminders', topic: 'Follow-ups and smart reminders', category: 'KYLE COMMAND CENTER' },
  { name: 'kyle-and-jarvis', topic: 'Private chat with Jarvis', category: 'KYLE COMMAND CENTER' },
  { name: 'closer-updates', topic: 'Daily closer check-in summaries', category: '3AM CLOSING' },
  { name: 'kpi-tracker', topic: 'Weekly KPI sheets', category: '3AM CLOSING' },
  { name: 'flags-and-issues', topic: 'Client and closer issues', category: '3AM CLOSING' },
  { name: 'sales-brain', topic: 'Ask Jarvis sales questions based on Kyles calls', category: 'SALES BRAIN' },
  { name: 'call-notes', topic: 'Call transcripts and sales brain data', category: 'SALES BRAIN' },
  { name: 'sop-library', topic: 'Generated SOPs', category: 'SALES BRAIN' },
];

async function setupJarvisHQ() {
  const guild = client.guilds.cache.get(JARVIS_HQ_GUILD);
  if (!guild) return;
  const existingNames = guild.channels.cache.map(c => c.name);
  const existingCats = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => c.name);
  const catNames = [...new Set(HQ_CHANNELS.map(c => c.category))];
  const catMap = {};
  for (const cn of catNames) {
    const existing = guild.channels.cache.find(c => c.name.includes(cn.split(' ')[1] || cn) && c.type === ChannelType.GuildCategory);
    if (existing) { catMap[cn] = existing.id; continue; }
    try {
      const cat = await guild.channels.create({ name: cn, type: ChannelType.GuildCategory });
      catMap[cn] = cat.id;
    } catch(e) { console.log('Cat exists or error:', cn); }
  }
  for (const ch of HQ_CHANNELS) {
    if (!existingNames.some(n => n.includes(ch.name))) {
      try {
        await guild.channels.create({ name: ch.name, type: ChannelType.GuildText, topic: ch.topic, parent: catMap[ch.category] });
        console.log('Created: ' + ch.name);
      } catch(e) { console.log('Channel error:', ch.name, e.message); }
    }
  }
  console.log('Jarvis HQ setup complete');
  await postSalesBrain(client);
}

const commands = [
  new SlashCommandBuilder().setName('priorities').setDescription('Your top priorities today'),
  new SlashCommandBuilder().setName('digest').setDescription('Full daily digest'),
  new SlashCommandBuilder().setName('calendar').setDescription('Todays calendar'),
  new SlashCommandBuilder().setName('ask').setDescription('Ask Jarvis anything').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('sop').setDescription('Get or create an SOP').addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(true)),
  new SlashCommandBuilder().setName('standup').setDescription('Run team standup'),
  new SlashCommandBuilder().setName('urgent').setDescription('Flag something urgent').addStringOption(o => o.setName('message').setDescription('What is urgent').setRequired(true)),
  new SlashCommandBuilder().setName('closer').setDescription('Log a closer update').addStringOption(o => o.setName('name').setDescription('Closer name').setRequired(true)).addStringOption(o => o.setName('update').setDescription('Their update').setRequired(true)),
  new SlashCommandBuilder().setName('followup').setDescription('Set a follow-up reminder').addStringOption(o => o.setName('person').setDescription('Who').setRequired(true)).addStringOption(o => o.setName('note').setDescription('About what').setRequired(true)),
];

async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId), { body: commands.map(c => c.toJSON()) });
    console.log('Commands registered: ' + guildId);
  } catch(e) { console.error('Command reg error:', e.message); }
}

client.once('clientReady', async () => {
  console.log('Jarvis online: ' + client.user.tag);
  for (const [id] of client.guilds.cache) await registerCommands(id);
  await setupJarvisHQ();
  cron.schedule('0 8 * * *', async () => {
    const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
    if (hq) {
      const ch = hq.channels.cache.find(c => c.name.includes('daily-brief'));
      if (ch) ch.send({ embeds: [await buildDigest()] });
    }
  }, { timezone: 'America/New_York' });
  cron.schedule('*/30 * * * *', checkSlackUrgent);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  try {
    switch(interaction.commandName) {
      case 'priorities': {
        const engine = new PriorityEngine();
        const p = await engine.getTopPriorities();
        const embed = new EmbedBuilder().setTitle('Your Top Priorities').setColor('#5865F2').setDescription(p.map((x,i) => (i+1)+'. '+x).join('
')).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq && interaction.guildId !== JARVIS_HQ_GUILD) {
          const ch = hq.channels.cache.find(c => c.name.includes('priorities'));
          if (ch) ch.send({ embeds: [embed] });
        }
        break;
      }
      case 'digest': { await interaction.editReply({ embeds: [await buildDigest()] }); break; }
      case 'calendar': {
        const cal = new GoogleCalendar(); const events = await cal.getTodayEvents();
        const embed = new EmbedBuilder().setTitle('Todays Calendar').setColor('#4285F4').setDescription(events.length ? events.map(e => '**'+e.time+'** - '+e.title).join('
') : 'No events today').setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'ask': {
        const q = interaction.options.getString('question');
        const claude = new ClaudeAI(); const a = await claude.ask(q);
        const embed = new EmbedBuilder().setTitle('Jarvis').setColor('#FEE75C').addFields({name:'Question',value:q},{name:'Answer',value:a.slice(0,1024)}).setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'sop': {
        const topic = interaction.options.getString('topic');
        const sop = new SOPManager(); const result = await sop.getOrCreate(topic);
        const embed = new EmbedBuilder().setTitle('SOP: '+topic).setColor('#57F287').setDescription(result.slice(0,4096)).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) { const ch = hq.channels.cache.find(c => c.name.includes('sop-library')); if (ch) ch.send({ embeds: [embed] }); }
        break;
      }
      case 'standup': {
        const embed = new EmbedBuilder().setTitle('Daily Standup').setColor('#EB459E').setDescription('1. What did you accomplish yesterday
2. What are you working on today
3. Any blockers').setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'urgent': {
        const msg = interaction.options.getString('message');
        const embed = new EmbedBuilder().setTitle('URGENT').setColor('#ED4245').setDescription(msg).addFields({name:'Flagged by',value:interaction.user.toString()}).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) { const ch = hq.channels.cache.find(c => c.name.includes('flags')); if (ch) ch.send({ embeds: [embed] }); }
        break;
      }
      case 'closer': {
        const name = interaction.options.getString('name'); const update = interaction.options.getString('update');
        const embed = new EmbedBuilder().setTitle('Closer Update: '+name).setColor('#57F287').setDescription(update).addFields({name:'Date',value:new Date().toLocaleDateString()}).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) { const ch = hq.channels.cache.find(c => c.name.includes('closer-updates')); if (ch) ch.send({ embeds: [embed] }); }
        break;
      }
      case 'followup': {
        const person = interaction.options.getString('person'); const note = interaction.options.getString('note');
        const embed = new EmbedBuilder().setTitle('Follow-up Logged').setColor('#FEE75C').addFields({name:'With',value:person},{name:'About',value:note},{name:'Date',value:new Date().toLocaleDateString()}).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) { const ch = hq.channels.cache.find(c => c.name.includes('reminders')); if (ch) ch.send({ embeds: [embed] }); }
        break;
      }
    }
  } catch(e) { console.error('Command error:', e); await interaction.editReply('Error: '+e.message); }
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  const urgent = ['urgent','asap','emergency','critical'];
  if (urgent.some(k => msg.content.toLowerCase().includes(k))) {
    const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
    if (hq) {
      const ch = hq.channels.cache.find(c => c.name.includes('flags'));
      if (ch) {
        const embed = new EmbedBuilder().setTitle('Urgent Message Detected').setColor('#ED4245').setDescription('From: '+msg.author+'
Server: '+(msg.guild ? msg.guild.name : 'DM')+'
'+msg.content).setTimestamp();
        ch.send({ embeds: [embed] });
      }
    }
  }
});

async function buildDigest() {
  const cal = new GoogleCalendar(); const slack = new SlackIntegration(); const engine = new PriorityEngine();
  const [events, slackSummary, priorities] = await Promise.allSettled([cal.getTodayEvents(), slack.getDailySummary(), engine.getTopPriorities()]);
  const embed = new EmbedBuilder().setTitle('Good Morning Kyle - ' + new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})).setColor('#5865F2').setTimestamp();
  if (priorities.status==='fulfilled'&&priorities.value.length) embed.addFields({name:'Top Priorities',value:priorities.value.map((p,i)=>(i+1)+'. '+p).join('
')});
  if (events.status==='fulfilled'&&events.value.length) embed.addFields({name:'Calendar Today',value:events.value.map(e=>'- '+e.time+' '+e.title).join('
')});
  if (slackSummary.status==='fulfilled') embed.addFields({name:'Slack',value:slackSummary.value||'No activity'});
  embed.setFooter({text:'Jarvis - Your AI Chief of Staff'});
  return embed;
}

async function checkSlackUrgent() {
  try {
    const slack = new SlackIntegration(); const urgent = await slack.getUrgentMessages();
    if (urgent.length) {
      const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
      if (hq) {
        const ch = hq.channels.cache.find(c => c.name.includes('flags'));
        if (ch) for (const m of urgent) {
          const embed = new EmbedBuilder().setTitle('Urgent Slack').setColor('#ED4245').setDescription('From: '+m.user+' in #'+m.channel+'
'+m.text).setTimestamp();
          ch.send({ embeds: [embed] });
        }
      }
    }
  } catch(e) {}
}

client.login(process.env.DISCORD_TOKEN);