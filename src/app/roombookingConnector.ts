import * as request from 'request';
import * as teamBuilder from 'botbuilder-teams';
import { Request } from "express";
import { ConnectorDeclaration, IConnector } from 'express-msteams-host';
const JsonDB = require('node-json-db');

/**
 * The connector data interface
 */
interface IroombookingConnectorData {
    webhookUrl: string;
    user: string;
    appType: string;
    groupName: string;
    color: string;
    existing: boolean;
}

/**
 * Implementation of the "roombookingConnectorConnector" Office 365 Connector
 */
@ConnectorDeclaration(
    '/api/connector/connect',
    '/api/connector/ping',
    'web/roombookingConnectorConnect.ejs',
    '/roombookingConnectorConnected.html'
)
export class roombookingConnector implements IConnector {
    private connectors: any;

    public constructor() {
        // Instantiate the node-json-db database (connectors.json)
        this.connectors = new JsonDB('connectors', true, false);
    }

    public Connect(req: Request) {
        if (req.body.state === 'myAppsState') {
            this.connectors.push('/connectors[]', {
                webhookUrl: req.body.webhookUrl,
                user: req.body.user,
                appType: req.body.appType,
                groupName: req.body.groupName,
                existing: true,
                color: req.body.color
            });
        }
    }

    public Ping(req: Request): Array<Promise <void>> {
        // clean up connectors marked to be deleted
        try {
            this.connectors.push('/connectors',
                (<IroombookingConnectorData[]>this.connectors.getData('/connectors')).filter((c => {
                    return c.existing;
                })));
        } catch (error) {
            if (error.name && error.name == 'DataError') {
                // there's no registered connectors
                return [];
            }
            throw error;
        }

        // send pings to all subscribers
        return (<IroombookingConnectorData[]>this.connectors.getData('/connectors')).map((connector, index) => {
            return new Promise<void>((resolve, reject) => {
                const card = new teamBuilder.O365ConnectorCard();
                card.title('Sample connector');
                card.text(`This is a sample Office 365 Connector`);

                // set the theme to the user configured theme color
                card.themeColor(connector.color); 

                const section = new teamBuilder.O365ConnectorCardSection();
                section.activityTitle('Ping');
                section.activityText(`This is just a sample ping`);

                const fact = new teamBuilder.O365ConnectorCardFact();
                fact.name('Created by');
                fact.value(connector.user);
                section.facts([fact]);
                card.sections([section]);

                const action = new teamBuilder.O365ConnectorCardViewAction();
                action.name('Yo Teams');
                action.target('http://aka.ms/yoteams');
                card.potentialAction([action]);

                request({
                    method: 'POST',
                    uri: decodeURI(connector.webhookUrl),
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify(card.toAttachment().content)
                }, (error: any, response: any, body: any) => {
                    if (error) {
                        reject(error)
                    } else {
                        // 410 - the user has removed the connector
                        if (response.statusCode === 410) {
                            this.connectors.push(`/connectors[${index}]/existing`, false);
                        }
                        resolve();
                    }
                })
            });
        });
    }
}
