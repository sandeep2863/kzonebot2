import * as React from 'react';
import {
    PrimaryButton,
    TeamsComponentContext,
    ConnectedComponent,
    Panel,
    PanelBody,
    PanelHeader,
    PanelFooter,
    Surface,
    Checkbox
} from 'msteams-ui-components-react';
import { render } from 'react-dom';
import TeamsBaseComponent, { ITeamsBaseComponentProps, ITeamsBaseComponentState } from 'msteams-react-base-component'
import * as microsoftTeams from '@microsoft/teams-js';

/**
 * State for the messageConfig React component
 */
export interface ImessageConfigState extends ITeamsBaseComponentState {
    onOrOff: boolean;
}

/**
 * Properties for the messageConfig React component
 */
export interface ImessageConfigProps extends ITeamsBaseComponentProps {

}

/**
 * Implementation of the message configuration page
 */
export class messageConfig extends TeamsBaseComponent<ImessageConfigProps, ImessageConfigState> {
 
    public componentWillMount() {
        this.updateTheme(this.getQueryVariable('theme'));
        this.setState({
            fontSize: this.pageFontSize()
        });

        microsoftTeams.initialize();
        microsoftTeams.registerOnThemeChangeHandler(this.updateTheme);
    }

    /** 
     * The render() method to create the UI of the tab
     */
    public render() {
        return (
            <TeamsComponentContext
                fontSize={this.state.fontSize}
                theme={this.state.theme}
            >

                <ConnectedComponent render={(props) => {
                    const { context } = props;
                    const { rem, font } = context;
                    const { sizes, weights } = font;
                    const styles = {
                        header: { ...sizes.title, ...weights.semibold },
                        section: { ...sizes.base, marginTop: rem(1.4), marginBottom: rem(1.4) },
                        footer: { ...sizes.xsmall }
                    }

                    return (
                        <Surface>
                            <Panel>
                                <PanelHeader>
                                    <div style={styles.header}>message configuration</div>
                                </PanelHeader>
                                <PanelBody>
                                    <div style={styles.section}>
                                        <Checkbox
                                            label="On or off?"
                                            checked={this.state.onOrOff}
                                            onChecked={(checked: boolean, value: any) => {
                                                this.setState({
                                                    onOrOff: checked
                                                });
                                            }}>
                                        </Checkbox>
                                    </div>
                                    <div style={styles.section}>
                                        <PrimaryButton onClick={() => {
                                            microsoftTeams.authentication.notifySuccess(JSON.stringify({
                                                setting: this.state.onOrOff
                                            }));
                                        }}>OK</PrimaryButton>
                                    </div>
                                </PanelBody>
                                <PanelFooter>
                                    <div style={styles.footer}>
                                        (C) Copyright Demo
                                    </div>
                                </PanelFooter>
                            </Panel>
                        </Surface>
                    );
                }}>
                </ConnectedComponent>
            </TeamsComponentContext>
        );
    }
}