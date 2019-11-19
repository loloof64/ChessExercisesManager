import Vue from "nativescript-vue";
Vue.config.silent = true;

import { configureOAuthProviderGoogle } from './logic/OAuthProviders';

configureOAuthProviderGoogle();

import Navigator from 'nativescript-vue-navigator';
import {routes} from './routes';

Vue.use(Navigator, { routes });

new Vue({
    template: `
        <Navigator :defaultRoute="'/home'" />
    `
}).$start();