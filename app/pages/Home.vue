<template>
    <Page class="page">
        <ActionBar class="action-bar">
            <Label class="action-bar-title" :text="'home_title' | L"></Label>
        </ActionBar>

        <StackLayout orientation="vertical">
            <TabView selectedIndex="0">
                <TabViewItem :title="'sample_exercises' | L"
                iconSource="res://bookshelf">
                    <GridLayout>
                        <ListView for="item in sampleExercises" row="0" col="0">
                            <v-template>
                                <Label :text="item.label" fontSize="22" width="100%"
                                    @tap="onSampleExerciseTap(item)"
                                    @longPress="readSample(item)"
                                 />
                            </v-template>
                        </ListView>
                        <ActivityIndicator :busy="busy" row="0" col="0" />
                    </GridLayout>
                </TabViewItem>

                <TabViewItem :title="'custom_exercises' | L" 
                iconSource="res://handsaw">
                    <FileExplorer ref="explorerManager" />
                </TabViewItem>
            </TabView>
        </StackLayout>
    </Page>
</template>

<script>
    import FileExplorer from '../components/FileExplorer';

    import { localize } from "nativescript-localize";

    import Vue from "nativescript-vue";
    Vue.filter("L", localize);

    const fileSystemModule = require("tns-core-modules/file-system");
    
    export default {
        data() {
            return {
                sampleExercises: [
                    {
                        path: 'kp_kpp.cst',
                        label: localize('sample_kp_kpp'),
                    },
                ],
                busy: false,
                explorerItems: [],
            }
        },
        async mounted() {
            this.explorerItems = await this.$refs['explorerManager'].getItems();
            this.explorerPath = this.$refs['explorerManager'].getShortenedPath();
        },
        methods: {  
            async onSampleExerciseTap(exerciseItem) {
                
            },

            async readSample(item) {
                
            },
        },
        components: {FileExplorer,},
    };
</script>

<style scoped lang="scss">
    @import '../app-variables';
</style>
