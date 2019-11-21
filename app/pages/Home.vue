<template>
    <Page class="page" @navigatedTo="onNavigatedTo">
        <ActionBar class="action-bar action-bar-bg">
            <Label class="action-bar-title" :text="'home_title' | L"></Label>
        </ActionBar>

        <StackLayout orientation="vertical">
            <TabView selectedIndex="0" @selectedIndexChange="updateExplorerIfNeeded">
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
    Vue.registerElement(
        'Fab',
        () => require('@nstudio/nativescript-floatingactionbutton').Fab
    );

    const fileSystemModule = require("tns-core-modules/file-system");
    const application = require('application');

    import ExerciceLoader from '../logic/ExerciceLoader';
    
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
            }
        },
        mounted: function(){
            this.$refs['explorerManager'].updateItems();
        },
        methods: {  
            onNavigatedTo(args) {
                this.$refs['explorerManager'].updateItems();
            },
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
            updateExplorerIfNeeded(event) {
                if (event.value === 1) {
                    this.$refs['explorerManager'].updateItems();
                }
            }
        },
        components: {FileExplorer,},
    };
</script>

<style scoped lang="scss">
    @import '../app-variables';

    .action-bar-bg {
        background-color: yellowgreen;
    }
</style>
