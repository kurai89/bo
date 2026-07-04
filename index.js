require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
} = require("discord.js");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    entersState,
    VoiceConnectionStatus,
} = require("@discordjs/voice");

const playdl = require("play-dl");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

let connection;
let player;

let queue = [];
let isPlaying = false;

/* ---------------- COMMANDS ---------------- */

const commands = [
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song from YouTube")
        .addStringOption(opt =>
            opt.setName("query")
                .setDescription("YouTube URL or search term")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip current song"),

    new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop music and clear queue"),

    new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Pause music"),

    new SlashCommandBuilder()
        .setName("resume")
        .setDescription("Resume music"),

    new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Show queue"),
];

/* ---------------- REGISTER COMMANDS ---------------- */

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
        ),
        { body: commands }
    );
    console.log("Commands registered");
}

/* ---------------- VOICE + PLAYER ---------------- */

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

async function playNext() {
    if (!queue.length) {
        isPlaying = false;
        return;
    }

    isPlaying = true;

    const url = queue[0];

    try {
        const stream = await playdl.stream(url);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
        });

        player.play(resource);
        connection.subscribe(player);

        console.log("Now playing:", url);
    } catch (err) {
        console.log("Error playing song:", err);
        queue.shift();
        playNext();
    }
}

/* ---------------- READY ---------------- */

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
});

/* ---------------- COMMAND HANDLER ---------------- */

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const voiceChannel = interaction.member.voice.channel;

    /* PLAY */
    if (interaction.commandName === "play") {
        if (!voiceChannel)
            return interaction.reply("Join a voice channel first.");

        let query = interaction.options.getString("query");

        // If not URL → search YouTube
        if (!query.startsWith("http")) {
            const search = await playdl.search(query, { limit: 1 });
            if (!search.length)
                return interaction.reply("No results found.");

            query = search[0].url;
        }

        queue.push(query);

        if (!connection) {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            createPlayer();
            playNext();
        } else if (!isPlaying) {
            playNext();
        }

        return interaction.reply(`Added to queue 🎵`);
    }

    /* SKIP */
    if (interaction.commandName === "skip") {
        player.stop();
        return interaction.reply("Skipped ⏭️");
    }

    /* STOP */
    if (interaction.commandName === "stop") {
        queue = [];
        if (player) player.stop();
        if (connection) connection.destroy();

        connection = null;
        isPlaying = false;

        return interaction.reply("Stopped ⛔");
    }

    /* PAUSE */
    if (interaction.commandName === "pause") {
        player.pause();
        return interaction.reply("Paused ⏸️");
    }

    /* RESUME */
    if (interaction.commandName === "resume") {
        player.unpause();
        return interaction.reply("Resumed ▶️");
    }

    /* QUEUE */
    if (interaction.commandName === "queue") {
        if (!queue.length)
            return interaction.reply("Queue is empty.");

        return interaction.reply(
            "🎵 Queue:\n" +
            queue.map((q, i) => `${i + 1}. ${q}`).join("\n")
        );
    }
});

/* ---------------- SAFETY ---------------- */

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* ---------------- LOGIN ---------------- */

client.login(process.env.TOKEN);
