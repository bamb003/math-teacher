// -----------------------------------------------------------------------------
// モジュールのインポート
const server = require("express")();
const line = require("@line/bot-sdk"); // Messaging APIのSDKをインポート

// -----------------------------------------------------------------------------
// パラメータ設定
const line_config = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN, // 環境変数からアクセストークンをセットしています
    channelSecret: process.env.LINE_CHANNEL_SECRET // 環境変数からChannel Secretをセットしています
};

// -----------------------------------------------------------------------------
// Webサーバー設定
server.listen(process.env.PORT || 3000);

// APIコールのためのクライアントインスタンスを作成
const bot = new line.Client(line_config);

const questions = [
    "1kmは何m?",
    "1kgは何g?",
    "1cmは何mm?",
    "1mは何cm?",
    "1cmは何mm?",
    "1mは何km?",
    "0.1mは何cm?",
    "0.1kmは何m?",
    "0.01kmは何m?",
    "1mmは何cm?"
];
const correctAnswers = ["1000", "1000", "10", "100", "10", "0.001", "10", "100", "10", "0.1"];

let users = [];

// min <= x < max となる整数xを返す
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

// 引数で渡されたユーザからのtextが、「問題出して」とか「つぎ」とかを含んでいたらtrueを返す(=出題を要求している)
// trueの場合、出題を行う必要アリ
function isQuestion(text) {
    if (text.includes("問題")) {
        return true;
    }
    if (text.includes("もんだい")) {
        return true;
    }
    if (text.includes("次")) {
        return true;
    }
    if (text.includes("つぎ")) {
        return true;
    }
    return false;
}

// 乱数で決めた問題indexを返す
function getRandomQuestionIndex() {
    let rand = getRandomInt(0, questions.length);
    return rand;
}

function getQaIndex(userId) {
    for (user of users) {
        if (user.userId == userId) {
            qaIndex = user.qaIndex;
            return qaIndex;
        }
    }
    return -1;
}

function setQaIndex(userId, index) {
    for (user of users) {
        if (user.userId == userId) {
            user.qaIndex = index;
            return;
        }
    }
    let elem = {
        userId: userId,
        qaIndex: index,
        continuousCorrect: 0
    }
    users.push(elem);
}

// 引数userの連続正解数を返す
function getContinuousCorrect(userId) {
    for (user of users) {
        if (user.userId == userId) {
            return user.continuousCorrect;
        }
    }
    return -1;
}

// 引数userの連続正解数を++する
function addContinuousCorrect(userId) {
    for (user of users) {
        if (user.userId == userId) {
            user.continuousCorrect = user.continuousCorrect + 1;
            return;
        }
    }
}

// 引数userの連続正解数に引数countをsetする
function setContinuousCorrect(userId, count) {
    for (user of users) {
        if (user.userId == userId) {
            user.continuousCorrect = count;
            return;
        }
    }
}

// 引数userの引数text(回答)が正解の場合trueを返す
function isCorrect(userId, text) {
    let qaIndex = getQaIndex(userId)
    if (qaIndex < 0) {
        return false;
    }
    const correctAnswer = correctAnswers[qaIndex];
    if (text == correctAnswer) {
        addContinuousCorrect(userId);
        return true;
    } else {
        setContinuousCorrect(userId, 0);
        return false;
    }
}

// 引数strをメッセージ送信する
// Promiseを返す
function sendMessage(str, events_processed, event) {
    return bot.pushMessage(event.source.userId, {
        type: "text",
        text: str
    });
}

