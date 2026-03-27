require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, ChannelType } = require('discord.js');
const { GoogleCalendar } = require('./integrations/calendar');
const { SlackIntegration } = require('./integrations/slack');
const { PriorityEngine } = require('./utils/priorityEngine');
const { SOPManager } = require('./utils/sopManager');
const { ClaudeAI } = require('./utils/claude');
const cron = require('node-cron');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const JARVIS_HQ_GUILD = '1487216341592051804';
const MAIN_GUILD = process.env.DISCORD_GUILD_ID;

// ── Channel structure for Jarvis HQ ──
const HQ_CHANNELS = [
  { name: '📋-daily-brief', topic: 'Your AI-generated morning briefing every day at 8am', category: '🧠 KYLE COMMAND CENTER' },
  { name: '🎯-priorities', topic: 'Daily top priorities based on your calendar and activity', category: '🧠 KYLE COMMAND CENTER' },
  { name: '📅-calendar-tracker', topic: 'Upcoming calls and appointments from Google Calendar', category: '🧠 KYLE COMMAND CENTER' },
  { name: '🔔-reminders', topic: 'Follow-ups, tasks and smart reminders', category: '🧠 KYLE COMMAND CENTER' },
  { name: '💬-kyle-and-jarvis', topic: 'Your private channel to chat with Jarvis about anything', category: '🧠 KYLE COMMAND CENTER' },
  { name: '📊-closer-updates', topic: 'Daily check-in summaries from all your closers', category: '👥 3AM CLOSING' },
  { name: '📈-kpi-tracker', topic: 'Weekly KPI sheets - Joao, Younes, Caden, Anthony, Tilesh', category: '👥 3AM CLOSING' },
  { name: '⚠️-flags-and-issues', topic: 'Issues flagged across clients - Strive, IAIA, Simplifi, MountLeader', category: '👥 3AM CLOSING' },
  { name: '🧠-sales-brain', topic: 'Ask Jarvis any sales question - answers based on Kyles calls', category: '🎓 SALES BRAIN' },
  { name: '📞-call-notes', topic: 'Post call notes here for Jarvis to learn from', category: '🎓 SALES BRAIN' },
  { name: '📚-sop-library', topic: 'Generated SOPs for closing, setting, objection handling', category: '🎓 SALES BRAIN' },
];

async function setupJarvisHQ() {
  const guild = client.guilds.cache.get(JARVIS_HQ_GUILD);
  if (!guild) return;

  const existingChannels = guild.channels.cache.map(c => c.name);
  const existingCategories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => c.name);

  // Create categories first
  const categoryNames = [...new Set(HQ_CHANNELS.map(c => c.category))];
  const categoryMap = {};

  for (const catName of categoryNames) {
    if (!existingCategories.includes(catName)) {
      const cat = await guild.channels.create({ name: catName, type: ChannelType.GuildCategory });
      categoryMap[catName] = cat.id;
      console.log('Created category: ' + catName);
    } else {
      const existing = guild.channels.cache.find(c => c.name === catName && c.type === ChannelType.GuildCategory);
      if (existing) categoryMap[catName] = existing.id;
    }
  }

  // Create channels
  for (const ch of HQ_CHANNELS) {
    const cleanName = ch.name.replace(/[^a-z0-9-]/g, c => '');
    if (!existingChannels.some(n => n.includes(ch.name.split('-').slice(1).join('-')))) {
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        topic: ch.topic,
        parent: categoryMap[ch.category]
      });
      console.log('Created channel: ' + ch.name);
    }
  }
  console.log('✅ Jarvis HQ fully set up!');

  // Send welcome message to kyle-and-jarvis channel
  const privateChannel = guild.channels.cache.find(c => c.name.includes('kyle-and-jarvis'));
  if (privateChannel) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Jarvis HQ is Live, Kyle!')
      .setColor('#5865F2')
      .setDescription(
        "Welcome to your command center. Here's what I can do for you:\n\n" +
        "**📋 Daily Brief** - Every morning at 8am in #daily-brief\n" +
        "**🎯 Priorities** - Type `/priorities` anywhere\n" +
        "**📅 Calendar** - Type `/calendar` to see your day\n" +
        "**👥 Closer Updates** - I'll post daily summaries in #closer-updates\n" +
        "**🧠 Sales Brain** - Your closers can ask me anything in #sales-brain\n" +
        "**📞 Call Notes** - Drop call notes in #call-notes and I'll learn from them\n\n" +
        "**Next step:** Share your Fathom call transcripts so I can learn your sales style. " +
        "Drop a Google Drive link in this channel and I'll set up the pipeline. 🚀"
      )
      .setFooter({ text: 'Jarvis • Your AI Chief of Staff' })
      .setTimestamp();
    privateChannel.send({ embeds: [embed] });
  }
}

