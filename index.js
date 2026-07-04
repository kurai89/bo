require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior
} = require("@discordjs/voice");

const playdl = require("play-dl");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let connection;
let player;
let queue = [];

// 🎧 Create player
function createPlayer() {
    player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
        },
    });

    player.on(AudioPlayerStatus.Idle, () => {
        queue.shift();
        playNext();
    });
}

// ▶️ Play next song
async function playNext() {
    if (!queue.length) return;

    const url = queue[0];

    const stream = await playdl.stream(url);
    const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
    });

    player.play(resource);
    connection.subscribe(player);

    console.log("Playing:", url);
}

// 📜 Slash commands
const commands = [
    new SlashCommandBuilder().setName("play").setDescription("Play YouTube song").addStringOption(opt =>
        opt.setName("url").setDescription("YouTube URL").setRequired(true)
    ),
    new SlashCommandBuilder().setName("skip").setDescription("Skip song"),
    new SlashCommandBuilder().setName("stop").setDescription("Stop music"),
];

// 🚀 Register commands
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
    );
}

// 🤖 Ready
client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
});

// 🎮 Commands
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const voiceChannel = interaction.member.voice.channel;

    // PLAY
    if (interaction.commandName === "play") {
        if (!voiceChannel) return interaction.reply("Join a voice channel first.");

        const url = interaction.options.getString("url");

        queue.push(url);

        if (!connection) {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            createPlayer();
            playNext();
        }

        return interaction.reply(`Added to queue 🎵`);
    }

    // SKIP
    if (interaction.commandName === "skip") {
        player.stop();
        return interaction.reply("Skipped ⏭️");
    }

    // STOP
    if (interaction.commandName === "stop") {
        queue = [];
        player.stop();
        connection.destroy();
        connection = null;

        return interaction.reply("Stopped ⛔");
    }
});

// 🔐 Login
client.login(process.env.TOKEN);

// 🧯 Safety
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