// 問題1問を表現するjsonを返す
function getJsonQuestion(str) {
    return {
        type: "text",
        text: str,
        quickReply: {
            items: [
                {
                    type: "action",
                    action: {
                        type: "message",
                        label: "0.001",
                        text: "0.001"
                    }
                },
                {
                    type: "action",
                    action: {
                        type: "message",
                        label: "0.01",
                        text: "0.01"
                    }
                },
                {
                    type: "action",
                    action: {
                        type: "message",
                        label: "0.1",
                        text: "0.1"
                    }
                },
                {
                    type: "action",
                    action: {
                        type: "message",
                        label: "10",
                        text: "10"
                    }
                },
                {
                    type: "action",
                    action: {
                        type: "message",
                        label: "100",
                        text: "100"
                    }
                },
                {
                    type: "action",
                    action: {
                        type: "message",
                        label: "1000",
                        text: "1000"
                    }
                },
            ]
        }
    };
}

// ランダムに選んだ問題をメッセージ送信する(replyではない)
// Promseを返す
function sendQuestion(event) {
    let i = getRandomQuestionIndex();
    let t = questions[i];
    setQaIndex(event.source.userId, i);
    let j = getJsonQuestion(t);
    return bot.pushMessage(event.source.userId, j);
}

// ランダムに選んだ問題をメッセージ送信する(reply)
// Promseを返す
function replyQuestion(event) {
    let i = getRandomQuestionIndex();
    let t = questions[i];
    setQaIndex(event.source.userId, i);
    let j = getJsonQuestion(t);
    return bot.replyMessage(event.replyToken, j);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------------
// ルーター設定
server.post('/bot/webhook', line.middleware(line_config), async (req, res, next) => {
    // 先行してLINE側にステータスコード200でレスポンスする。
    console.log("server.post 0");

    // すべてのイベント処理のプロミスを格納する配列。
    let events_processed = [];

    // イベントオブジェクトを順次処理。
    req.body.events.forEach((event) => {
        console.log("event: " + event);
        needWait = false;
        // この処理の対象をイベントタイプがメッセージで、かつ、テキストタイプだった場合に限定。
        if (event.type == "message" && event.message.type == "text") {
            if (isQuestion(event.message.text)) {
                setContinuousCorrect(event.source.userId, 0);
                await replyQuestion(event);
            } else if (event.message.text == "こんにちは") {
                // replyMessage()で返信し、そのプロミスをevents_processedに追加。
                await bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "はいこんにちは、今日も勉強がんばりましょう!"
                });
            } else if (event.message.text == "あれ") {
                await bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "$ ok!",
                    emojis: [
                        {
                            index: 0,
                            productId: "5ac1bfd5040ab15980c9b435",
                            emojiId: "068"
                        }
                    ]
                });
            } else {
                if (getQaIndex(event.source.userId) < 0) {
                    await bot.replyMessage(event.replyToken, {
                        type: "text",
                        text: "「問題出して」とか言ってみて"
                    });
                } else {
                    if (isCorrect(event.source.userId, event.message.text)) {
                        await bot.replyMessage(event.replyToken, {
                            type: "text",
                            text: "$ 正解です!",
                            emojis: [
                                {
                                    index: 0,
                                    productId: "5ac1bfd5040ab15980c9b435",
                                    emojiId: "068"
                                }
                            ]
                        });
                        sleep(1000);
                        let c = getContinuousCorrect(event.source.userId);
                        if (c == 10) {
                            await sendMessage(`10問連続正解です! おめでとう!!! 今日はゲームできるかも(お母さんに聞いてみてね)`, events_processed, event);
                            return;
                        } else if (c >= 2) {
                            await sendMessage(`${c}問連続正解です! それでは…`, events_processed, event);
                        } else {
                            await sendMessage(`やりますね、それでは…`, events_processed, event);
                        }
                        sleep(1000);
                        await sendQuestion(event);
                    } else {
                        await bot.replyMessage(event.replyToken, {
                            type: "text",
                            text: "あれだけ言ったのに、まだわからんのかー!!"
                        });
                    }
                }
            }
        }
    });

    // すべてのイベント処理が終了したら何個のイベントが処理されたか出力。
    res.sendStatus(200);    
    console.log("server.post end");
});