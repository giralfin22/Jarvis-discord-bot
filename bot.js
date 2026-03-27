require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, Collection } = require('discord.js');
const { GoogleCalendar } = require('./integrations/calendar');
const { SlackIntegration } = require('./integrations/slack');
const { PriorityEngine } = require('./utils/priorityEngine');
const { SOPManager } = require('./utils/sopManager');
const { ClaudeAI } = require('./utils/claude');
const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages]
});

const commands = [
  new SlashCommandBuilder().setName('priorities').setDescription('📋 Show your top priorities for today'),
  new SlashCommandBuilder().setName('digest').setDescription('📰 Get a full digest of Slack + Calendar + tasks'),
  new SlashCommandBuilder().setName('sop').setDescription('📘 Get or create an SOP').addStringOption(opt => opt.setName('topic').setDescription('What task or process?').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('🤖 Ask your AI assistant anything').addStringOption(opt => opt.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('standup').setDescription('📣 Run a team standup'),
  new SlashCommandBuilder().setName('calendar').setDescription('📅 Show today calendar events'),
  new SlashCommandBuilder().setName('urgent').setDescription('🚨 Flag something as urgent').addStringOption(opt => opt.setName('message').setDescription('What is urgent?').setRequired(true)),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands.map(cmd => cmd.toJSON()) });
    console.log('Slash commands registered!');
  } catch (error) { console.error('Failed to register commands:', error); }
}

client.once('ready', async () => {
  console.log('Bot is online as: ' + client.user.tag);
  await registerCommands();
  cron.schedule('0 8 * * *', async () => {
    const channel = client.channels.cache.get(process.env.DIGEST_CHANNEL_ID);
    if (channel) { const digest = await buildDigest(); channel.send({ embeds: [digest] }); }
  }, { timezone: 'America/New_York' });
  cron.schedule('*/30 * * * *', async () => { await checkSlackUrgent(); });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  try {
    switch (interaction.commandName) {
      case 'priorities': {
        const engine = new PriorityEngine();
        const priorities = await engine.getTopPriorities();
        const embed = new EmbedBuilder().setTitle('🎯 Your Top Priorities Today').setColor('#5865F2')
          .setDescription(priorities.map((p, i) => (i+1) + '. ' + p).join('\n')).setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'digest': { const digest = await buildDigest(); await interaction.editReply({ embeds: [digest] }); break; }
      case 'sop': {
        const topic = interaction.options.getString('topic');
        const sop = new SOPManager();
        const result = await sop.getOrCreate(topic);
        const embed = new EmbedBuilder().setTitle('📘 SOP: ' + topic).setColor('#57F287').setDescription(result.slice(0, 4096)).setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'ask': {
        const question = interaction.options.getString('question');
        const claude = new ClaudeAI();
        const answer = await claude.ask(question);
        const embed = new EmbedBuilder().setTitle('🤖 AI Assistant').setColor('#FEE75C')
          .addFields({ name: '❓ Question', value: question }, { name: '💬 Answer', value: answer.slice(0, 1024) }).setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'standup': {
        const embed = new EmbedBuilder().setTitle('📣 Daily Standup!').setColor('#EB459E')
          .setDescription('**1.** What did you accomplish yesterday?\n**2.** What are you working on today?\n**3.** Any blockers?\n\nReply in thread 👇').setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'calendar': {
        const cal = new GoogleCalendar();
        const events = await cal.getTodayEvents();
        const embed = new EmbedBuilder().setTitle("📅 Today's Calendar").setColor('#4285F4')
          .setDescription(events.length > 0 ? events.map(e => '**' + e.time + '** — ' + e.title).join('\n') : 'No events today! 🎉').setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'urgent': {
        const message = interaction.options.getString('message');
        const embed = new EmbedBuilder().setTitle('🚨 URGENT ALERT').setColor('#ED4245')
          .setDescription(message).addFields({ name: 'Flagged by', value: interaction.user.toString() }).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        const alertChannel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
        if (alertChannel && alertChannel.id !== interaction.channel.id) alertChannel.send({ content: '@everyone', embeds: [embed] });
        break;
      }
    }
  } catch (error) { console.error('Command error:', error); await interaction.editReply('❌ Something went wrong.'); }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const urgent = ['urgent','asap','emergency','critical'];
  if (urgent.some(kw => message.content.toLowerCase().includes(kw))) {
    const alertChannel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
    if (alertChannel) {
      const embed = new EmbedBuilder().setTitle('⚠️ Urgent Message').setColor('#ED4245')
        .setDescription('**From:** ' + message.author + '\n**Message:** ' + message.content).setTimestamp();
      alertChannel.send({ embeds: [embed] });
    }
  }
});

async function buildDigest() {
  const cal = new GoogleCalendar(); const slack = new SlackIntegration(); const engine = new PriorityEngine();
  const [events, slackSummary, priorities] = await Promise.allSettled([cal.getTodayEvents(), slack.getDailySummary(), engine.getTopPriorities()]);
  const embed = new EmbedBuilder().setTitle('📰 Daily Digest — ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })).setColor('#5865F2').setTimestamp();
  if (priorities.status === 'fulfilled') embed.addFields({ name: '🎯 Top Priorities', value: priorities.value.map((p,i) => (i+1) + '. ' + p).join('\n') || 'None' });
  if (events.status === 'fulfilled' && events.value.length > 0) embed.addFields({ name: '📅 Calendar', value: events.value.map(e => '• **' + e.time + '** ' + e.title).join('\n') });
  if (slackSummary.status === 'fulfilled') embed.addFields({ name: '💬 Slack', value: slackSummary.value || 'No activity' });
  return embed;
}

async function checkSlackUrgent() {
  try {
    const slack = new SlackIntegration(); const urgent = await slack.getUrgentMessages();
    if (urgent.length > 0) {
      const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
      if (channel) for (const msg of urgent) {
        const embed = new EmbedBuilder().setTitle('💬 Urgent Slack').setColor('#ED4245')
          .setDescription('**From:** ' + msg.user + '\n**#' + msg.channel + '**\n' + msg.text).setTimestamp();
        channel.send({ embeds: [embed] });
      }
    }
  } catch(e) { console.error('Slack check error:', e.message); }
}

client.login(process.env.DISCORD_TOKEN);