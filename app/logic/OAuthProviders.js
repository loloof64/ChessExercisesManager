import { configureTnsOAuth } from "nativescript-oauth2";
import * as secrets from './api_secrets.json';

import { 
    TnsOaProviderMicrosoft,
  } from "nativescript-oauth2/providers";

export function configureOAuthProviderOneDrive() {
    const microsoftProviderOptions = secrets.one_drive;

    const microsoftProvider = new TnsOaProviderMicrosoft(microsoftProviderOptions);
    
    configureTnsOAuth([microsoftProvider]);
}