<template>
    <Page class="page">
        <ActionBar class="action-bar">
            <Label class="action-bar-title" :text="'google_drive_title' | L"></Label>
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
                                <Image src="res://download" class="download_thumnail" />
                                <Image v-if="_isFolder(item)" src="res://folder" class="type_thumbnail" />
                                <Image v-else src="res://file" class="type_thumbnail" />
                                <Label :text="item.name" class="item_label" />
                            </StackLayout>
                        </v-template>
                    </ListView>
                </ScrollView>
                <Fab
                    class="fab-button hl vb"
                    backgroundColor="yellow"
                    icon="res://gobackarrow"
                    @tap="_goBackFolder()"
                    :visibility="_goBackFolderVisibility"
                />

                <Fab
                    class="fab-button hr vb"
                    backgroundColor="lightblue"
                    icon="res://refreshbutton"
                    @tap="_refreshFolder()"
                />
            </GridLayout>
        </StackLayout>

    </Page>
</template>

<script>
import { localize } from "nativescript-localize";
import Vue from "nativescript-vue";
import GoogleDriveProvider from '../logic/GoogleDriveProvider';
const platformModule = require("tns-core-modules/platform");

Vue.filter("L", localize);

export default {
    data() {
        return {
            explorerItems: [],
            parentFoldersIds: [],
            parentFoldersNames: [],
            itemsViewHeight: platformModule.screen.mainScreen.heightDIPs - 200,
            explorerPathWidth: platformModule.screen.mainScreen.widthDIPs,
            googleDriveProvider: new GoogleDriveProvider(),
        }
    },
    async mounted() {
        await this.googleDriveProvider.loginGoogleDriveIfNeeded();
        const data = await this.googleDriveProvider.loadGoogleDriveRootFiles();

        this.explorerItems = data['content'].toJSON()['files'];
    },
    methods: {
        _isFolder(item) {
            return item.mimeType === 'application/vnd.google-apps.folder';
        },  
        async _reactToItemTap(event) {
            const item = event.item;
            const isAFolder = item.mimeType === 'application/vnd.google-apps.folder';

            ////////////////////////////////////////
            console.log(item.id);
            /////////////////////////////////////////

            if (isAFolder) {
                const data = await this.googleDriveProvider.loadGoogleDriveFolderFiles(item.id);
                this.explorerItems = data['content'].toJSON()['files'];
                this.parentFoldersIds.push(item.id);
                this.parentFoldersNames.push(item.name);
            }
        },
        async _goBackFolder() {
            this.parentFoldersIds.pop();
            this.parentFoldersNames.pop();

            let data;
            
            if (this.parentFoldersIds.length > 0) {
                const parentItemId = this.parentFoldersIds[this.parentFoldersIds.length - 1];
                data = await this.googleDriveProvider.loadGoogleDriveFolderFiles(parentItemId);
            }
            else {
                data = await this.googleDriveProvider.loadGoogleDriveRootFiles();
            }
            this.explorerItems = data['content'].toJSON()['files'];
        },
        async _refreshFolder() {
            let data;
            if (this.parentFoldersIds.length === 0) {
                data = await this.googleDriveProvider.loadGoogleDriveRootFiles();
            }
            else {
                const currentFolderId = this.parentFoldersIds[this.parentFoldersIds.length - 1];
                data = await this.googleDriveProvider.loadGoogleDriveFolderFiles(currentFolderId);
            }
            this.explorerItems = data['content'].toJSON()['files'];
        }
    },
    computed: {
        _goBackFolderVisibility() {
            return this.parentFoldersIds.length > 0 ? 'visible' : 'collapse';
        },
        _explorerPath() {
            return '/' + this.parentFoldersNames.join('/');
        }
    },
}
</script>

<style lang="scss" scoped>
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

.hr {
    horizontal-align: right;
}

.vb {
    vertical-align: bottom;
}
</style>