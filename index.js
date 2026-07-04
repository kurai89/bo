require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
} = require("discord.js");

const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
} = require("@discordjs/voice");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

let connection;

async function joinVC() {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);

    if (!guild) {
        console.log("Guild not found.");
        return;
    }

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);

    if (!channel) {
        console.log("Voice channel not found.");
        return;
    }

    connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
    });

    console.log(`Connected to ${channel.name}`);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log("Disconnected...");

        try {
            await entersState(
                connection,
                VoiceConnectionStatus.Signalling,
                5000
            );
        } catch {
            console.log("Reconnecting in 5 seconds...");

            setTimeout(() => {
                joinVC();
            }, 5000);
        }
    });
}

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    joinVC();
});

client.login(process.env.TOKEN);
