import * as builder from 'botbuilder';
import * as teamBuilder from 'botbuilder-teams';
import { BotDeclaration, IBot } from 'express-msteams-host';
import * as debug from "debug";
import axios from 'axios';
import { Session } from 'inspector';
import { Result } from 'range-parser';

const { firstEntity, WIT_TOKEN } = require('../../shared.js');
const Wit = require('node-wit/lib/wit');
// Initialize debug logging module
const log = debug("msteams");
const auth = require('../../auth');
const wit = new Wit({ accessToken: WIT_TOKEN });
var moment = require('moment');
const { Client } = require('pg');
var request = require('request');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
});

client.connect();

//Adding Authentication and calling graph api.
// const AuthenticationContext = require('adal-node').AuthenticationContext;
// const MicrosoftGraph = require("@microsoft/microsoft-graph-client");
// const authorityHostUrl = 'https://login.windows.net';
// const tenantName = 'rsyorg.onmicrosoft.com'; //azure active directory tenant name. ie: name.onmicrosoft.com
// const authorityUrl = authorityHostUrl + '/' + tenantName;
// const applicationId = 'cb441bf2-9b70-46cb-b4f5-6a6b15d1113b'; //application id for registered app
// const clientSecret = '0VujIz?K|}&scPsR&LYygs0B_2@Xg22XP]*B;23Gi3+/M-D?t@71H'; //azure active directory registered app secret
// const resource = "https://graph.microsoft.com"; //URI of resource where token is valid

/**
 * Implementation for roombooking Bot
 */
var TokenVar = "";
var url = "";
var floor_choice = "";
var room_Type_choice = "";
var building_choice = "";
var start_date = "";
var end_date = "";
var start_time = "";
var end_time = "";
var room_id = "";
var email = "";
var duration = "";
var random = "";

@BotDeclaration(
    '/api/messages',
    process.env.MICROSOFT_APP_ID,
    process.env.MICROSOFT_APP_PASSWORD)

export class roombookingBot implements IBot {

    public readonly Connector: teamBuilder.TeamsChatConnector;
    private readonly universalBot: builder.UniversalBot;
    private inMemoryStorage: builder.IBotStorage;

    /**
     * The constructor
     * @param connector 
     */

