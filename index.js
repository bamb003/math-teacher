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

const questions = ["1kmは何m?", "1kgは何g?", "1cmは何mm?", "1mは何cm?", "1cmは何mm?", "1mは何km?"];

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

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

function getQuestion() {
    let rand = getRandomInt(0, questions.length);
    return questions[rand];
}

// -----------------------------------------------------------------------------
// ルーター設定
server.post('/bot/webhook', line.middleware(line_config), (req, res, next) => {
    // 先行してLINE側にステータスコード200でレスポンスする。
    res.sendStatus(200);

    // すべてのイベント処理のプロミスを格納する配列。
    let events_processed = [];

    // イベントオブジェクトを順次処理。
    req.body.events.forEach((event) => {
        // この処理の対象をイベントタイプがメッセージで、かつ、テキストタイプだった場合に限定。
        if (event.type == "message" && event.message.type == "text") {
            // ユーザーからのテキストメッセージが「こんにちは」だった場合のみ反応。
            if (isQuestion(event.message.text)) {
                let t = getQuestion();
                events_processed.push(bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: t,
                    quickReply: { // ②
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
                                    label: "1",
                                    text: "1"
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
                }));
            } else if (event.message.text == "こんにちは") {
                // replyMessage()で返信し、そのプロミスをevents_processedに追加。
                events_processed.push(bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "これはこれは"
                }));
            } else if (event.message.text == "あれ") {
                events_processed.push(bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "おっけー $",
                    emojis: [
                        {
                            index: 0,
                            productId: "5ac1bfd5040ab15980c9b435",
                            emojiId: "068"
                        }
                    ]
                }));
            } else {
                events_processed.push(bot.replyMessage(event.replyToken, {
                    type: "text",
                    text: "あれだけ言ったのに、まだわからんのかー!!"
                }));
            }
        }
    });

    // すべてのイベント処理が終了したら何個のイベントが処理されたか出力。
    Promise.all(events_processed).then(
        (response) => {
            console.log(`${response.length} event(s) processed.`);
        }
    );
});