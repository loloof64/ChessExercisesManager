import Vue from "nativescript-vue";
Vue.config.silent = true;

import { configureOAuthProviderGoogle } from './logic/OAuthProviders';

configureOAuthProviderGoogle();

import Navigator from 'nativescript-vue-navigator';
import {routes} from './routes';

import * as application from "tns-core-modules/application";
import * as frame from "tns-core-modules/ui/frame";

application.android.on(application.AndroidApplication.activityBackPressedEvent,
(args) => {
    const page = frame.topmost().currentPage;
    if (page.hasListeners(application.AndroidApplication.activityBackPressedEvent)) {
        args.cancel = true;
        page.notify({
            eventName: application.AndroidApplication.activityBackPressedEvent,
            object: page
        });
    }
});

Vue.use(Navigator, { routes });

new Vue({
    template: `
        <Navigator :defaultRoute="'/home'" />
    `
}).$start();