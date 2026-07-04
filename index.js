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
        .addStringOption(option =>
            option
                .setName("query")
                .setDescription("Song name or YouTube URL")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip song"),

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
    try {
        if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
            console.log("Missing CLIENT_ID or GUILD_ID");
            return;
        }

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("Slash commands registered ✅");
    } catch (err) {
        console.log("Command register error:", err);
    }
}

/* ---------------- PLAYER ---------------- */

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

/* ---------------- PLAY NEXT ---------------- */

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
        console.log("Play error:", err);
        queue.shift();
        playNext();
    }
}

/* ---------------- JOIN VOICE ---------------- */

async function joinVoice(voiceChannel) {
    connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
    });

    console.log("Joined voice:", voiceChannel.name);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        console.log("Voice READY");
    } catch (err) {
        console.log("Voice failed:", err);
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

        const query = interaction.options.getString("query");

        let url = query;

        if (!query.startsWith("http")) {
            const result = await playdl.search(query, { limit: 1 });

            if (!result.length)
                return interaction.reply("No results found.");

            url = result[0].url;
        }

        queue.push(url);

        if (!connection) {
            await joinVoice(voiceChannel);

            createPlayer();
            playNext();
        } else if (!isPlaying) {
            playNext();
        }

        return interaction.reply(`Added to queue 🎵`);
    }

    /* SKIP */
    if (interaction.commandName === "skip") {
        player?.stop();
        return interaction.reply("Skipped ⏭️");
    }

    /* STOP */
    if (interaction.commandName === "stop") {
        queue = [];
        player?.stop();
        connection?.destroy();
        connection = null;
        isPlaying = false;

        return interaction.reply("Stopped ⛔");
    }

    /* PAUSE */
    if (interaction.commandName === "pause") {
        player?.pause();
        return interaction.reply("Paused ⏸️");
    }

    /* RESUME */
    if (interaction.commandName === "resume") {
        player?.unpause();
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
