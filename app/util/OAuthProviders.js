import { configureTnsOAuth } from "nativescript-oauth2";

import { 
    TnsOaProviderGoogle,
  } from "nativescript-oauth2/providers";

export function configureOAuthProviderGoogle() {
    const googleProviderOptions = {
        openIdSupport: "oid-full",
        clientId:
        "27447891325-qhmmuc2qpckum7k1sf91vk8277subv27.apps.googleusercontent.com",
        redirectUri:
        "com.googleusercontent.apps.27447891325-qhmmuc2qpckum7k1sf91vk8277subv27:/auth",
        urlScheme:
        "com.googleusercontent.apps.27447891325-qhmmuc2qpckum7k1sf91vk8277subv27",
        scopes: ["email", "https://www.googleapis.com/auth/drive.readonly"]
    };

    const googleProvider = new TnsOaProviderGoogle(googleProviderOptions);
    
    configureTnsOAuth([googleProvider]);
}