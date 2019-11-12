<template>
    <StackLayout>
        <ScrollView :width="explorerPathWidth" height="30" orientation="horizontal">
            <Label :text="explorerPath" class="explorerPath" textWrap="true" />
        </ScrollView>
        <GridLayout>
            <ScrollView :height="exercisesViewHeight" orientation="vertical">
                <ListView for="item in explorerItems" @itemTap="_onExplorerTap($event.item)">
                    <v-template>
                        <StackLayout orientation="horizontal">
                            <Image v-if="_isFolder(item)" src="res://folder" class="type_thumbnail" />
                            <Image v-else src="res://file" class="type_thumbnail" />
                            <Label :text="item.name" class="item_label" />
                        </StackLayout>
                    </v-template>
                </ListView>
            </ScrollView>
            <ActivityIndicator :busy="generatingPosition" row="0" col="0" />
        </GridLayout>
    </StackLayout>
</template>

<script>
    import { localize } from "nativescript-localize";
    import Vue from "nativescript-vue";
    const platformModule = require("tns-core-modules/platform");
    const fileSystemModule = require("tns-core-modules/file-system");

    Vue.filter("L", localize);
    Vue.registerElement(
        'Fab',
        () => require('@nstudio/nativescript-floatingactionbutton').Fab
    );

    export default {
        data() {
            return {
                explorerPath: '',
                explorerItems: [],
                exercisesViewHeight: platformModule.screen.mainScreen.heightDIPs - 260,
                explorerPathWidth: platformModule.screen.mainScreen.widthDIPs,
                currentFolder: undefined,
                exercisesRootFolder: undefined,
                generatingPosition: false,
            }
        },
        async mounted() {
            const currentAppFolder = fileSystemModule.knownFolders.currentApp();
            const rootFolder = currentAppFolder.getFolder('personnal_exercises');
            this.exercisesRootFolder = rootFolder;
            this.currentFolder = rootFolder;
            this._updateItems();
        },
        methods: {
            _onExplorerTap(explorerItem) {
                if (explorerItem.folder) {
                    this._navigateToFolder(explorerItem.path);
                }
                else {
                    this._playGame(explorerItem.path);
                }
            },

            async _getItems() {
                let explorerItems = [];
                const entities = await this.currentFolder.getEntities();
                entities.forEach(entity => {
                    const isAFolder = fileSystemModule.Folder.exists(entity.path);
                    const name = entity.name;
                    const path = entity.path;
                    if (isAFolder) {
                        explorerItems.push({
                            name, path,
                            folder: true,
                        });
                    }
                    else if (name.endsWith('.cst')) {
                        explorerItems.push({
                            name, path,
                            folder: false,
                        })
                    }
                });
                let updatedItems = explorerItems.sort((fst, snd) => {
                    if (fst.folder !== snd.folder) {
                        return fst.folder ? -1 : 1;
                    }
                    return fst.name.localeCompare(snd.name, this._getLocale(), {sentitivity: "base"});
                });

                const weCanGoUp = this.currentFolder.path !== this.exercisesRootFolder.path;
                if (weCanGoUp) {
                    updatedItems.unshift({
                        name: '..',
                        path: '..',
                        folder: true,
                    });
                }

                return updatedItems;
            },

            _addFolder(folderName) {
                this.currentFolder.getFolder(folderName);
            },

            /*
            https://stackoverflow.com/a/48758960/662618
            */
            _getLocale() {
                let lang;  
                if (platformModule.isAndroid) {
                    lang = java.util.Locale.getDefault().getLanguage();
                }
                if (platformModule.isIOS) {
                    lang = NSLocale.preferredLanguages.firstObject;
                } else {
                    platformModule.device.language;
                }

                return lang;
            },

            _getShortenedPath() {
                const path = this.currentFolder.path;
                return path.replace(this.exercisesRootFolder.path, localize('custom_exercises_root'))
            },

            async _updateItems() {
                this.explorerItems = await this._getItems();
                // Also triggers VueJS change detection
                this.explorerItems.splice(this.explorerItems.length);
                this.explorerPath = this._getShortenedPath();
            },

            _isFolder(explorerItem) {
                return explorerItem.folder;
            },

            _navigateToFolder(folderPathString) {
                if (folderPathString === '..') {
                    this.currentFolder = this.currentFolder.parent;
                    this._updateItems();
                }
                else {
                    const targetFolder = fileSystemModule.Folder.fromPath(folderPathString);
                    this.currentFolder = targetFolder;
                    this._updateItems(); 
                }
            },
        }
    }
</script>

<style lang="scss" scoped>
    @import '../app-variables';

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

    .explorerPath {
        font-size: 18;
        background-color: aquamarine;
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
</style>