    public constructor(connector: teamBuilder.TeamsChatConnector) {
        this.Connector = connector;
        this.inMemoryStorage = new builder.MemoryBotStorage();
        this.universalBot = new builder.UniversalBot(this.Connector).
            set('storage', this.inMemoryStorage); // Use the in-memory storage for state

        // Install sendTyping as middleware
        this.universalBot.use({
            botbuilder: (session, next) => {
                session.sendTyping();
                next();
            }
        });

        // Add dialogs here
        this.universalBot.dialog('/', this.defaultDialog);
        this.universalBot.dialog('/help', this.helpDialog);

        //show bookings intent

        this.universalBot.dialog('/showBookings', [

            function (session) {
                console.log('email', email);
                client.query(`SELECT * FROM booking_transactions where email='${email}'`, (err, res) => {
                    if (err) throw err;
                    console.log('response', res);

                    const cardData = res.rows.map(data => {
                        var sd = JSON.stringify(data.start_date).split('T')[0];
                        var ed = JSON.stringify(data.end_date).split('T')[0]
                        console.log('res', data);
                        return (
                            new builder.HeroCard(session)
                                .title("Booking Id: " + JSON.stringify(data.booking_id))
                                .subtitle("Room_id: " + JSON.stringify(data.room_id))
                                .text("startDate: " + moment(sd).format('MMM Do YYYY') + "<br/>" +
                                    "End Date: " + moment(ed).format('MMM Do YYYY') + "<br/>" +
                                    "start Time: " + JSON.stringify(data.start_time) + "<br/>" +
                                    "End Time: " + JSON.stringify(data.end_time)
                                )
                        )
                    })
                    const msg = new builder.Message(session)
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(cardData)
                        .text(`There are ${res.rows.length} bookings with your email`)

                    builder.Prompts.text(session, msg);

                });
                session.endDialog();
            },]).reloadAction('startOver', 'Ok, starting over.', {
                matches: /^start over$|^start again$/i
            });

        //1st condition
        this.universalBot.dialog('/askFromstarting', [

            function (session) {
                if (building_choice == "") {
                    session.beginDialog('askforbuildingname');
                    return;
                }
                else {
                    session.beginDialog('askfordatetime');
                    return;
                }

            },
            function (session, results) {

                if (random == "one") {
                    session.dialogData.room_id = results.response;
                    room_id = session.dialogData.room_id;
                }

                session.beginDialog('showBookingDialog');

            },
            function (session, results) {

                client.query(`insert into booking_transactions(room_id,start_time,end_time,start_date,end_date,email,floor_number,building_name)
     values('${room_id}','${start_time + ":00"}','${end_time + ":00"}','${start_date}','${end_date}','${email}','${floor_choice}','${building_choice}')`, (err, res) => {
                        if (err) {
                            session.send("error" + err)
                        }
                        else {
                            session.send(`<b style="color:green">Your booking is confirmed<b> `);
                        }

                    });
                start_date = "";
                end_date = "";
                start_time = "";
                end_time = "";
                building_name = "";
                room_Type_choice = "";
                building_choice = "";
                email = "";
                room_id = "";
                session.endDialog();
            }
        ]).endConversationAction(
            "endBooking", "Ok. Goodbye.",
            {
                matches: /^cancel$|^goodbye$/i,
                confirmPrompt: "This will cancel your booking. Are you sure?"
                // onSelectAction: function (session, args,next) { 

                //     start_date = "";
                //     end_date = "";
                //     start_time = "";
                //     end_time = "";
                //     building_name = "";
                //         room_Type_choice="";
                //         building_choice="";
                //     email="";
                //      room_id = "";
                //  }                
            }
        ).reloadAction('startOver', 'Ok, starting over.', {
            matches: /^start over$|^start again$/i
        });


        this.universalBot.dialog('/welcome_user', [
            function (session) {
                var welcome_msg = require('./json/welcome.msg.json');
                session.send(welcome_msg);
                // session.endDialog();
            }]);
        var building_name = "";

        // Dialog to ask for a date and time
        this.universalBot.dialog('showBookingDialog', [
            function (session) {

                client.query(`select r.room_id,r.room_number,f.floor_number from rooms as r
        Inner join floor as f 
        ON r.floor_id=f.floor_id 
        where room_id='${room_id}'`, (err, res) => {
                        if (err) {
                            throw err;
                        }
                        res.rows.map(data => {
                            return (
                                welcome_msg.attachments[0].content.body[1].facts[2].value = data.floor_number,
                                welcome_msg.attachments[0].content.body[1].facts[3].value = data.room_number
                            )
                        })

                    });

                var welcome_msg = require('./json/booking.details.json');
                var maildata = require('./json/mail.boyd.json');
                welcome_msg.attachments[0].content.body[1].facts[1].value = building_choice;
                welcome_msg.attachments[0].content.body[1].facts[4].value = room_Type_choice;
                welcome_msg.attachments[0].content.body[1].facts[5].value = moment(start_date).format('MMM Do YYYY');
                welcome_msg.attachments[0].content.body[1].facts[6].value = moment(end_date).format('MMM Do YYYY');
                welcome_msg.attachments[0].content.body[1].facts[7].value = start_time;
                welcome_msg.attachments[0].content.body[1].facts[8].value = end_time;
                if (session.message && session.message.value) {

                    ///send mail to that user
                    var jsondata = {
                        "message": {
                            "subject": "Room Booking Details",
                            "body": {
                                "contentType": "Text",
                                "content": "The new cafeteria is open."
                            },
                            "toRecipients": [
                                {
                                    "emailAddress": {
                                        "address": session.message.value.email
                                    }
                                }
                            ]
                        }
                    };

                    auth.getAccessToken().then(function (token) {
                        TokenVar = token;
                    }, function (error) {
                        console.error('>>> Error getting access token: ' + error);
                    });

                    request({
                        url: "https://graph.microsoft.com/v1.0/me/sendMail",
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${TokenVar}`
                        },
                        json: true,   // <--Very important!!!
                        body: jsondata
                    }, function (error, response, body) {
                        if (error) {
                            console.log('------errror---', error);
                        }
                        else {
                            console.log('sent');
                            session.send('Your booking details have been sent to your email ' + session.message.value.email)

                        }
                    });

                    email = session.message.value.email;

                    welcome_msg.attachments[0].content.body[1].facts[0].value = email;
                    session.endDialogWithResult();
                    return;
                }
                else {
                    session.send(welcome_msg);
                    return;
                }

            },
            function (session, results) {
                session.endDialogWithResult(results);
            }
        ]);


        this.universalBot.dialog('askfordatetime', [
            function (session) {
                var msg = require('./json/datetime.json');

                if (room_Type_choice !== "") {
                    console.log('room_choices', room_Type_choice);
                    msg.attachments[0].content.body[6].value = room_Type_choice;

                }
                if (start_date !== "") {
                    console.log('start', start_date);
                    if (start_time !== "") {
                        console.log('time', start_time);
                        msg.attachments[0].content.body[2].value = start_time;
                    }
                    msg.attachments[0].content.body[1].value = start_date;
                }
                if (end_date !== "") {
                    console.log('start', end_date);
                    if (end_time !== "") {
                        console.log('time', end_time);
                        msg.attachments[0].content.body[4].value = end_time;
                    }
                    msg.attachments[0].content.body[3].value = end_date;
                }
                if (session.message && session.message.value) {

                    start_date = session.message.value.startDate;
                    end_date = session.message.value.endDate;
                    start_time = session.message.value.startTime;
                    end_time = session.message.value.endTime;
                    room_Type_choice = session.message.value.room_type;

                    if (start_date && end_date && start_time && end_time) {
                        if (moment(start_date).isBefore(moment().format("YYYY-MM-DD")) || moment(end_date).isBefore(moment().format("YYYY-MM-DD"))) {
                            if (moment(start_date).isBefore(moment().format("YYYY-MM-DD"))) {
                                session.send(`<b style="color:red">Please select start date from today onwards</b>`);
                                msg.attachments[0].content.body[1].value = "";
                                msg.attachments[0].content.body[3].value = end_date;

                            }
                            else if (moment(start_date).isBefore(moment().format("YYYY-MM-DD")) && moment(end_date).isBefore(moment().format("YYYY-MM-DD"))) {
                                session.send(`<b style="color:red">Please select start date and end date from today onwards</b>`);
                                msg.attachments[0].content.body[1].value = "";
                                msg.attachments[0].content.body[3].value = "";
                            }
                            else {
                                session.send(`<b style="color:red">Please select end date from today onwards</b>`);
                                msg.attachments[0].content.body[1].value = start_date;
                                msg.attachments[0].content.body[3].value = "";

                            }
                            msg.attachments[0].content.body[2].value = start_time;
                            msg.attachments[0].content.body[4].value = end_time;
                            session.send(msg);
                            return;
                        }
                        else {
                            // if (moment(start_date).isSame(end_date)) {
                            var startTime = moment(start_time, "HH:mm:ss a");
                            var endTime = moment(end_time, "HH:mm:ss a");
                            var duration = moment.duration(endTime.diff(startTime));
                            var hours = parseInt(duration.asHours());
                            var minutes = parseInt(duration.asMinutes()) % 60;
                            duration = hours + ' hour and ' + minutes + ' minutes.';

                            client.query(`select distinct room_id from booking_transactions where
((start_time BETWEEN '${start_time}' and '${end_time}') or (end_time BETWEEN '${start_time}' and '${end_time}'))
and((start_date BETWEEN '${start_date}' and '${end_date}')or(end_date BETWEEN '${start_date}' and '${end_date}'))
order by room_id`, (err, res) => {
                                    if (err) throw err;

                                    var roomsBooked = res.rows.filter(data => {
                                        return data.room_id
                                    })

                                    client.query(`select r.room_id,r.capacity,r.room_number,f.floor_number,rt.roomtype_id,b.building_id from rooms as r
                                Inner join floor as f 
                                ON r.floor_id=f.floor_id 
                                Inner join room_Type as rt
                                on r.roomtype_id=rt.roomtype_id
                                Inner join building as b
                                on r.building_id=b.building_id
                                where room_type='${room_Type_choice}' AND building_name='${building_choice}'`, (err, res1) => {
                                            if (err) throw err;

                                            var RoomsAvailable = res1.rows.filter((row) => {
                                                for (let room in roomsBooked) {
                                                    if (row.room_id == roomsBooked[room].room_id) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            })

                                            const cardData = RoomsAvailable.map(data => {
                                                return (
                                                    new builder.HeroCard(session)
                                                        .title("Room Id: " + JSON.stringify(data.room_id))
                                                        .subtitle("Capacity: " + JSON.stringify(data.capacity) + "     Room Type:" + room_Type_choice)
                                                        .text(`<b>Room Number: ${JSON.stringify(data.room_number)}    Floor Number: ${data.floor_number}</b>`)
                                                        .images([builder.CardImage.create(session, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQe-kfvktz-yGOOtUgVKT41-cohHBf6bVyINEKXF54S5paPJh9S')])
                                                        .buttons([
                                                            builder.CardAction.imBack(session, JSON.stringify(data.room_id), "Book")
                                                        ])
                                                )
                                            })
                                            const msg = new builder.Message(session)
                                                .attachmentLayout(builder.AttachmentLayout.carousel)
                                                .attachments(cardData)
                                                .text(`<b>There are ${RoomsAvailable.length} rooms available as per your requirement.</b>`)

                                            builder.Prompts.text(session, msg);

                                        })
                                })
                        }

                    }

                    else {
                        session.send(`<b style="color:red">All the fields are required, please select respective start and end time</b>`);
                        session.send(msg);
                        return;
                    }
                }
                else {
                    random = "one";
                    // msg.attachments[0].content.body[1].value = "";
                    // msg.attachments[0].content.body[2].value = "";
                    // msg.attachments[0].content.body[3].value = "";
                    // msg.attachments[0].content.body[4].value = "";
                    session.send(msg);
                }

            },
            function (session, results) {
                session.endDialogWithResult(results);
            }
        ]);

        this.universalBot.dialog('askforbuildingname', [
            function (session) {

                var building_name = "";
                client.query('SELECT * from building', (err, res) => {
                    if (err) throw err;
                    for (let row of res.rows) {
                        building_name += JSON.stringify(row.building_name).replace(/\"/g, "") + ":"

                    }
                    builder.Prompts.choice(session, "Please tell in which building you want to book a room, ", building_name.split(':'));
                });

            },
            function (session, results) {
                building_choice = results.response.entity;
                session.endDialogWithResult();
            }
        ]);

        this.universalBot.dialog('confirmDialog', [
            function (session) {

                builder.Prompts.text(session, "Please Enter your email to  confirm your booking");
            },
            function (session, results) {
                session.endDialogWithResult(results);
            }
        ]);
        // Control messages
        this.universalBot.on('conversationUpdate', this.convUpdateHandler);
        this.Connector.onQuery('message',
            (event: builder.IEvent, query: teamBuilder.ComposeExtensionQuery, callback: (err: Error, result: teamBuilder.IComposeExtensionResponse, statusCode: number) => void) => {
                if (query.parameters && query.parameters[0] && query.parameters[0].name === 'initialRun') {
                    // implement an MRU, kind of thing
                    let firstResponse = teamBuilder.ComposeExtensionResponse.result('list').attachments([
                        new builder.ThumbnailCard()
                            .title('Test')
                            .text('Test')
                            .images([new builder.CardImage().url('https://roombookingdemo.herokuapp.com/assets/icon.png')])
                            .toAttachment()
                    ]).toResponse();
                    callback(<any>null, firstResponse, 200);
                }
                else {
                    // Return result response

                    let response = teamBuilder.ComposeExtensionResponse.result('list').attachments([
                        new builder.ThumbnailCard()
                            .title(`Test`)
                            .text('test')
                            .images([new builder.CardImage().url('https://roombookingdemo.herokuapp.com/assets/icon.png')])
                            .toAttachment()
                    ]).toResponse();
                    callback(<any>null, response, 200);
                }
            });
        // this is used when canUpdateConfiguration is set to true 
        this.Connector.onQuerySettingsUrl(
            (event: builder.IEvent, query: teamBuilder.ComposeExtensionQuery, callback: (err: Error, result: teamBuilder.IComposeExtensionResponse, statusCode: number) => void) => {
                callback(<any>null, {
                    composeExtension: {
                        type: "config",
                        suggestedActions: {
                            actions: [
                                {
                                    type: "openApp",
                                    title: "message Configuration",
                                    value: 'https://roombookingdemo.herokuapp.com/messageConfig.html'
                                }
                            ]
                        }
                    }
                }, 200);
            }
        )
        this.Connector.onSettingsUpdate(
            (event: builder.IEvent, query: teamBuilder.ComposeExtensionQuery, callback: (err: Error, result: teamBuilder.IComposeExtensionResponse, statusCode: number) => void) => {
                // take care of the setting returned from the dialog, with the value stored in state
                const setting = query.state;
                callback(<any>null, <any>null, 200);
            }
        )

    }

    private defaultDialog(session: builder.Session) {
        const text = roombookingBot.extractTextFromMessage(session.message).toLowerCase();
        // const context = new AuthenticationContext(authorityUrl);

        return wit.message(text).then(({ entities }) => {
            if (entities.document) {
                console.log(' coming first');
                console.log("okkkkkkk");
                auth.getAccessToken().then(function (token) {
                    // console.log('first'+token);
                    // Get all of the users in the tenant.
                    TokenVar=token;
                    console.log('2nd'+TokenVar);

                console.log('sp');
                var local_char = JSON.stringify(entities.document[0].value).replace(/\"/g, "");

                if (local_char == "all" || local_char == "my") {
                    url = "https://graph.microsoft.com/v1.0/me/drive/root/children??select=name,id,webURL&&top=10";
                }
                else {
                    url = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${local_char}')?select=name,id,webURL`;
                }
                axios.get(url,
                    { headers: { Authorization: `Bearer ${TokenVar}` } })
                    .then(function (response) {

                        var ct = "";
                        var icon = "";

                        const cardData = response.data.value.map(data => {
                            var file_extension = data.name;
                            var afterDot = file_extension.substr(file_extension.indexOf('.'));

                            switch (afterDot) {
                                case ".docx":
                                    ct = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                                    icon = "https://cdn2.iconfinder.com/data/icons/metro-ui-icon-set/128/Word_15.png";
                                    break;
                                case ".xlsx":
                                    ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                                    icon = "https://cdn2.iconfinder.com/data/icons/metro-ui-icon-set/128/Excel_15.png";
                                    break;
                                case ".pptx":
                                    console.log('pptcoming');
                                    ct = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                                    icon = "https://cdn2.iconfinder.com/data/icons/metro-ui-icon-set/128/PowerPoint_15.png";
                                    break;
                                case ".pdf":
                                    ct = "application/pdf";
                                    icon = "https://cdn4.iconfinder.com/data/icons/CS5/256/ACP_PDF%202_file_document.png";
                                    break;

                            }
                            return (
                                new builder.HeroCard(session)
                                    .title("Name: " + JSON.stringify(data.name))
                                    .subtitle("Web URL: " + JSON.stringify(data.webUrl))
                                    .images([builder.CardImage.create(session, icon)])
                                    .buttons([
                                        builder.CardAction.openUrl(session, data.webUrl, "open")
                                    ])
                                    .text('')
                            )
                        })
                        const msg = new builder.Message(session)
                            .attachmentLayout(builder.AttachmentLayout.carousel)
                            .attachments(cardData)
                            .text(`There are ${response.data.value.length} documents exist with your requirement`)

                        builder.Prompts.text(session, msg);
                        session.endDialog();
                    }).catch(function (error) {
                        console.log(error);
                    });
                  }, function (error) {
                    console.error('>>> Error getting access token: ' + error);
                  });

            }
            else if (entities.room_booking && entities.room_type && entities.building_name && entities.startenddatetime) {
                console.log('endstart');
                start_date = JSON.stringify(entities.startenddatetime[0].values[0].from.value).replace(/\"/g, "").split('T')[0];

                start_time = moment(JSON.stringify(entities.startenddatetime[0].values[0].from.value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A');

                end_date = JSON.stringify(entities.startenddatetime[0].values[0].to.value).replace(/\"/g, "").split('T')[0];

                end_time = moment(JSON.stringify(entities.startenddatetime[0].values[0].to.value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A');
                room_Type_choice = JSON.stringify(entities.room_type[0].value).replace(/\"/g, "");
                building_choice = JSON.stringify(entities.building_name[0].value).replace(/\"/g, "");


                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.room_type && entities.building_name && entities.startdatetime) {
                console.log('eyssafdsaf');
                start_date = JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[0];
                room_Type_choice = JSON.stringify(entities.room_type[0].value).replace(/\"/g, "");
                building_choice = JSON.stringify(entities.building_name[0].value).replace(/\"/g, "");
                start_time = moment(JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A')

                session.beginDialog('/askFromstarting');
                return;
            }

            else if (entities.room_booking && entities.room_type && entities.startenddatetime) {
                console.log('endstart1');
                start_date = JSON.stringify(entities.startenddatetime[0].values[0].from.value).replace(/\"/g, "").split('T')[0];

                start_time = moment(JSON.stringify(entities.startenddatetime[0].values[0].from.value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A');

                end_date = JSON.stringify(entities.startenddatetime[0].values[0].to.value).replace(/\"/g, "").split('T')[0];

                end_time = moment(JSON.stringify(entities.startenddatetime[0].values[0].to.value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A');
                room_Type_choice = JSON.stringify(entities.room_type[0].value).replace(/\"/g, "");
                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.room_type && entities.startdatetime) {
                console.log('hey');
                start_date = JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[0];
                room_Type_choice = JSON.stringify(entities.room_type[0].value).replace(/\"/g, "");

                start_time = moment(JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A')

                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.building_name && entities.startdatetime) {
                console.log('hii');
                building_choice = JSON.stringify(entities.building_name[0].value).replace(/\"/g, "");
                start_date = JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[0];


                start_time = moment(JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A')

                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.room_type && entities.building_name) {
                console.log('helo');
                room_Type_choice = JSON.stringify(entities.room_type[0].value).replace(/\"/g, "");
                building_choice = JSON.stringify(entities.building_name[0].value).replace(/\"/g, "");

                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.startdatetime) {
                console.log('hru');
                start_date = JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[0];
                start_time = moment(JSON.stringify(entities.startdatetime[0].values[0].value).replace(/\"/g, "").split('T')[1], ' hh:mm A').format('HH:mm A')
                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.room_type) {
                console.log('say');
                room_Type_choice = JSON.stringify(entities.room_type[0].value).replace(/\"/g, "");
                console.log('coming1', start_date);
                session.beginDialog('/askFromstarting');
                return;
            }
            else if (entities.room_booking && entities.building_name) {
                console.log('hmmmm');
                building_choice = JSON.stringify(entities.building_name[0].value).replace(/\"/g, "");
                client.query(`SELECT * FROM building where building_name LIKE '%${building_choice}%'`, (err, res) => {

                    if (res.rows.length == 0) {
                        session.send('Sorry,there no building found with name ' + building_choice);
                        return;
                    }
                    else {

                        session.beginDialog('/askFromstarting');
                        return;
                    }

                });
            }
            else if (entities.show_bookings && entities.email) {
                console.log('hunnnn');
                email = JSON.stringify(entities.email[0].value).replace(/\"/g, "");
                session.beginDialog('/showBookings');
                return;
            } else if (entities.room_booking) {

                session.beginDialog('/askFromstarting');
                return;
            }
            else {
                session.beginDialog('/welcome_user');
                session.endDialog();
            }
        });

    }
    /**
    * This is the help dialog of the bot
    * @param session 
    */
    private helpDialog(session: builder.Session) {
        session.send('I\'m just a friendly but rather stupid bot, and right now I don\'t have any valuable help for you!');
        session.endDialog();
    }

    /**
    * This is an example of a conversationUpdate event handler
    * @param activity 
    */
    private convUpdateHandler(activity: any) {
        log("Conversation update")
    }

    /**
    * Extracts text only from messages, removing all entity references
    * @param message builder.IMessage
    */
    private static extractTextFromMessage(message: builder.IMessage): string {
        var s = (message.text) ? message.text : '';
        if (message.entities) {
            message.entities.forEach((ent: any) => {
                s = s.replace(ent.text, '');
            })
        }
        return s.trim();
    }
}
