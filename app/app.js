import Vue from "nativescript-vue";

import Home from "./pages/Home";

new Vue({

    template: `
        <Frame>
            <Home />
        </Frame>`,

    components: {
        Home
    }
}).$start();
