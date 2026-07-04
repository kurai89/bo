require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior,
} = require("@discordjs/voice");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

let connection;
let player;

// 🎵 STREAM URL (replace with radio / stream link)
const STREAM_URL = "http://stream.zeno.fm/your-radio-stream";

async function connectVoice(channel) {
    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
    });

    console.log("Joined voice channel");

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log("Disconnected → reconnecting...");

        try {
            await entersState(connection, VoiceConnectionStatus.Signalling, 5000);
        } catch {
            setTimeout(() => {
                connectVoice(channel);
            }, 3000);
        }
    });

    return connection;
}

function startStream() {
    if (!connection) return;

    player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
        },
    });

    const resource = createAudioResource(STREAM_URL);

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        console.log("Stream dropped → restarting...");
        startStream();
    });

    console.log("Streaming started");
}

// 📜 Slash commands
const commands = [
    new SlashCommandBuilder()
        .setName("join")
        .setDescription("Bot joins your voice channel"),

    new SlashCommandBuilder()
        .setName("leave")
        .setDescription("Bot leaves voice channel"),
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
    );
    console.log("Slash commands registered");
}

// 🤖 Bot ready
client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
});

// 🧠 Command handler
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // JOIN
    if (interaction.commandName === "join") {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply("Join a voice channel first.");
        }

        await connectVoice(channel);
        startStream();

        return interaction.reply("Joined voice & started 24/7 stream 🎵");
    }

    // LEAVE
    if (interaction.commandName === "leave") {
        if (connection) connection.destroy();
        connection = null;

        return interaction.reply("Left voice channel 👋");
    }
});

// 🧯 safety
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// 🔐 login
client.login(process.env.TOKEN);
