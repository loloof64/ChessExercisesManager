<template>
    <Page class="page" ref="page">
        <ActionBar class="action-bar action-bar-bg">
            <Label class="action-bar-title" :text="'one_drive_title' | L"></Label>
        </ActionBar>

        <StackLayout>
            <ScrollView :width="explorerPathWidth" height="30" orientation="horizontal">
                <Label :text="_explorerPath" class="explorerPath" textWrap="true" />
            </ScrollView>
            <GridLayout>
                <ScrollView :height="itemsViewHeight" orientation="vertical">
                    <ListView for="item in explorerItems" @itemTap="_reactToItemTap">
                        <v-template>
                            <StackLayout orientation="horizontal">
                                <Image v-if="_isFolder(item)" src="res://folder" class="type_thumbnail" />
                                <Image v-else src="res://file" class="type_thumbnail" />
                                <Label :text="item.name" class="item_label" textWrap="true" />
                            </StackLayout>
                        </v-template>
                    </ListView>
                </ScrollView>
                <fab
                    class="fab-button hl vb"
                    backgroundColor="yellow"
                    icon="res://gobackarrow"
                    @tap="_goBackFolder()"
                    :visibility="_goBackFolderVisibility"
                />

                <fab
                    class="fab-button hc vb"
                    :backgroundColor="mainActionModeColor"
                    :icon="mainActionModeIcon"
                    @tap="_changeMainActionMode()"
                />

                <fab
                    class="fab-button hr vb"
                    backgroundColor="lightblue"
                    icon="res://refreshbutton"
                    @tap="_refreshFolder()"
                />
                <ActivityIndicator :busy="busy" />
            </GridLayout>
        </StackLayout>

    </Page>
</template>

<script>
import { localize } from "nativescript-localize";
import Vue from "nativescript-vue";
import OneDriveProvider from '../logic/OneDriveProvider';
import * as application from "tns-core-modules/application";
import { Screen } from "@nativescript/core";
const fileSystemModule = require("tns-core-modules/file-system");

Vue.filter("L", localize);

const EXPLORE_MODE = 'explore';
const DOWNLOAD_MODE = 'donwload';
const CREDENTIALS_EXPIRED = 'Credentials expired';

