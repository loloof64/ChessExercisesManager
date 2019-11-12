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

    import ExerciceLoader from '../util/ExerciceLoader';
    
    export default {
        data() {
            return {
                sampleExercises: [
                    {
                        path: 'krr_k.pgn',
                        label: localize('sample_krr_k'),
                    },
                    {
                        path: 'kp_kpp.pgn',
                        label: localize('sample_kp_kpp'),
                    },
                    {
                        path: 'kppp_kppp.pgn',
                        label: localize('sample_kppp_kppp'),
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
                try {
                    const position = await new ExerciceLoader().loadSampleExercise(exerciseItem.path);
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
        },
        components: {FileExplorer,},
    };
</script>

<style scoped lang="scss">
    @import '../app-variables';
</style>
