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
        .setDescription("Play music")
        .addStringOption(opt =>
            opt.setName("query")
                .setDescription("Song name or YouTube URL")
                .setRequired(true)
        ),

    new SlashCommandBuilder().setName("skip").setDescription("Skip song"),
    new SlashCommandBuilder().setName("stop").setDescription("Stop music"),
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

    player.on("error", (err) => {
        console.log("Player error:", err);
        queue.shift();
        playNext();
    });
}

/* ---------------- PLAY FUNCTION (FIXED) ---------------- */

async function playNext() {
    if (!queue.length) {
        isPlaying = false;
        return;
    }

    isPlaying = true;

    const url = queue[0];

    try {
        console.log("Loading:", url);

        const stream = await playdl.stream(url);

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
        });

        if (!player) createPlayer();

        player.play(resource);

        if (connection) {
            connection.subscribe(player);
        }

        console.log("Now playing:", url);

    } catch (err) {
        console.log("Stream error:", err);
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

    console.log("Joining voice:", voiceChannel.name);

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
        }

        if (!player) createPlayer();

        if (!isPlaying) {
            playNext();
        }

        return interaction.reply("Added to queue 🎵");
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
});

/* ---------------- SAFETY ---------------- */

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* ---------------- LOGIN ---------------- */

client.login(process.env.TOKEN);
