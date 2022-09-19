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
    console.log("getQaIndex: userId=" + userId);
    console.log("users 's len=" + users.length);
    for (user of users) {
        console.log("getQaIndex: user=" + user);
        if (user.userId == userId) {
            qaIndex = user.qaIndex;
            console.log("getQaIndex: user found");
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
    console.log("isCorrect: userId=" + userId);
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
function sendMessage(str, events_processed, event) {
    events_processed.push(bot.pushMessage(event.source.userId, {
        type: "text",
        text: str
    }));
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
function sendQuestion(events_processed, event) {
    let i = getRandomQuestionIndex();
    let t = questions[i];
    setQaIndex(event.source.userId, i);
    let j = getJsonQuestion(t);
    events_processed.push(bot.pushMessage(event.source.userId, j));
}

// ランダムに選んだ問題をメッセージ送信する(reply)
function replyQuestion(events_processed, event) {
    console.log("replyQuestion()");
    let i = getRandomQuestionIndex();
    let t = questions[i];
    setQaIndex(event.source.userId, i);
    let j = getJsonQuestion(t);
    events_processed.push(bot.replyMessage(event.replyToken, j));
}

// -----------------------------------------------------------------------------
// ルーター設定
server.post('/bot/webhook', line.middleware(line_config), (req, res, next) => {
    // 先行してLINE側にステータスコード200でレスポンスする。
    res.sendStatus(200);
    console.log("server.post 0");

    // すべてのイベント処理のプロミスを格納する配列。
    let events_processed = [];

    // イベントオブジェクトを順次処理。
    req.body.events.forEach((event) => {
        console.log("event: " + event);
        // この処理の対象をイベントタイプがメッセージで、かつ、テキストタイプだった場合に限定。
        if (event.type == "message" && event.message.type == "text") {
            console.log("userId: " + event.source.userId);
            if (isQuestion(event.message.text)) {
                console.log("this is a question");
                setContinuousCorrect(event.source.userId, 0);
                replyQuestion(events_processed, event);
            } else if (event.message.text == "こんにちは") {
                // replyMessage()で返信し、そのプロミスをevents_processedに追加。
                events_processed.push(bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "はいこんにちは、今日も勉強がんばりましょう!"
                }));
            } else if (event.message.text == "あれ") {
                events_processed.push(bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "$ ok!",
                    emojis: [
                        {
                            index: 0,
                            productId: "5ac1bfd5040ab15980c9b435",
                            emojiId: "068"
                        }
                    ]
                }));
            } else {
                if (getQaIndex(event.source.userId) < 0) {
                    console.log("mondai dashite");
                    events_processed.push(bot.replyMessage(event.replyToken, {
                        type: "text",
                        text: "「問題出して」とか言ってみて"
                    }));
                } else {
                    console.log("server.post:1");
                    if (isCorrect(event.source.userId, event.message.text)) {
                        console.log("server.post:2");
                        events_processed.push(bot.replyMessage(event.replyToken, {
                            type: "text",
                            text: "$ 正解です!",
                            emojis: [
                                {
                                    index: 0,
                                    productId: "5ac1bfd5040ab15980c9b435",
                                    emojiId: "068"
                                }
                            ]
                        }));
                        setTimeout(() => {
                            console.log("setTimeout1");
                            let c = getContinuousCorrect(event.source.userId);
                            if (c == 10) {
                                sendMessage(`10問連続正解です! おめでとう!!! 今日はゲームできるかも(お母さんに聞いてみてね)`, events_processed, event);
                                return;
                            } else if (c >= 2) {
                                sendMessage(`${c}問連続正解です! それでは…`, events_processed, event);
                            } else {
                                sendMessage(`やりますね、それでは…`, events_processed, event);
                            }
                            setTimeout(() => {
                                console.log("setTimeout2");
                                sendQuestion(events_processed, event);
                            }, 1000);
                        }, 1000);
                        console.log("server.post:3");
                    } else {
                        events_processed.push(bot.replyMessage(event.replyToken, {
                            type: "text",
                            text: "あれだけ言ったのに、まだわからんのかー!!"
                        }));
                    }
                }
            }
        }
    });

    console.log("promise start");
    console.log("events_processed's length: " + events_processed.length);
    // すべてのイベント処理が終了したら何個のイベントが処理されたか出力。
    Promise.all(events_processed).then(
        (response) => {
            console.log(`${response.length} event(s) processed.`);
        }
    );
    console.log("server.post end");
});