const commands = [
  new SlashCommandBuilder().setName('priorities').setDescription('📋 Your top priorities today'),
  new SlashCommandBuilder().setName('digest').setDescription('📰 Full daily digest'),
  new SlashCommandBuilder().setName('calendar').setDescription('📅 Today\'s calendar'),
  new SlashCommandBuilder().setName('ask').setDescription('🤖 Ask Jarvis anything').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('sop').setDescription('📘 Get or create an SOP').addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(true)),
  new SlashCommandBuilder().setName('standup').setDescription('📣 Run team standup'),
  new SlashCommandBuilder().setName('urgent').setDescription('🚨 Flag something urgent').addStringOption(o => o.setName('message').setDescription('What is urgent?').setRequired(true)),
  new SlashCommandBuilder().setName('closer').setDescription('📊 Log a closer update').addStringOption(o => o.setName('name').setDescription('Closer name').setRequired(true)).addStringOption(o => o.setName('update').setDescription('Their update').setRequired(true)),
  new SlashCommandBuilder().setName('followup').setDescription('🔔 Set a follow-up reminder').addStringOption(o => o.setName('person').setDescription('Who to follow up with').setRequired(true)).addStringOption(o => o.setName('note').setDescription('What about').setRequired(true)),
];

async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId), { body: commands.map(c => c.toJSON()) });
    console.log('Commands registered for guild: ' + guildId);
  } catch(e) { console.error('Command registration error:', e.message); }
}

client.once('clientReady', async () => {
  console.log('Jarvis online: ' + client.user.tag);

  // Register commands in all guilds
  for (const [id] of client.guilds.cache) {
    await registerCommands(id);
  }

  // Set up Jarvis HQ channels
  await setupJarvisHQ();

  // Morning digest 8am EST
  cron.schedule('0 8 * * *', async () => {
    const hqGuild = client.guilds.cache.get(JARVIS_HQ_GUILD);
    if (hqGuild) {
      const ch = hqGuild.channels.cache.find(c => c.name.includes('daily-brief'));
      if (ch) { const digest = await buildDigest(); ch.send({ embeds: [digest] }); }
    }
  }, { timezone: 'America/New_York' });

  // Slack check every 30 min
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
        const embed = new EmbedBuilder().setTitle('🎯 Your Top Priorities').setColor('#5865F2')
          .setDescription(p.map((x,i) => (i+1)+'. '+x).join('\n')).setTimestamp();
        await interaction.editReply({ embeds: [embed] });

        // Also post to HQ priorities channel
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq && interaction.guildId !== JARVIS_HQ_GUILD) {
          const ch = hq.channels.cache.find(c => c.name.includes('priorities'));
          if (ch) ch.send({ embeds: [embed] });
        }
        break;
      }
      case 'digest': { await interaction.editReply({ embeds: [await buildDigest()] }); break; }
      case 'calendar': {
        const cal = new GoogleCalendar();
        const events = await cal.getTodayEvents();
        const embed = new EmbedBuilder().setTitle("📅 Today's Calendar").setColor('#4285F4')
          .setDescription(events.length ? events.map(e => '**'+e.time+'** — '+e.title).join('\n') : 'No events today 🎉').setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'ask': {
        const q = interaction.options.getString('question');
        const claude = new ClaudeAI();
        const a = await claude.ask(q);
        const embed = new EmbedBuilder().setTitle('🤖 Jarvis').setColor('#FEE75C')
          .addFields({name:'❓ Question',value:q},{name:'💬 Answer',value:a.slice(0,1024)}).setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'sop': {
        const topic = interaction.options.getString('topic');
        const sop = new SOPManager();
        const result = await sop.getOrCreate(topic);
        const embed = new EmbedBuilder().setTitle('📘 SOP: '+topic).setColor('#57F287').setDescription(result.slice(0,4096)).setTimestamp();
        await interaction.editReply({ embeds: [embed] });

        // Save to HQ sop library
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) {
          const ch = hq.channels.cache.find(c => c.name.includes('sop-library'));
          if (ch) ch.send({ embeds: [embed] });
        }
        break;
      }
      case 'standup': {
        const embed = new EmbedBuilder().setTitle('📣 Daily Standup!').setColor('#EB459E')
          .setDescription('**1.** What did you accomplish yesterday?\n**2.** What are you working on today?\n**3.** Any blockers?').setTimestamp();
        await interaction.editReply({ embeds: [embed] }); break;
      }
      case 'urgent': {
        const msg = interaction.options.getString('message');
        const embed = new EmbedBuilder().setTitle('🚨 URGENT').setColor('#ED4245')
          .setDescription(msg).addFields({name:'Flagged by',value:interaction.user.toString()}).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        // Alert in HQ
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) {
          const ch = hq.channels.cache.find(c => c.name.includes('flags-and-issues'));
          if (ch) ch.send({ content: '<@&everyone>', embeds: [embed] });
        }
        break;
      }
      case 'closer': {
        const name = interaction.options.getString('name');
        const update = interaction.options.getString('update');
        const embed = new EmbedBuilder().setTitle('📊 Closer Update: '+name).setColor('#57F287')
          .setDescription(update).addFields({name:'Logged by',value:interaction.user.toString()},{name:'Date',value:new Date().toLocaleDateString()}).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        // Log to HQ closer-updates
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) {
          const ch = hq.channels.cache.find(c => c.name.includes('closer-updates'));
          if (ch) ch.send({ embeds: [embed] });
        }
        break;
      }
      case 'followup': {
        const person = interaction.options.getString('person');
        const note = interaction.options.getString('note');
        const embed = new EmbedBuilder().setTitle('🔔 Follow-up Logged').setColor('#FEE75C')
          .addFields({name:'With',value:person},{name:'About',value:note},{name:'Logged',value:new Date().toLocaleDateString()}).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        // Send to HQ reminders
        const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
        if (hq) {
          const ch = hq.channels.cache.find(c => c.name.includes('reminders'));
          if (ch) ch.send({ embeds: [embed] });
        }
        break;
      }
    }
  } catch(e) { console.error('Command error:', e); await interaction.editReply('❌ Error: '+e.message); }
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  const urgent = ['urgent','asap','emergency','critical'];
  if (urgent.some(k => msg.content.toLowerCase().includes(k))) {
    const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
    if (hq) {
      const ch = hq.channels.cache.find(c => c.name.includes('flags-and-issues'));
      if (ch) {
        const embed = new EmbedBuilder().setTitle('⚠️ Urgent Message Detected').setColor('#ED4245')
          .setDescription('**From:** '+msg.author+'\n**Server:** '+(msg.guild?.name||'DM')+'\n**Message:** '+msg.content).setTimestamp();
        ch.send({ embeds: [embed] });
      }
    }
  }
});

