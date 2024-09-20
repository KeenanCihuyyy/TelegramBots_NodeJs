const root = require("node-telegram-bot-api");
const fs = require("fs");

const token = "7395566349:AAFFuU9TgJegE9cqo68tf40J__s7eeGxv0I";
const bot = new root(token, { polling: true });

const OWNER_ID = 6354701765;
const reportGroup = -1002469730932;

let anonymousUsers = {};
let activeSessions = {};
let bannedUsers = {};

if (fs.existsSync("banned.json")) {
    bannedUsers = JSON.parse(fs.readFileSync("banned.json", "utf8"));
}

function saveBannedUsers() {
    fs.writeFileSync("banned.json", JSON.stringify(bannedUsers, null, 2));
}

function getRandomPartner(excludeId) {
    const users = Object.keys(anonymousUsers).filter(
        (id) => id !== excludeId.toString(),
    );
    if (users.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * users.length);
    return anonymousUsers[users[randomIndex]];
}

function endSession(userId) {
    const partnerId = activeSessions[userId];
    if (partnerId) {
        bot.sendMessage(userId, "Your anonymous session has ended.");
        bot.sendMessage(partnerId, "Your partner has left the session.");
        delete activeSessions[userId];
        delete activeSessions[partnerId];
    }
    if (Object.values(activeSessions).indexOf(userId) === -1) {
        delete anonymousUsers[userId];
    }
}

bot.onText(/\/go/, (msg) => {
    const userId = msg.chat.id;

    if (bannedUsers[userId]) {
        return bot.sendMessage(userId, "You are banned and cannot use this bot.\n\nType /chatowner <message> to appeal or send feedback.",
        );
    }

    if (activeSessions[userId]) {
        return bot.sendMessage(userId, "You are already in an anonymous session.");
    }

    if (anonymousUsers[userId]) {
        const partner = getRandomPartner(userId);
        if (partner) {
            activeSessions[userId] = partner.id;
            activeSessions[partner.id] = userId;

            bot.sendMessage(userId, "You are now connected with an anonymous partner.");
            bot.sendMessage(partner.id, "You are now connected with an anonymous partner.");
        } else {
            bot.sendMessage(userId, "Waiting for an anonymous partner...");
        }
    } else {
        const partner = getRandomPartner(userId);
        if (partner) {
            activeSessions[userId] = partner.id;
            activeSessions[partner.id] = userId;

            bot.sendMessage(userId, "You are now connected with an anonymous partner.");
            bot.sendMessage(partner.id, "You are now connected with an anonymous partner.");
        } else {
            anonymousUsers[userId] = {
                id: userId,
                name: msg.chat.first_name,
                username: msg.chat.username,
            };
            bot.sendMessage(userId, "Waiting for an anonymous partner...");
        }
    }
});

bot.onText(/\/stop/, (msg) => {
    const userId = msg.chat.id;

    if (!activeSessions[userId]) {
        return bot.sendMessage(userId, "You are not in an anonymous session.");
    }

    endSession(userId);
});

bot.on("message", (msg) => {
    const userId = msg.chat.id;

    const partnerId = activeSessions[userId];
    if (partnerId && msg.text && !msg.text.startsWith("/")) {
        bot.sendMessage(partnerId, msg.text);
    }
});

bot.onText(/\/report/, (msg) => {
    const userId = msg.chat.id;

    if (!msg.reply_to_message) {
        return bot.sendMessage(userId, "Please use the /report command by replying to the message you want to report.");
    }

    const partnerId = activeSessions[userId];
    if (partnerId) {
        const reportInfo = `Anonymous session report:\n` + `Reporter ID: ${userId}\nOffender ID: ${partnerId}\n\nMessage: ${msg.reply_to_message.text}`;

        bot.sendMessage(OWNER_ID, reportInfo);
        bot.sendMessage(userId, "The report has been sent to the owner.");
    }
});

bot.onText(/\/chat (\d+) (.+)/, (msg, match) => {
    const userId = msg.chat.id;

    if (userId !== OWNER_ID) {
        return bot.sendMessage(userId, "You do not have permission to use this command.");
    }
    const targetId = match[1];
    const message = match[2];
    bot.sendMessage(targetId, message);
    bot.sendMessage(OWNER_ID, `Message sent to ${targetId}: ${message}`);
});

bot.onText(/\/ban (.+)/, (msg, match) => {
    const userId = msg.from.id;

    if (userId !== OWNER_ID) {
        return bot.sendMessage(userId, "You do not have permission to use this command.");
    }

    const bannedUserId = match[1];
    bannedUsers[bannedUserId] = true;
    saveBannedUsers();

    bot.sendMessage(REPORT_GROUP, `User with ID ${bannedUserId} has been banned.`);
});

bot.onText(/\/unban (.+)/, (msg, match) => {
    const userId = msg.from.id;

    if (userId !== OWNER_ID) {
        return bot.sendMessage(userId, "You do not have permission to use this command.");
    }

    const unbannedUserId = match[1];
    delete bannedUsers[unbannedUserId];
    saveBannedUsers();

    bot.sendMessage(REPORT_GROUP, `User with ID ${unbannedUserId} has been unbanned.`);
});

bot.onText(/\/chatowner (.+)/, (msg, match) => {
    const userId = msg.chat.id;
    const message = match[1];

    const chatToOwner = `Anonymous message to the owner:\n` + `ID: ${userId}\n` + `Username: @${msg.chat.username || "None"}\n` + `First Name: ${msg.chat.first_name || "None"}\n` + `Last Name: ${msg.chat.last_name || "None"}\n` + `Message: ${message}`;

    bot.sendMessage(OWNER_ID, chatToOwner);
    bot.sendMessage(userId, "Your message has been sent to the owner.");
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `Hello @${msg.from.username}, welcome to the anonymous chat bot!

Type "/go" to start searching for a partner.
Type "/stop" to end the session.
Type "/report <reply to message>" to report the user (partner) to the owner for banning (You must be in a session).
Type "/chatowner <message>" to appeal a ban or send feedback.`;
    bot.sendMessage(chatId, welcomeText);
});

bot.on("message", (msg) => {
    const chatId = msg.from.id;
    const text = msg.text;
    const username = msg.from.username;
    bot.sendMessage(reportGroup, `User: @${username}\nID: ${chatId}\nMessage: ${text}`);
});