export default {
    props: {
        currentAppFolderPath : {
            type: String,
            default: '',
        },
    },
    data() {
        return {
            busy: false,
            explorerItems: [],
            parentFoldersIds: [],
            parentFoldersNames: [],
            itemsViewHeight: undefined,
            explorerPathWidth: undefined,
            oneDriveProvider: new OneDriveProvider(),
            mainActionMode: EXPLORE_MODE,
        }
    },
    async mounted() {
        this.itemsViewHeight = Screen.mainScreen.heightDIPs - 200;
        this.explorerPathWidth = Screen.mainScreen.widthDIPs;
        try {
            this.$refs['page'].nativeView.addEventListener(application.AndroidApplication.activityBackPressedEvent, this.askForExitConfirmationNormal);
            await this.oneDriveProvider.loginOneDriveIfNeeded();
            const data = await this.oneDriveProvider.getOneDriveRootFiles();

            this.explorerItems = data;
        }
        catch (e) {
            console.error(e);
            if (e === CREDENTIALS_EXPIRED) {
                alert({
                    title: localize('one_drive_credentials_expired_title'),
                    message: localize('one_drive_credentials_expired_message'),
                    okButtonText: localize('ok_button')
                }).then(() => {});
            }
        }
    },
    methods: {
        _isFolder(item) {
            return item.mimeType === 'application/vnd.one-apps.folder';
        },  
        async _reactToItemTap(event) {
            const item = event.item;
            const isAFolder = item.mimeType === 'application/vnd.one-apps.folder';

            if (this.mainActionMode === EXPLORE_MODE) {
                if (isAFolder) {
                    const data = await this.oneDriveProvider.getOneDriveInnerFolderFiles(item.id);
                    this.explorerItems = data;
                    this.parentFoldersIds.push(item.id);
                    this.parentFoldersNames.push(item.name);
                }
            }
            else { /* this.mainActionMode === DOWNLOAD_MODE */
                this.activateDownloadBusyMode();
                try {
                    if (isAFolder) {
                        await this.oneDriveProvider.downloadOneDriveFolderIntoPath({folderId: item.id, destinationPath: this.currentAppFolderPath, mustNotifyUser: true});
                    }
                    else {
                        await this.oneDriveProvider.downloadOneDriveFileIntoPath({fileId: item.id, destinationPath: this.currentAppFolderPath, mustNotifyUser: true});
                    }
                }
                catch (e) {
                    console.error(e);
                    if (e === CREDENTIALS_EXPIRED) {
                        alert({
                            title: localize('one_drive_credentials_expired_title'),
                            message: localize('one_drive_credentials_expired_message'),
                            okButtonText: localize('ok_button')
                        }).then(() => {});
                    }
                }
                this.cancelDownloadBusyMode();
            }
        },
        activateDownloadBusyMode() {
            this.$refs['page'].nativeView.removeEventListener(application.AndroidApplication.activityBackPressedEvent, this.askForExitConfirmationNormal);
            this.$refs['page'].nativeView.addEventListener(application.AndroidApplication.activityBackPressedEvent, this.askForExitConfirmationDuringDownload);
            this.busy = true;
        },
        cancelDownloadBusyMode() {
            this.$refs['page'].nativeView.removeEventListener(application.AndroidApplication.activityBackPressedEvent, this.askForExitConfirmationDuringDownload);
            this.$refs['page'].nativeView.addEventListener(application.AndroidApplication.activityBackPressedEvent, this.askForExitConfirmationNormal);
            this.busy = false;
        },
        askForExitConfirmationDuringDownload() {
            confirm({
                title: localize('exit_confirmation_title'),
                message: localize('one_drive_exit_confirmation_message_download'),
                okButtonText: localize('ok_button'),
                cancelButtonText: localize('cancel_button')
            }).then(result => {
                if (result) {
                    this.$navigator.navigate('/home', {
                        transition: {
                            name:'slide',
                            duration: 200
                        },
                        clearHistory: true,
                    });
                }
            });
        },
        askForExitConfirmationNormal() {
            confirm({
                title: localize('exit_confirmation_title'),
                message: localize('one_drive_exit_confirmation_message_normal'),
                okButtonText: localize('ok_button'),
                cancelButtonText: localize('cancel_button')
            }).then(result => {
                if (result) {
                    this.$navigator.navigate('/home', {
                        transition: {
                            name:'slide',
                            duration: 200
                        },
                        clearHistory: true,
                    });
                }
            });
        },
        async _goBackFolder() {
            try  {
                this.parentFoldersIds.pop();
                this.parentFoldersNames.pop();

                let data;
                
                if (this.parentFoldersIds.length > 0) {
                    const parentItemId = this.parentFoldersIds[this.parentFoldersIds.length - 1];
                    data = await this.oneDriveProvider.getOneDriveInnerFolderFiles(parentItemId);
                }
                else {
                    data = await this.oneDriveProvider.getOneDriveRootFiles();
                }
                this.explorerItems = data;
            }
            catch (e) {
                console.error(e);
                if (e === CREDENTIALS_EXPIRED) {
                    alert({
                        title: localize('one_drive_credentials_expired_title'),
                        message: localize('one_drive_credentials_expired_message'),
                        okButtonText: localize('ok_button')
                    }).then(() => {});
                }
            }
        },
        async _refreshFolder() {
            try {
                let data;
                if (this.parentFoldersIds.length === 0) {
                    data = await this.oneDriveProvider.getOneDriveRootFiles();
                }
                else {
                    const currentFolderId = this.parentFoldersIds[this.parentFoldersIds.length - 1];
                    data = await this.oneDriveProvider.getOneDriveInnerFolderFiles(currentFolderId);
                }
                this.explorerItems = data;
            }
            catch (e) {
                console.error(e);
                if (e === CREDENTIALS_EXPIRED) {
                    alert({
                        title: localize('one_drive_credentials_expired_title'),
                        message: localize('one_drive_credentials_expired_message'),
                        okButtonText: localize('ok_button')
                    }).then(() => {});
                }
            }
        },
        _changeMainActionMode() {
            switch(this.mainActionMode) {
                case EXPLORE_MODE: this.mainActionMode = DOWNLOAD_MODE; break;
                case DOWNLOAD_MODE: this.mainActionMode = EXPLORE_MODE; break;
                default: this.mainActionMode = EXPLORE_MODE;
            }
        },
    },
    computed: {
        mainActionModeColor() {
            switch (this.mainActionMode) {
                case EXPLORE_MODE: return 'green';
                case DOWNLOAD_MODE: return 'orange';
                default: return 'green';
            }
        },

        mainActionModeIcon() {
            switch (this.mainActionMode) {
                case EXPLORE_MODE: return 'res://eye';
                case DOWNLOAD_MODE: return 'res://download';
                default: return 'res://eye';
            }
        },

        _goBackFolderVisibility() {
            return this.parentFoldersIds.length > 0 ? 'visible' : 'collapse';
        },

        _explorerPath() {
            return '/' + this.parentFoldersNames.join('/');
        },
    },
}
</script>

<style lang="scss" scoped>
.action-bar-bg {
    background-color: orangered;
}

.explorerPath {
    font-size: 18;
    background-color: aquamarine;
    padding: 2 8;
}

.download_thumnail {
    width: 30;
    height: 30;
    margin: 6 8;
}

.type_thumbnail {
    width: 30;
    height: 30;
    margin: 6 8;
}

.item_label {
    width: 100%;
    height: 100%;
    font-size: 22;
    vertical-align: middle;
}

.fab-button {
    width: 65;
    height: 65;
    opacity: 0.3;
}

.hl {
    horizontal-align: left;
}

.hc {
    horizontal-align: center;
}

.hr {
    horizontal-align: right;
}

.vb {
    vertical-align: bottom;
}
</style>