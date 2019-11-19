<template>
    <StackLayout>
        <ScrollView :width="explorerPathWidth" height="30" orientation="horizontal">
            <Label :text="explorerPath" class="explorerPath" textWrap="true" />
        </ScrollView>
        <GridLayout>
            <ScrollView :height="itemsViewHeight" orientation="vertical" @itemTap="_onExplorerTap($event.item)">
                <ListView for="item in explorerItems">
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
            <ActivityIndicator :busy="generatingPosition" row="0" col="0" />
        </GridLayout>
    </StackLayout>
</template>

<script>
import { localize } from "nativescript-localize";
import Vue from "nativescript-vue";
import ExerciseLoader from '../logic/ExerciceLoader';
const platformModule = require("tns-core-modules/platform");

Vue.filter("L", localize);

export default {
    data() {
        return {
            explorerPath: '',
            explorerItems: [],
            itemsViewHeight: platformModule.screen.mainScreen.heightDIPs - 260,
            explorerPathWidth: platformModule.screen.mainScreen.widthDIPs,
            exerciceLoader: new ExerciseLoader(),
        }
    },
    async mounted() {
        const data = await this.exerciceLoader.loadGoogleDriveRootFiles();
        ///////////////
        console.log(data);
        //////////////////
        data['content'].toJSON()['files'].forEach(fileData => console.log(JSON.stringify(fileData)));
    },
    methods: {
        _onExplorerTap(item) {

        },
        _isFolder(item) {

        },  
    },
}
</script>

<style lang="scss" scoped>
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
</style>