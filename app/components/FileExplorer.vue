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
                            <Label :text="item.name" class="item_label" textWrap="true" />
                        </StackLayout>
                    </v-template>
                </ListView>
            </ScrollView>
            <Fab
                class="fab-button hl vt"
                backgroundColor="yellow"
                icon="res://gobackarrow"
                @tap="_goBackFolder()"
                :visibility="_goBackFolderVisibility"
            />
            <Fab
                class="fab-button hr vb"
                backgroundColor="blue"
                icon="res://folder"
                @tap="_createNewFolder()"
            />
            <Fab
                class="fab-button hc vb"
                :backgroundColor="mainActionModeColor"
                :icon="mainActionModeIcon"
                @tap="_changeMainActionMode()"
            />
            <ActivityIndicator :busy="generatingPosition" row="0" col="0" />
        </GridLayout>
    </StackLayout>
</template>

<script>
    import { localize } from "nativescript-localize";
    import Vue from "nativescript-vue";
    const platformModule = require("tns-core-modules/platform");
    const fileSystemModule = require("tns-core-modules/file-system");

    import OneDriveProvider from '../logic/OneDriveProvider';
    import ExerciceLoader from '../logic/ExerciceLoader';

    Vue.filter("L", localize);

    const EXPLORE_MODE = 'explore';
    const RENAME_MODE = 'rename';
    const DELETE_MODE = 'delete';

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
                oneDriveProvider: new OneDriveProvider(),
                isLoggedInOneDrive: false,
                mainActionMode: EXPLORE_MODE,
            }
        },
        mounted() {
            const currentAppFolder = fileSystemModule.knownFolders.currentApp();
            const rootFolder = currentAppFolder.getFolder('personnal_exercises');
            this.exercisesRootFolder = rootFolder;
            this.currentFolder = rootFolder;
            this.updateItems();
            this.isLoggedInOneDrive = this.oneDriveProvider.isLoggedInOneDrive();
        },
        methods: {
            _onExplorerTap(explorerItem) {
                if (this.mainActionMode === EXPLORE_MODE) {
                    if (explorerItem.folder) {
                        this._navigateToFolder(explorerItem.path);
                    }
                    else {
                        this._playGame(explorerItem.path);
                    }
                }
                else if (this.mainActionMode === RENAME_MODE) {
                    prompt({
                        title: localize(explorerItem.folder ? 'rename_folder_title' : 'rename_file_title'),
                        okButtonText: localize('ok_button'),
                        cancelButtonText: localize('cancel_button'),
                        defaultText: explorerItem.name,
                    }).then(result => {
                        if (result.result) {
                            const newName = result.text;

                            if (explorerItem.folder) {
                                const oldFolder = this.currentFolder.getFolder(explorerItem.name);

                                oldFolder.rename(newName).then((res) => {
                                    this.updateItems();
                                })
                                .catch((err) => {
                                    console.error(err);
                                    alert({
                                        message: localize('failed_to_rename_folder'),
                                        okButtonText: localize('ok_button')
                                    }).then(() => {});
                                });
                            }
                            else {
                                const oldFile = this.currentFolder.getFile(explorerItem.name);
                                const newFileName = newName.endsWith('.pgn') ? newName : newName+'.pgn';
                                oldFile.rename(newName).then((res) => {
                                    this.updateItems();
                                })
                                .catch((err) => {
                                    console.error(err);
                                    alert({
                                        message: localize('failed_to_rename_file'),
                                        okButtonText: localize('ok_button')
                                    }).then(() => {});
                                });
                            }
                        }
                    });
                }
                else if (this.mainActionMode === DELETE_MODE) {
                    const itemName = explorerItem.name;
                    const isFolder = explorerItem.folder;

                    confirm({
                        title: localize(isFolder ? 'delete_folder_title' : 'delete_file_title'),
                        message: localize(isFolder ? 'delete_folder_message' : 'delete_file_message', itemName),
                        okButtonText: localize('ok_button'),
                        cancelButtonText: localize('cancel_button'),
                    }).then(result => {
                        if (result) {
                            const currentPath = fileSystemModule.path.join(this.currentFolder.path, itemName);
                            const item = isFolder ?
                                fileSystemModule.Folder.fromPath(currentPath):
                                fileSystemModule.File.fromPath(currentPath)
                            ;

                            item.remove().then(() => {
                                console.log(`Deleted ${isFolder ? 'folder' : 'file'} ${itemName}`);
                                this.updateItems();
                            })
                            .catch(err => console.error(err));
                        }
                    });
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
                    else if (name.endsWith('.pgn')) {
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

            async updateItems() {
                this.explorerItems = await this._getItems();
                // Also triggers VueJS change detection
                this.explorerItems.splice(this.explorerItems.length);
                this.explorerPath = this._getShortenedPath();
            },

            _isFolder(explorerItem) {
                return explorerItem.folder;
            },

            _navigateToFolder(folderPathString) {
                const targetFolder = fileSystemModule.Folder.fromPath(folderPathString);
                this.currentFolder = targetFolder;
                this.updateItems(); 
            },

            _goBackFolder() {
                if (this.currentFolder !== this.rootFolder) {
                    this.currentFolder = this.currentFolder.parent;
                    this.updateItems();
                }
            },

            async _playGame(gamePath) {
                try {
                    const position = await new ExerciceLoader().loadExerciseFromAbsolutePath(gamePath);
                    const gameGoal = '';

                    this.$navigator.navigate('/game', {
                        transition: {
                            name:'slide',
                            duration: 200
                        },
                        props: {
                            position,
                            gameGoal,
                        }
                    });
                }
                catch (e) {
                    alert({
                        title: localize('exercise_loading_error'),
                        message: e.error || e,
                        okButtonText: localize('ok_button')
                    }).then(() => {
                        console.error(e.error || e);
                    })
                }
            },

            async _accessOneDrive() {
                try {
                    await this.oneDriveProvider.loginOneDriveIfNeeded();
                    this.isLoggedInOneDrive = true;
                    this.$navigator.navigate('/one_drive', {
                        transition: {
                            name:'slide',
                            duration: 200,
                        },
                        props: {
                            currentAppFolderPath: this.currentFolder.path,
                        }
                    });
                }
                catch (e) {
                    console.error(e);
                }
            },

            _logoutOneDrive() {
                confirm({
                    title: localize('logout_account_title'),
                    message: localize('logout_account_message'),
                    okButtonText: localize('ok_button'),
                    cancelButtonText: localize('cancel_button'),
                }).then(async result => {
                    if (result) {
                        try {
                            await this.oneDriveProvider.logoutOneDrive();
                            this.isLoggedInOneDrive = false;
                        }
                        catch (e) {
                            console.error(e);
                        }
                    }
                });
            },

            _changeMainActionMode() {
                switch (this.mainActionMode) {
                    case EXPLORE_MODE: this.mainActionMode = RENAME_MODE; break;
                    case RENAME_MODE: this.mainActionMode = DELETE_MODE; break;
                    case DELETE_MODE: this.mainActionMode = EXPLORE_MODE; break;
                    default: this.mainActionMode = EXPLORE_MODE;
                }
            },

            _createNewFolder() {
                prompt({
                    title: localize('new_folder_title'),
                    message: localize('new_folder_message'),
                    okButtonText: localize('ok_button'),
                    cancelButtonText: localize('cancel_button'),
                    defaultText: "",
                }).then(result => {
                    if (result.result) {
                        const name = result.text;
                        if (name.length > 0) {
                            this.currentFolder.getFolder(name);
                            this.updateItems();
                            console.log('Created folder '+name+' in current folder.');
                        }
                    }
                });
            },

            cloudMenu() {
                action(
                    localize("online_storage"),
                    localize("cancel_button"),
                    [
                        localize("connect_to_one_drive"),
                        localize("disconnect_from_one_drive")
                    ]
                ).then(result => {
                    switch (result) {
                        case localize('connect_to_one_drive'): this._accessOneDrive(); break;
                        case localize('disconnect_from_one_drive'): this._logoutOneDrive(); break;
                        case localize('cancel_button'): return;
                        default: return;
                    }
                });
            }
        },

        computed: {
            mainActionModeColor() {
                switch (this.mainActionMode) {
                    case EXPLORE_MODE: return 'green';
                    case RENAME_MODE: return 'yellow';
                    case DELETE_MODE: return 'red';
                    default: return 'green';
                }
            },

            mainActionModeIcon() {
                switch (this.mainActionMode) {
                    case EXPLORE_MODE: return 'res://eye';
                    case RENAME_MODE: return 'res://edit';
                    case DELETE_MODE: return 'res://delete';
                    default: return 'res://eye';
                }
            },

            _goBackFolderVisibility() {
                const weCanGoUp = this.exercisesRootFolder && (this.currentFolder.path !== this.exercisesRootFolder.path);
                return weCanGoUp ? 'visible' : 'collapse';
            }
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

    .hc {
        horizontal-align: center;
    }

    .hr {
        horizontal-align: right;
    }

    .vt {
        vertical-align: top;
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