async function buildDigest() {
  const cal = new GoogleCalendar(); const slack = new SlackIntegration(); const engine = new PriorityEngine();
  const [events, slackSummary, priorities] = await Promise.allSettled([cal.getTodayEvents(), slack.getDailySummary(), engine.getTopPriorities()]);
  const embed = new EmbedBuilder()
    .setTitle('📰 Good Morning Kyle — ' + new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}))
    .setColor('#5865F2').setTimestamp();
  if (priorities.status==='fulfilled'&&priorities.value.length) embed.addFields({name:'🎯 Top Priorities',value:priorities.value.map((p,i)=>(i+1)+'. '+p).join('\n')});
  if (events.status==='fulfilled'&&events.value.length) embed.addFields({name:'📅 Calendar Today',value:events.value.map(e=>'• **'+e.time+'** '+e.title).join('\n')});
  if (slackSummary.status==='fulfilled') embed.addFields({name:'💬 Slack',value:slackSummary.value||'No activity'});
  embed.setFooter({text:'🤖 Jarvis • Your AI Chief of Staff'});
  return embed;
}

async function checkSlackUrgent() {
  try {
    const slack = new SlackIntegration(); const urgent = await slack.getUrgentMessages();
    if (urgent.length) {
      const hq = client.guilds.cache.get(JARVIS_HQ_GUILD);
      if (hq) {
        const ch = hq.channels.cache.find(c => c.name.includes('flags-and-issues'));
        if (ch) for (const m of urgent) {
          const embed = new EmbedBuilder().setTitle('💬 Urgent Slack').setColor('#ED4245')
            .setDescription('**From:** '+m.user+'\n**#'+m.channel+'**\n'+m.text).setTimestamp();
          ch.send({ embeds: [embed] });
        }
      }
    }
  } catch(e) {}
}

client.login(process.env.DISCORD_TOKEN);